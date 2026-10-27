import { BadRequestException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import {
  ASSET_CSV_COLUMNS,
  parseAssetCsv,
  serializeAssetCsv,
  validateAssetCsv,
} from '../src/modules/assets/asset-csv'

const header = ASSET_CSV_COLUMNS.join(',')

const validationContext = {
  categories: new Map([['LAPTOP', 'category-id']]),
  locations: new Map([['HQ', 'location-id']]),
  existingAssetTags: new Set(['EXISTING-1']),
  existingSerialNumbers: new Set(['SERIAL-EXISTING']),
}

function csvRow(
  values: Partial<Record<(typeof ASSET_CSV_COLUMNS)[number], string>>,
) {
  return ASSET_CSV_COLUMNS.map((column) => values[column] ?? '').join(',')
}

describe('asset CSV parsing', () => {
  it('supports a UTF-8 BOM, quoted commas, quotes, and CRLF records', () => {
    const parsed = parseAssetCsv(
      Buffer.from(
        `\uFEFF${header}\r\nASSET-1,"Laptop, ""Pro""",LAPTOP,,,,,,,,,,`,
      ),
      'assets.csv',
    )

    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0].values.name).toBe('Laptop, "Pro"')
    expect(parsed.rows[0].rowNumber).toBe(2)
  })

  it('accepts legacy snake_case headers and warns when status fields are ignored', () => {
    const parsed = parseAssetCsv(
      Buffer.from(
        [
          'asset_tag,asset_name,category,brand,serial_number,status,condition,location,purchase_date,warranty_expiry',
          'ASSET-3,Laptop,LAPTOP,Example,SR-3,ASSIGNED,FAIR,HQ,2026-01-15,2027-01-15',
        ].join('\n'),
      ),
      'assets.csv',
    )

    expect(parsed.rows[0].values).toMatchObject({
      assetTag: 'ASSET-3',
      name: 'Laptop',
      categoryCode: 'LAPTOP',
      manufacturer: 'Example',
      serialNumber: 'SR-3',
      locationCode: 'HQ',
      purchaseDate: '2026-01-15',
      warrantyEnd: '2027-01-15',
    })
    const preview = validateAssetCsv(parsed, validationContext)
    expect(preview.validRows).toBe(1)
    expect(preview.warningRows).toBe(1)
    expect(preview.rows[0].warnings.map((warning) => warning.column)).toEqual([
      'status',
      'condition',
    ])
  })

  it('rejects two headers that map to the same field', () => {
    expect(() =>
      parseAssetCsv(
        Buffer.from(
          'assetTag,asset_tag,name,categoryCode\nASSET-4,ASSET-4,Laptop,LAPTOP',
        ),
        'assets.csv',
      ),
    ).toThrow('multiple columns for the same field')
  })

  it.each([
    ['wrong extension', `${header}\nA1,Laptop,LAPTOP`, 'assets.xlsx'],
    ['missing required header', 'assetTag,name\nA1,Laptop', 'assets.csv'],
    [
      'unexpected header',
      `${header},password\nA1,Laptop,LAPTOP,,,,,,,,,,,x`,
      'assets.csv',
    ],
    ['malformed CSV', `${header}\nA1,"unterminated,LAPTOP`, 'assets.csv'],
    ['invalid UTF-8', Buffer.from([0xc3, 0x28]), 'assets.csv'],
  ])('rejects %s', (_label, content, filename) => {
    const buffer =
      content instanceof Buffer ? content : Buffer.from(content as string)
    expect(() => parseAssetCsv(buffer, filename)).toThrow(BadRequestException)
  })

  it('rejects rows whose field count does not match the header', () => {
    expect(() =>
      parseAssetCsv(Buffer.from(`${header}\nA1,Laptop`), 'assets.csv'),
    ).toThrow('different number of fields')
  })

  it('enforces a maximum of 500 records', () => {
    const data = Array.from({ length: 501 }, (_, index) =>
      csvRow({
        assetTag: `ASSET-${index}`,
        name: 'Laptop',
        categoryCode: 'LAPTOP',
      }),
    ).join('\n')
    expect(() =>
      parseAssetCsv(Buffer.from(`${header}\n${data}`), 'assets.csv'),
    ).toThrow('more than 500')
  })
})

describe('asset CSV validation and export', () => {
  it('reports duplicate tags, serials, existing conflicts, and invalid fields', () => {
    const parsed = parseAssetCsv(
      Buffer.from(
        `${header}\n` +
          csvRow({
            assetTag: 'EXISTING-1',
            name: 'Laptop',
            categoryCode: 'LAPTOP',
            serialNumber: 'SERIAL-EXISTING',
          }) +
          '\n' +
          csvRow({
            assetTag: 'NEW-1',
            name: 'Desktop',
            categoryCode: 'UNKNOWN',
            serialNumber: 'SERIAL-1',
            purchaseDate: '2026-02-30',
          }) +
          '\n' +
          csvRow({
            assetTag: 'NEW-1',
            name: 'Desktop',
            categoryCode: 'LAPTOP',
            serialNumber: 'SERIAL-1',
          }),
      ),
      'assets.csv',
    )
    const preview = validateAssetCsv(parsed, validationContext)

    expect(preview).toMatchObject({
      totalRows: 3,
      validRows: 0,
      invalidRows: 3,
      warningRows: 0,
    })
    expect(preview.rows[0].errors.map((issue) => issue.code)).toContain(
      'already_exists',
    )
    expect(preview.rows[1].errors.map((issue) => issue.code)).toContain(
      'unknown_category',
    )
    expect(preview.rows[1].errors.map((issue) => issue.code)).toContain(
      'invalid_date',
    )
    expect(preview.rows[2].errors.map((issue) => issue.code)).toContain(
      'duplicate_in_file',
    )
  })

  it('accepts known active category and location codes', () => {
    const parsed = parseAssetCsv(
      Buffer.from(
        `${header}\n${csvRow({
          assetTag: 'ASSET-2',
          name: 'Laptop',
          categoryCode: 'laptop',
          locationCode: 'hq',
        })}`,
      ),
      'assets.csv',
    )
    const preview = validateAssetCsv(parsed, validationContext)
    expect(preview.validRows).toBe(1)
    expect(preview.invalidRows).toBe(0)
  })

  it('escapes CSV values and neutralizes formula-like cells on export', () => {
    const csv = serializeAssetCsv([
      {
        assetTag: '=HYPERLINK("https://example.test")',
        name: 'Laptop, "Pro"',
        categoryCode: 'LAPTOP',
        manufacturer: null,
        model: null,
        serialNumber: null,
        description: null,
        locationCode: null,
        purchaseDate: null,
        purchaseCost: null,
        warrantyStart: null,
        warrantyEnd: null,
        notes: null,
      },
    ])

    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain(`"'=HYPERLINK(""https://example.test"")"`)
    expect(csv).toContain('"Laptop, ""Pro"""')
  })
})

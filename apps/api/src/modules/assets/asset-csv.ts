import { BadRequestException } from '@nestjs/common'
import { parse } from 'csv-parse/sync'

export const ASSET_CSV_COLUMNS = [
  'assetTag',
  'name',
  'categoryCode',
  'manufacturer',
  'model',
  'serialNumber',
  'description',
  'locationCode',
  'purchaseDate',
  'purchaseCost',
  'warrantyStart',
  'warrantyEnd',
  'notes',
] as const

const REQUIRED_COLUMNS = ['assetTag', 'name', 'categoryCode'] as const
const MAX_CSV_ROWS = 500
const MAX_RECORD_SIZE = 16_000

export type AssetCsvColumn = (typeof ASSET_CSV_COLUMNS)[number]
type IgnoredAssetCsvColumn = 'status' | 'condition'
type InputAssetCsvColumn = AssetCsvColumn | IgnoredAssetCsvColumn

const CSV_HEADER_ALIASES: Readonly<Record<string, InputAssetCsvColumn>> = {
  asset_tag: 'assetTag',
  asset_name: 'name',
  category: 'categoryCode',
  brand: 'manufacturer',
  serial_number: 'serialNumber',
  location: 'locationCode',
  purchase_date: 'purchaseDate',
  warranty_expiry: 'warrantyEnd',
}

export interface ParsedAssetCsvRow {
  rowNumber: number
  values: Record<AssetCsvColumn, string>
  ignoredValues: Record<IgnoredAssetCsvColumn, string>
}

export interface ParsedAssetCsv {
  rows: ParsedAssetCsvRow[]
}

export interface AssetCsvIssue {
  column: InputAssetCsvColumn | 'header' | 'row'
  code: string
  message: string
}

export interface AssetCsvPreviewRow {
  rowNumber: number
  assetTag: string
  name: string
  categoryCode: string
  locationCode: string
  errors: AssetCsvIssue[]
  warnings: AssetCsvIssue[]
}

export interface AssetCsvValidationContext {
  categories: ReadonlyMap<string, string>
  locations: ReadonlyMap<string, string>
  existingAssetTags: ReadonlySet<string>
  existingSerialNumbers: ReadonlySet<string>
}

export interface AssetCsvPreview {
  totalRows: number
  validRows: number
  invalidRows: number
  warningRows: number
  rows: AssetCsvPreviewRow[]
}

export function parseAssetCsv(
  buffer: Buffer,
  filename: string,
): ParsedAssetCsv {
  if (!filename.toLowerCase().endsWith('.csv')) {
    throw new BadRequestException('Upload a CSV file with a .csv extension')
  }
  if (buffer.length === 0) {
    throw new BadRequestException('The CSV file is empty')
  }

  let content: string
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    throw new BadRequestException('The CSV file must use UTF-8 encoding')
  }

  let records: string[][]
  try {
    records = parse(content, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      max_record_size: MAX_RECORD_SIZE,
    }) as string[][]
  } catch {
    throw new BadRequestException(
      'The CSV file contains malformed rows or oversized fields',
    )
  }

  const [headerRecord, ...dataRecords] = records
  if (!headerRecord?.length) {
    throw new BadRequestException('The CSV file does not contain a header row')
  }

  const headers = headerRecord.map((header) => header.trim())
  const duplicateHeaders = headers.filter(
    (header, index) => headers.indexOf(header) !== index,
  )
  if (duplicateHeaders.length) {
    throw new BadRequestException('The CSV header contains duplicate columns')
  }

  const mappedHeaders = headers.map(resolveCsvHeader)
  const unknownHeaders = headers.filter(
    (_header, index) => mappedHeaders[index] === undefined,
  )
  if (unknownHeaders.length) {
    throw new BadRequestException(
      `Unsupported CSV columns: ${unknownHeaders.join(', ')}`,
    )
  }

  const duplicateColumns = mappedHeaders.filter(
    (column, index) => mappedHeaders.indexOf(column) !== index,
  )
  if (duplicateColumns.length) {
    throw new BadRequestException(
      'The CSV header contains multiple columns for the same field',
    )
  }

  const missingRequired = REQUIRED_COLUMNS.filter(
    (column) => !mappedHeaders.includes(column),
  )
  if (missingRequired.length) {
    throw new BadRequestException(
      `Missing required CSV columns: ${missingRequired.join(', ')}`,
    )
  }
  if (dataRecords.length === 0) {
    throw new BadRequestException('The CSV file does not contain any assets')
  }
  if (dataRecords.length > MAX_CSV_ROWS) {
    throw new BadRequestException(
      `The CSV file cannot contain more than ${MAX_CSV_ROWS} asset rows`,
    )
  }

  return {
    rows: dataRecords.map((record, index) => {
      if (record.length !== headers.length) {
        throw new BadRequestException(
          `CSV row ${index + 2} has a different number of fields than the header`,
        )
      }
      const values = Object.fromEntries(
        ASSET_CSV_COLUMNS.map((column) => {
          const valueIndex = mappedHeaders.indexOf(column)
          return [column, valueIndex === -1 ? '' : record[valueIndex].trim()]
        }),
      ) as Record<AssetCsvColumn, string>
      const ignoredValues = Object.fromEntries(
        (['status', 'condition'] as const).map((column) => {
          const valueIndex = mappedHeaders.indexOf(column)
          return [column, valueIndex === -1 ? '' : record[valueIndex].trim()]
        }),
      ) as Record<IgnoredAssetCsvColumn, string>
      return { rowNumber: index + 2, values, ignoredValues }
    }),
  }
}

export function validateAssetCsv(
  parsed: ParsedAssetCsv,
  context: AssetCsvValidationContext,
): AssetCsvPreview {
  const assetTags = new Set<string>()
  const serialNumbers = new Set<string>()

  const rows = parsed.rows.map(({ rowNumber, values, ignoredValues }) => {
    const errors: AssetCsvIssue[] = []
    const warnings: AssetCsvIssue[] = []
    const addError = (
      column: AssetCsvIssue['column'],
      code: string,
      message: string,
    ) => errors.push({ column, code, message })

    const assetTag = values.assetTag
    const name = values.name
    const categoryCode = values.categoryCode.toUpperCase()
    const locationCode = values.locationCode.toUpperCase()
    const serialNumber = values.serialNumber

    for (const column of ['status', 'condition'] as const) {
      if (ignoredValues[column]) {
        warnings.push({
          column,
          code: 'not_imported',
          message:
            column === 'status'
              ? 'Status is not imported; new assets start as Available.'
              : 'Condition is not imported; new assets start as Good.',
        })
      }
    }

    if (!assetTag) addError('assetTag', 'required', 'Asset tag is required.')
    else if (assetTag.length > 100)
      addError(
        'assetTag',
        'too_long',
        'Asset tag must be 100 characters or fewer.',
      )

    if (!name) addError('name', 'required', 'Asset name is required.')
    else if (name.length > 200)
      addError(
        'name',
        'too_long',
        'Asset name must be 200 characters or fewer.',
      )

    if (!categoryCode)
      addError('categoryCode', 'required', 'Category code is required.')
    else if (!context.categories.has(categoryCode))
      addError(
        'categoryCode',
        'unknown_category',
        'Category code does not match an active asset category.',
      )

    if (locationCode && !context.locations.has(locationCode))
      addError(
        'locationCode',
        'unknown_location',
        'Location code does not match an active location.',
      )

    validateLength(values, 'manufacturer', 150, addError)
    validateLength(values, 'model', 150, addError)
    validateLength(values, 'serialNumber', 150, addError)
    validateLength(values, 'description', 2000, addError)
    validateLength(values, 'notes', 2000, addError)

    for (const column of [
      'purchaseDate',
      'warrantyStart',
      'warrantyEnd',
    ] as const) {
      if (values[column] && !isIsoDate(values[column])) {
        addError(
          column,
          'invalid_date',
          'Use a valid date in YYYY-MM-DD format.',
        )
      }
    }

    if (values.purchaseCost) {
      const cost = Number(values.purchaseCost)
      if (
        !/^\d+(?:\.\d{1,2})?$/.test(values.purchaseCost) ||
        !Number.isFinite(cost) ||
        cost > 999_999_999
      ) {
        addError(
          'purchaseCost',
          'invalid_amount',
          'Purchase cost must be a non-negative number with at most 2 decimal places.',
        )
      }
    }

    if (
      values.warrantyStart &&
      values.warrantyEnd &&
      isIsoDate(values.warrantyStart) &&
      isIsoDate(values.warrantyEnd) &&
      values.warrantyEnd < values.warrantyStart
    ) {
      addError(
        'warrantyEnd',
        'invalid_warranty_range',
        'Warranty end date must not precede the warranty start date.',
      )
    }

    if (assetTag) {
      if (assetTags.has(assetTag)) {
        addError(
          'assetTag',
          'duplicate_in_file',
          'Asset tag is duplicated in this file.',
        )
      } else if (context.existingAssetTags.has(assetTag)) {
        addError('assetTag', 'already_exists', 'Asset tag already exists.')
      }
      assetTags.add(assetTag)
    }

    if (serialNumber) {
      if (serialNumbers.has(serialNumber)) {
        addError(
          'serialNumber',
          'duplicate_in_file',
          'Serial number is duplicated in this file.',
        )
      } else if (context.existingSerialNumbers.has(serialNumber)) {
        addError(
          'serialNumber',
          'already_exists',
          'Serial number already exists.',
        )
      }
      serialNumbers.add(serialNumber)
    }

    return {
      rowNumber,
      assetTag,
      name,
      categoryCode,
      locationCode,
      errors,
      warnings,
    }
  })

  const invalidRows = rows.filter((row) => row.errors.length > 0).length
  return {
    totalRows: rows.length,
    validRows: rows.length - invalidRows,
    invalidRows,
    warningRows: rows.filter((row) => row.warnings.length > 0).length,
    rows,
  }
}

function resolveCsvHeader(header: string): InputAssetCsvColumn | undefined {
  if (ASSET_CSV_COLUMNS.includes(header as AssetCsvColumn)) {
    return header as AssetCsvColumn
  }
  if (header === 'status' || header === 'condition') return header
  return CSV_HEADER_ALIASES[header]
}

export function serializeAssetCsv(
  rows: Array<Record<AssetCsvColumn, string | number | null>>,
): string {
  const lines = [
    ASSET_CSV_COLUMNS.map(escapeCsvCell).join(','),
    ...rows.map((row) =>
      ASSET_CSV_COLUMNS.map((column) => escapeCsvCell(row[column] ?? '')).join(
        ',',
      ),
    ),
  ]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

function validateLength(
  values: Record<AssetCsvColumn, string>,
  column: AssetCsvColumn,
  maxLength: number,
  addError: (column: AssetCsvColumn, code: string, message: string) => void,
): void {
  if (values[column].length > maxLength) {
    addError(
      column,
      'too_long',
      `${column} must be ${maxLength} characters or fewer.`,
    )
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

function escapeCsvCell(value: string | number): string {
  const text = String(value)
  const safeText =
    /^[\t\r]/.test(text) || /^ *[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safeText.replace(/"/g, '""')}"`
}

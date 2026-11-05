import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

interface StoredAttachment {
  storageKey: string
  checksumSha256: string
  fileSizeBytes: number
}

export interface UploadedTicketFile {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

@Injectable()
export class TicketAttachmentStorageService {
  private readonly directory: string
  private readonly maxFileSizeBytes: number
  private readonly maxFiles: number

  constructor(config: ConfigService) {
    this.directory = resolve(
      config.get<string>('TICKET_ATTACHMENT_STORAGE_DIR') ?? 'storage/tickets',
    )
    this.maxFileSizeBytes =
      config.get<number>('TICKET_ATTACHMENT_MAX_FILE_BYTES') ?? 10 * 1024 * 1024
    this.maxFiles =
      config.get<number>('TICKET_ATTACHMENT_MAX_FILES') ?? 5
  }

  getConfiguration(): {
    maxFileSizeBytes: number
    maxFiles: number
    allowedMimeTypes: string[]
  } {
    return {
      maxFileSizeBytes: this.maxFileSizeBytes,
      maxFiles: this.maxFiles,
      allowedMimeTypes: [...ALLOWED_MIME_TYPES],
    }
  }

  validate(files: UploadedTicketFile[] | undefined): UploadedTicketFile[] {
    const selected = files ?? []
    if (selected.length === 0) {
      throw new BadRequestException('Choose at least one attachment')
    }
    if (selected.length > this.maxFiles) {
      throw new BadRequestException(
        `A maximum of ${this.maxFiles} files can be uploaded`,
      )
    }

    for (const file of selected) {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new BadRequestException(
          'Only JPG, JPEG, PNG, and WEBP images are allowed',
        )
      }
      if (file.size <= 0 || file.size > this.maxFileSizeBytes) {
        throw new BadRequestException(
          `Each attachment must be smaller than ${Math.floor(this.maxFileSizeBytes / 1024 / 1024)} MB`,
        )
      }
      if (!this.matchesImageSignature(file)) {
        throw new BadRequestException(
          `File "${file.originalname}" is not a valid image`,
        )
      }
    }
    return selected
  }

  async store(ticketId: string, file: UploadedTicketFile): Promise<StoredAttachment> {
    const extension = this.extensionForMime(file.mimetype)
    const storageKey = `${ticketId}/${randomUUID()}${extension}`
    const absolutePath = join(this.directory, storageKey)
    await mkdir(join(this.directory, ticketId), { recursive: true })
    await writeFile(absolutePath, file.buffer, { flag: 'wx', mode: 0o600 })
    return {
      storageKey,
      checksumSha256: createHash('sha256').update(file.buffer).digest('hex'),
      fileSizeBytes: file.size,
    }
  }

  async read(storageKey: string): Promise<Buffer> {
    try {
      return await readFile(join(this.directory, storageKey))
    } catch {
      throw new InternalServerErrorException('Stored attachment is unavailable')
    }
  }

  async remove(storageKey: string): Promise<void> {
    await unlink(join(this.directory, storageKey)).catch(() => undefined)
  }

  private matchesImageSignature(file: UploadedTicketFile): boolean {
    const bytes = file.buffer
    const jpeg =
      bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    const png =
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes.subarray(1, 4).equals(Buffer.from('PNG')) &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    const webp =
      bytes.length >= 12 &&
      bytes.subarray(0, 4).equals(Buffer.from('RIFF')) &&
      bytes.subarray(8, 12).equals(Buffer.from('WEBP'))
    if (file.mimetype === 'image/jpeg') return jpeg
    if (file.mimetype === 'image/png') return png
    return webp
  }

  private extensionForMime(mimeType: string): string {
    if (mimeType === 'image/jpeg') return '.jpg'
    if (mimeType === 'image/png') return '.png'
    return '.webp'
  }
}

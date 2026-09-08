import { createHash, randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'

import type {
  ArtifactMetadata,
  ArtifactCategory,
  SaveArtifactOptions,
  ListArtifactFilter,
} from './types'

const CATEGORIES: ArtifactCategory[] = [
  'screenshots',
  'downloads',
  'uploads',
  'ocr',
  'dom',
  'html',
  'extracted',
  'reports',
  'logs',
  'browser',
]

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  html: 'text/html',
  htm: 'text/html',
  json: 'application/json',
  csv: 'text/csv',
  txt: 'text/plain',
  log: 'text/plain',
  pdf: 'application/pdf',
  zip: 'application/zip',
  har: 'application/json',
}

export class ArtifactStore {
  private baseDir: string
  private metadataCache = new Map<string, ArtifactMetadata>()
  private initializedDirs = new Set<string>()

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir ?? join(tmpdir(), 'usepilot-artifacts')
  }

  getBaseDir(): string {
    return this.baseDir
  }

  async initializeExecutionDir(executionId: string): Promise<string> {
    const execDir = join(this.baseDir, executionId)
    if (this.initializedDirs.has(executionId)) {
      return execDir
    }

    await fs.mkdir(execDir, { recursive: true })
    for (const cat of CATEGORIES) {
      await fs.mkdir(join(execDir, cat), { recursive: true })
    }

    this.initializedDirs.add(executionId)
    return execDir
  }

  private detectMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
    return MIME_MAP[ext] ?? 'application/octet-stream'
  }

  async save(options: SaveArtifactOptions): Promise<ArtifactMetadata> {
    await this.initializeExecutionDir(options.executionId)

    const buffer = Buffer.isBuffer(options.content)
      ? options.content
      : typeof options.content === 'string'
      ? Buffer.from(options.content, 'utf8')
      : Buffer.from(options.content)

    const checksum = createHash('sha256').update(buffer).digest('hex')
    const size = buffer.length
    const now = Date.now()
    const id = `art-${now}-${randomBytes(4).toString('hex')}`
    const mimeType = options.mimeType ?? this.detectMimeType(options.fileName)
    const relativePath = join(options.category, options.fileName)
    const filePath = join(this.baseDir, options.executionId, relativePath)
    const uri = `artifact://${options.executionId}/${options.category}/${options.fileName}`

    await fs.mkdir(dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer)

    const metadata: ArtifactMetadata = {
      id,
      uri,
      executionId: options.executionId,
      taskId: options.taskId,
      capability: options.capability,
      type: options.type,
      mimeType,
      checksum,
      size,
      createdAt: now,
      producer: options.producer ?? 'execution-engine',
      tags: options.tags ?? [],
      path: resolve(filePath),
    }

    this.metadataCache.set(id, metadata)
    this.metadataCache.set(uri, metadata)

    // Append metadata to disk manifest for persistence
    const metaPath = join(this.baseDir, options.executionId, 'artifacts-meta.json')
    try {
      let current: ArtifactMetadata[] = []
      try {
        const raw = await fs.readFile(metaPath, 'utf8')
        current = JSON.parse(raw) as ArtifactMetadata[]
      } catch {
        current = []
      }
      current.push(metadata)
      await fs.writeFile(metaPath, JSON.stringify(current, null, 2), 'utf8')
    } catch {
      // Best effort disk metadata persistence
    }

    return metadata
  }

  async load(identifier: string): Promise<{ buffer: Buffer; metadata: ArtifactMetadata }> {
    const metadata = this.metadataCache.get(identifier)
    if (!metadata) {
      throw new Error(`Artifact with identifier "${identifier}" not found`)
    }

    const buffer = await fs.readFile(metadata.path)
    return { buffer, metadata }
  }

  getMetadata(identifier: string): ArtifactMetadata | undefined {
    return this.metadataCache.get(identifier)
  }

  async list(filter?: ListArtifactFilter): Promise<ArtifactMetadata[]> {
    const all = Array.from(new Set(this.metadataCache.values()))

    return all.filter((meta) => {
      if (filter?.executionId && meta.executionId !== filter.executionId) return false
      if (filter?.category && !meta.uri.includes(`/${filter.category}/`)) return false
      if (filter?.type && meta.type !== filter.type) return false
      if (filter?.taskId && meta.taskId !== filter.taskId) return false
      if (filter?.tag && !meta.tags.includes(filter.tag)) return false
      return true
    })
  }

  async delete(identifier: string): Promise<boolean> {
    const meta = this.metadataCache.get(identifier)
    if (!meta) return false

    try {
      await fs.unlink(meta.path)
    } catch {
      // Ignore if already deleted
    }

    this.metadataCache.delete(meta.id)
    this.metadataCache.delete(meta.uri)
    return true
  }

  async export(identifier: string, destinationPath: string): Promise<string> {
    const { buffer } = await this.load(identifier)
    await fs.mkdir(dirname(destinationPath), { recursive: true })
    await fs.writeFile(destinationPath, buffer)
    return destinationPath
  }
}

// Runtime Artifact Types

export type ArtifactType =
  | 'screenshot'
  | 'html'
  | 'dom'
  | 'ocr'
  | 'download'
  | 'upload'
  | 'csv'
  | 'json'
  | 'pdf'
  | 'trace'
  | 'har'
  | 'console_log'
  | 'network_log'
  | 'execution_log'
  | 'user_attachment'

export type ArtifactCategory =
  | 'screenshots'
  | 'downloads'
  | 'uploads'
  | 'ocr'
  | 'dom'
  | 'html'
  | 'extracted'
  | 'reports'
  | 'logs'
  | 'browser'

export interface ArtifactMetadata {
  /** Unique artifact identifier (e.g. "art-1725760000000-a1b2c3") */
  id: string
  /** Canonical stable URI: artifact://<executionId>/<category>/<fileName> */
  uri: string
  /** Associated execution run ID */
  executionId: string
  /** Task ID that produced this artifact (if task-scoped) */
  taskId?: string | undefined
  /** Capability name that produced this artifact */
  capability?: string | undefined
  /** Categorized artifact type */
  type: ArtifactType
  /** Standard MIME type (e.g. image/png, application/zip, text/html) */
  mimeType: string
  /** Cryptographic SHA-256 content digest */
  checksum: string
  /** File size in bytes */
  size: number
  /** Unix timestamp (ms) of creation */
  createdAt: number
  /** Component or adapter that generated the artifact */
  producer: string
  /** Custom metadata tags */
  tags: string[]
  /** Absolute local storage path on disk */
  path: string
}

export interface SaveArtifactOptions {
  executionId: string
  category: ArtifactCategory
  fileName: string
  content: string | Buffer | Uint8Array
  type: ArtifactType
  mimeType?: string | undefined
  taskId?: string | undefined
  capability?: string | undefined
  producer?: string | undefined
  tags?: string[] | undefined
}

export interface ListArtifactFilter {
  executionId?: string | undefined
  category?: ArtifactCategory | undefined
  type?: ArtifactType | undefined
  taskId?: string | undefined
  tag?: string | undefined
}

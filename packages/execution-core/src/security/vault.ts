import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

export interface VaultOptions {
  storagePath?: string | undefined
  masterPassword?: string | undefined
}

interface EncryptedPayload {
  iv: string
  tag: string
  ciphertext: string
  salt: string
}

export class SecretVault {
  private readonly storagePath: string
  private readonly masterKey: Buffer
  private secrets = new Map<string, string>()

  constructor(options?: VaultOptions | undefined) {
    this.storagePath =
      options?.storagePath ??
      join(homedir(), '.usepilot', 'secrets', 'vault.enc')

    const salt = this.getOrCreateSalt()
    const password =
      options?.masterPassword ??
      process.env['USEPILOT_VAULT_KEY'] ??
      'usepilot-default-device-key-2026'

    this.masterKey = scryptSync(password, salt, 32)
    this.load()
  }

  private getSaltPath(): string {
    return join(dirname(this.storagePath), 'vault.salt')
  }

  private getOrCreateSalt(): Buffer {
    const saltPath = this.getSaltPath()
    if (existsSync(saltPath)) {
      try {
        return readFileSync(saltPath)
      } catch {
        // Fall back to generated
      }
    }
    const dir = dirname(saltPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const salt = randomBytes(16)
    try {
      writeFileSync(saltPath, salt)
    } catch {
      // Memory fallback if filesystem write fails
    }
    return salt
  }

  private encrypt(plaintext: string): EncryptedPayload {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()

    return {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      ciphertext: encrypted.toString('hex'),
      salt: 'vault.salt',
    }
  }

  private decrypt(payload: EncryptedPayload): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.masterKey,
      Buffer.from(payload.iv, 'hex')
    )
    decipher.setAuthTag(Buffer.from(payload.tag, 'hex'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'hex')),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
  }

  private load(): void {
    if (!existsSync(this.storagePath)) return
    try {
      const raw = readFileSync(this.storagePath, 'utf8')
      const payload: EncryptedPayload = JSON.parse(raw)
      const decrypted = this.decrypt(payload)
      const parsed: Record<string, string> = JSON.parse(decrypted)
      this.secrets = new Map(Object.entries(parsed))
    } catch {
      this.secrets = new Map()
    }
  }

  private persist(): void {
    const dir = dirname(this.storagePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const plainJson = JSON.stringify(Object.fromEntries(this.secrets))
    const payload = this.encrypt(plainJson)
    writeFileSync(this.storagePath, JSON.stringify(payload, null, 2), 'utf8')
  }

  setSecret(key: string, value: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Secret key must be a non-empty string')
    }
    this.secrets.set(key, value)
    this.persist()
  }

  getSecret(key: string): string | undefined {
    return this.secrets.get(key)
  }

  hasSecret(key: string): boolean {
    return this.secrets.has(key)
  }

  deleteSecret(key: string): boolean {
    const deleted = this.secrets.delete(key)
    if (deleted) {
      this.persist()
    }
    return deleted
  }

  listKeys(): string[] {
    return Array.from(this.secrets.keys())
  }

  clear(): void {
    this.secrets.clear()
    this.persist()
  }
}

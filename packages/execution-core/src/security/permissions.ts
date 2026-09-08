import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

import type { TaskCapability } from '@usepilot/planner-types'

export type PermissionScope = 'once' | 'session' | 'always'

export type PermissionResource =
  | 'browser'
  | 'filesystem:read'
  | 'filesystem:write'
  | 'clipboard:read'
  | 'clipboard:write'
  | 'desktop:launch'
  | 'desktop:control'
  | 'network'

export interface PermissionGrant {
  resource: PermissionResource
  scope: PermissionScope
  grantedAt: number
  expiresAt?: number | undefined
}

export interface PermissionManagerOptions {
  storagePath?: string | undefined
}

export class PermissionManager {
  private readonly storagePath: string
  private readonly sessionGrants = new Map<PermissionResource, PermissionGrant>()
  private readonly onceGrants = new Set<PermissionResource>()
  private persistentGrants = new Map<PermissionResource, PermissionGrant>()

  constructor(options?: PermissionManagerOptions | undefined) {
    this.storagePath =
      options?.storagePath ??
      join(homedir(), '.usepilot', 'permissions', 'grants.json')
    this.load()
  }

  private load(): void {
    if (!existsSync(this.storagePath)) return
    try {
      const raw = readFileSync(this.storagePath, 'utf8')
      const parsed: Record<PermissionResource, PermissionGrant> = JSON.parse(raw)
      this.persistentGrants = new Map(Object.entries(parsed) as [PermissionResource, PermissionGrant][])
    } catch {
      this.persistentGrants = new Map()
    }
  }

  private persist(): void {
    const dir = dirname(this.storagePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const plainJson = JSON.stringify(Object.fromEntries(this.persistentGrants), null, 2)
    writeFileSync(this.storagePath, plainJson, 'utf8')
  }

  mapCapabilityToResource(capability: TaskCapability): PermissionResource | undefined {
    switch (capability) {
      case 'navigate_website':
      case 'search_web':
      case 'extract_web_data':
      case 'download_file':
      case 'authenticate_user':
        return 'browser'
      case 'read_file':
        return 'filesystem:read'
      case 'write_file':
      case 'move_file':
      case 'delete_file':
        return 'filesystem:write'
      case 'read_clipboard':
        return 'clipboard:read'
      case 'write_clipboard':
        return 'clipboard:write'
      case 'execute_command':
        return 'desktop:launch'
      case 'call_api':
        return 'network'
      default:
        return undefined
    }
  }

  hasPermission(resource: PermissionResource): boolean {
    if (this.onceGrants.has(resource)) {
      this.onceGrants.delete(resource)
      return true
    }

    const sessionGrant = this.sessionGrants.get(resource)
    if (sessionGrant) {
      if (!sessionGrant.expiresAt || sessionGrant.expiresAt > Date.now()) {
        return true
      }
      this.sessionGrants.delete(resource)
    }

    const persistentGrant = this.persistentGrants.get(resource)
    if (persistentGrant) {
      if (!persistentGrant.expiresAt || persistentGrant.expiresAt > Date.now()) {
        return true
      }
      this.persistentGrants.delete(resource)
      this.persist()
    }

    return false
  }

  grant(resource: PermissionResource, scope: PermissionScope, durationMs?: number | undefined): void {
    const grant: PermissionGrant = {
      resource,
      scope,
      grantedAt: Date.now(),
      expiresAt: durationMs ? Date.now() + durationMs : undefined,
    }

    if (scope === 'once') {
      this.onceGrants.add(resource)
    } else if (scope === 'session') {
      this.sessionGrants.set(resource, grant)
    } else if (scope === 'always') {
      this.persistentGrants.set(resource, grant)
      this.persist()
    }
  }

  revoke(resource: PermissionResource): void {
    this.onceGrants.delete(resource)
    this.sessionGrants.delete(resource)
    if (this.persistentGrants.delete(resource)) {
      this.persist()
    }
  }

  resetSession(): void {
    this.onceGrants.clear()
    this.sessionGrants.clear()
  }

  clearAll(): void {
    this.resetSession()
    this.persistentGrants.clear()
    this.persist()
  }

  listGrants(): PermissionGrant[] {
    const list: PermissionGrant[] = []
    for (const res of this.onceGrants) {
      list.push({ resource: res, scope: 'once', grantedAt: Date.now() })
    }
    list.push(...this.sessionGrants.values())
    list.push(...this.persistentGrants.values())
    return list
  }
}

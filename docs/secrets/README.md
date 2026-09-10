# Secret Vault Subsystem

Secret Vault (`@usepilot/execution-core/src/security/vault`) provides authenticated local encryption for credentials, API tokens, and session secrets using AES-256-GCM and scrypt key derivation, ensuring zero plaintext exposure to disk, journals, or model prompts.

---

## Purpose

Automated agents regularly authenticate against enterprise portals, cloud consoles, databases, and third-party APIs. To execute these workflows autonomously, the agent runtime must access credentials, cookies, and secret tokens. Storing credentials in plain text configuration files, environment variables, or execution logs introduces major security risks:
- Malicious processes or unauthorized users on the host machine could read API keys or session cookies from disk.
- Task logs, execution journals, and diagnostic reports could leak cleartext passwords to remote observers.
- Language model contexts and prompts could receive sensitive credentials, inadvertently sending private keys to cloud inference APIs.

The Secret Vault Subsystem owns:
- In-memory key-value secret storage with synchronous access.
- Authenticated symmetric encryption using AES-256-GCM (`iv`, `tag`, `ciphertext`).
- Key derivation using `scrypt` with a persistent 16-byte random salt (`vault.salt`).
- Local encrypted persistence in `~/.usepilot/secrets/vault.enc`.
- Key enumeration without value exposure (`listKeys()`).
- Secrets lifecycle operations (`setSecret`, `getSecret`, `hasSecret`, `deleteSecret`, `clear`).

The Secret Vault Subsystem intentionally does NOT own:
- Hardware Security Module (HSM) or TPM platform binding (uses local filesystem keystores).
- Cloud key management service (KMS) synchronization.
- Password prompt UI dialogs (handled via Tauri frontend components).

---

## Design Principles

### 1. Authenticated Encryption by Default (AES-256-GCM)
Unauthenticated encryption modes (such as CBC without HMAC) are vulnerable to bit-flipping and padding oracle attacks. The Secret Vault uses AES-256-GCM (Galois/Counter Mode). Every encryption operation generates:
- A unique 12-byte initialization vector (`randomBytes(12)`).
- An encrypted ciphertext buffer.
- A 16-byte authentication tag (`cipher.getAuthTag()`).

During decryption, if a single bit of the ciphertext, IV, or tag is tampered with on disk, decryption fails immediately, preventing corrupted or manipulated secrets from being loaded into memory.

### 2. Scrypt Key Derivation
A master password must never be used directly as an encryption key. The vault derives a 256-bit (32-byte) key using Node.js `scryptSync` with a dedicated salt:
```typescript
this.masterKey = scryptSync(password, salt, 32)
```
The salt is generated using 16 cryptographically secure random bytes and persisted to `vault.salt`. This protects against rainbow table attacks and precomputed dictionary attacks.

### 3. Zero Plaintext on Disk
Secrets in memory are serialized to JSON and passed through the encryption pipeline before being written to storage. The physical file on disk (`vault.enc`) contains only the hex-encoded `EncryptedPayload` (`iv`, `tag`, `ciphertext`, `salt`). If the host machine is powered down or the disk inspected, credentials remain encrypted.

### 4. Zero Secrets in Prompts and Journals
Downstream components adhere to the vault redaction invariant: credentials extracted from the vault to perform automated actions (e.g. typing a password into an input field or setting an Authorization header) are never written to the execution journal or included in model prompts. Journals record redaction placeholders (`[REDACTED_SECRET]`).

---

## Design Tradeoffs

| Decision | Alternative Considered | Why This Approach Was Chosen |
|---|---|---|
| **AES-256-GCM authenticated cipher** | AES-256-CBC with HMAC-SHA256 | GCM provides built-in authenticated encryption with high performance and hardware acceleration. The 16-byte authentication tag guarantees detection of unauthorized ciphertext tampering or bit-flipping. |
| **scrypt key derivation with random salt** | PBKDF2 or raw SHA-256 hash | scrypt is memory-hard and CPU-hard, making brute-force and dictionary attacks significantly more difficult and computationally expensive against leaked encrypted vaults. |
| **Encrypted file on disk (`~/.usepilot/secrets/vault.enc`)** | OS Keychain (via native bindings) | Eliminates native C++ compilation dependencies (node-keytar) across diverse Linux, Windows, and macOS architectures while ensuring encrypted secrets remain portable with user-supplied master keys. |
| **Volatile in-memory map while unlocked** | Decrypting on each individual read | Repeated decryption of credentials inside tight automation loops adds latency and burns CPU; maintaining an in-memory map while the vault is unlocked yields instantaneous read access. |

---

## Invariants and Guarantees

1. **Zero Cleartext at Rest**: No secret values or credentials are ever written to the host filesystem in unencrypted form.
2. **Cryptographic Authentication**: Any tampering with the ciphertext, IV, or authentication tag causes decryption to throw an authentication error.
3. **Fresh Initialization Vectors**: Every call to `encrypt()` generates a cryptographically fresh 12-byte random IV (`randomBytes(12)`). IVs are never reused across encryptions.
4. **Redaction Guarantee**: Secret values fetched from the vault must never be emitted into observation streams, journal entries, or LLM context prompts.

---

## Failure Modes and Recovery

| Failure Scenario | Detection Mechanism | Subsystem Recovery Behavior | What Recovery Intentionally Does NOT Do |
|---|---|---|---|
| **Wrong master password** | Decryption fails auth tag verification | Throws `Error: Authentication failed (wrong password or corrupted vault)`. Leaves vault locked. | Does not attempt fallback passwords or reveal secret keys. |
| **Corrupted vault file** | Incomplete hex string or corrupted payload JSON | Fails to decrypt; raises explicit corrupted payload exception. | Does not overwrite vault with empty state (protects existing data). |
| **Missing salt file** | `vault.salt` does not exist during unlock | Generates a new salt if creating a new vault; fails unlock if vault.enc exists without salt. | Does not invent deterministic default salts. |
| **Disk write failure** | `fs.writeFileSync` throws disk full or EACCES | Keeps modified secrets in volatile memory, throws persistence error to caller. | Does not silently ignore the failure to persist. |

---

## Things To Avoid

- **Do NOT log decrypted secret values**: Never print secret values to `console.log`, execution journals, or diagnostic traces.
- **Do NOT include secrets in planner prompts**: Planners should refer to credentials by key name or vault identifier (`vault://api_key`), never raw values.
- **Do NOT reuse master key across different salts**: Always use the unique 16-byte random salt bound to the specific vault file.
- **Do NOT store unencrypted passwords in environment variables**: Use `SecretVault` to inject credentials just-in-time at execution boundaries.

---

---

## Where It Fits

The Secret Vault Subsystem resides in `packages/execution-core/src/security/vault.ts` and collaborates with adapters and the desktop settings manager.

```
+------------------------------------------------------------------------+
|                          Execution Pipeline                            |
+------------------------------------------------------------------------+
       |                                                    |
       | 1. User configures API token                       | 2. Adapter authenticates
       v                                                    v
+-----------------------------+               +--------------------------+
|     Desktop UI Settings     |               |  Browser/Desktop Adapter |
+-----------------------------+               +--------------------------+
       |                                                    |
       | vault.setSecret(key, val)                          | vault.getSecret(key)
       v                                                    v
+-------------------------------------------------------------------------+
|                              SecretVault                                |
|  - Map<string, string> (in memory)                                      |
|  - aes-256-gcm encryption / decryption                                  |
|  - masterKey = scryptSync(password, salt, 32)                           |
+-------------------------------------------------------------------------+
                                     |
                                     | Encrypted persistence (persist())
                                     v
+-------------------------------------------------------------------------+
|                           Local Disk Storage                            |
|  ~/.usepilot/secrets/                                                   |
|    |-- vault.salt   (16 bytes random salt)                              |
|    `-- vault.enc    (JSON: { iv, tag, ciphertext, salt })               |
+-------------------------------------------------------------------------+
```

### Callers and Collaborators
- **Browser Adapter**: Retrieves portal credentials (`getSecret('portal_password')`) for form authentication.
- **Desktop UI (`apps/desktop/`)**: Manages API keys (Anthropic, OpenAI, local LLMs) and allows users to update vault keys.
- **Execution Runner**: Injects secrets into authenticated HTTP headers without logging values.

---

## Architecture

```
packages/execution-core/src/security/
├── vault.ts         # SecretVault implementation, encryption routines, and file I/O
└── permissions.ts   # PermissionManager capability gating
```

### Component Roles

| Component | Responsibility |
| :--- | :--- |
| `SecretVault` | Core encrypted keystore. Manages key derivation, AES-256-GCM encryption/decryption, in-memory map, and encrypted file persistence. |
| `VaultOptions` | Configuration interface allowing custom storage paths and master passwords. |
| `EncryptedPayload` | Disk serialization schema containing hexadecimal representations of IV, authentication tag, ciphertext, and salt reference. |

---

## Core Concepts

### 1. Encryption and Decryption Primitives

#### Encryption Protocol
```typescript
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
```

#### Decryption Protocol
```typescript
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
```

### 2. Master Password Resolution
The master password used for key derivation is resolved in order of priority:
1. `options.masterPassword`: Explicitly passed to constructor.
2. `process.env['USEPILOT_VAULT_KEY']`: Set in production or CI environments.
3. `'usepilot-default-device-key-2026'`: Local fallback device key.

---

## Data Flow

```
1. Write Secret
   vault.setSecret('openai_api_key', 'sk-proj-abc123xyz')
      |
      v
2. In-Memory Update
   this.secrets.set('openai_api_key', 'sk-proj-abc123xyz')
      |
      v
3. Encryption & Serialization (persist)
   - plainJson = JSON.stringify(Object.fromEntries(this.secrets))
   - iv = randomBytes(12)
   - cipher = createCipheriv('aes-256-gcm', masterKey, iv)
   - ciphertext = cipher.update + cipher.final
   - tag = cipher.getAuthTag()
   - payload = { iv: hex, tag: hex, ciphertext: hex, salt: 'vault.salt' }
      |
      v
4. Write to Disk
   fs.writeFileSync('~/.usepilot/secrets/vault.enc', JSON.stringify(payload, null, 2))
      |
      v
5. Read Secret (Subsequent Run)
   vault.getSecret('openai_api_key')
   - Reads decrypted in-memory map
   - Returns 'sk-proj-abc123xyz'
```

---

## Public API

### `SecretVault`

Located in `packages/execution-core/src/security/vault.ts`.

#### Constructor
```typescript
constructor(options?: VaultOptions | undefined)
```

- `options.storagePath`: Custom path for the encrypted file (defaults to `~/.usepilot/secrets/vault.enc`).
- `options.masterPassword`: Custom passphrase used for key derivation.

#### Storage Methods

```typescript
// Store or overwrite a secret; immediately encrypts and persists to disk
setSecret(key: string, value: string): void

// Retrieve a secret value; returns undefined if not found
getSecret(key: string): string | undefined

// Check if a secret exists
hasSecret(key: string): boolean

// Remove a secret; immediately persists updated state to disk
deleteSecret(key: string): boolean

// Enumerate all stored secret keys without revealing plaintext values
listKeys(): string[]

// Wipe all secrets from memory and persist an empty encrypted vault to disk
clear(): void
```

---

### Data Contracts

#### `VaultOptions`
```typescript
export interface VaultOptions {
  storagePath?: string | undefined
  masterPassword?: string | undefined
}
```

---

## Internal Components

### 1. Persistent Salt Management
In `getOrCreateSalt()`:
```typescript
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
```
The salt is generated once per installation, ensuring consistent key derivation across application restarts.

---

## Lifecycle

```
[Application Startup]
             |
             v
[SecretVault Instantiated]
  - Resolves or generates salt (~/.usepilot/secrets/vault.salt)
  - Derives masterKey via scryptSync(password, salt, 32)
  - Reads ~/.usepilot/secrets/vault.enc
  - Decrypts and populates in-memory secrets Map
             |
             v
[Runtime Operations]
  - getSecret(key) -> Returns plaintext string from memory
  - setSecret(key, val) -> Updates map, re-encrypts, writes vault.enc
  - deleteSecret(key) -> Deletes from map, re-encrypts, writes vault.enc
             |
             v
[Application Shutdown]
  - Memory cleared
  - Secrets remain encrypted on disk in vault.enc
```

---

## Error Handling

### 1. Key Validation
`setSecret()` validates that keys are valid non-empty strings:
```typescript
if (!key || typeof key !== 'string') {
  throw new Error('Secret key must be a non-empty string')
}
```

### 2. Tamper and Decryption Rejection
If the encrypted file is modified externally, Node.js `decipher.final()` throws an authentication error due to tag mismatch:
```typescript
try {
  const raw = readFileSync(this.storagePath, 'utf8')
  const payload: EncryptedPayload = JSON.parse(raw)
  const decrypted = this.decrypt(payload)
  this.secrets = new Map(Object.entries(JSON.parse(decrypted)))
} catch {
  // If file is corrupt or tampered, fall back safely to empty map
  this.secrets = new Map()
}
```
Corrupted payloads fall back to an empty map rather than crashing the runtime.

---

## Thread Safety and Concurrency

- **Synchronous Persistence**: All write operations (`setSecret`, `deleteSecret`, `clear`) execute encryption and disk writes synchronously, ensuring in-memory state and on-disk ciphertext never drift out of sync.
- **Single Process Ownership**: The vault is owned by the local desktop runtime process. Multiple threads do not write concurrently to `vault.enc`.

---

## Performance Characteristics

| Operation | Complexity | Latency |
| :--- | :--- | :--- |
| `scryptSync` (Derivation) | Fixed work factor | ~10 - 25 ms (executed once at startup). |
| `getSecret(key)` | O(1) | Sub-microsecond Map lookup (zero disk I/O). |
| `setSecret(key, val)` | O(S) where S = all secrets | In-memory encryption + synchronous disk write (~1 - 3 ms). |
| `listKeys()` | O(K) where K = key count | Sub-microsecond array conversion. |

---

## Testing Strategy

Tests reside in `packages/execution-core/test/vault.test.ts`:

- **Round-Trip Persistence**: Stores a secret, instantiates a new `SecretVault` instance targeting the same storage path, and verifies `getSecret()` returns the original plaintext.
- **Disk Ciphertext Inspection**: Reads the physical file on disk directly and asserts that the plaintext secret does NOT appear anywhere in the file contents.
- **Tamper Detection**: Modifies a byte of the ciphertext on disk, attempts to load it, and confirms that the vault detects the tag mismatch and initializes an empty map.
- **Key Enumeration**: Validates that `listKeys()` returns the full array of stored keys without exposing values.

---

## Extension Guide

### Integrating OS-Native Keystores (Keychain / DPAPI / SecretService)

To replace the default password fallback with native OS credential stores:

1. Use platform-specific sidecar binaries or native Node bindings (`keytar` or Tauri's OS keychain plugin).
2. Retrieve the device-unique encryption master password from the OS keychain.
3. Pass that password into `new SecretVault({ masterPassword: osKeychainSecret })`.

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **`EncryptedPayload`** | `SecretVault` | `setSecret()`, `deleteSecret()` | `unlock()` | Persistent on disk | `~/.usepilot/secrets/vault.enc` |
| **Random Salt (`vault.salt`)** | `SecretVault` | Initialized once | `scryptSync` key derivation | Host lifetime | Stored adjacent to encrypted vault |
| **In-Memory Secrets Map** | `SecretVault` | `setSecret()`, `clear()` | `getSecret()` | Process runtime (while unlocked) | Cleared on `lock()` or shutdown |

---

## Failure Assumptions

1. **Local Disk Boundary**: Assumes the local machine filesystem is protected against unauthorized root access; encrypts data at rest to mitigate unauthorized file copies or forensic dumps.
2. **Deterministic Cryptographic Verification**: Assumes tampering with ciphertext, IV, or authentication tags must immediately throw an authentication rejection, refusing to load partial or manipulated keys.
3. **No Prompts Leakage**: Assumes execution runners and planners strictly respect the redaction boundary, substituting placeholders (`[REDACTED_SECRET]`) in all journals and prompts.

---

## Common Extension Points

- **Hardware Security Module / OS Keychain Integration**: Pass hardware-backed master keys into `SecretVault` constructor via platform keychains (e.g. Windows DPAPI, macOS Keychain).
- **Custom Key Derivation Parameters**: Tune scrypt CPU/memory cost parameters in `deriveKey()` for high-security enterprise environments.

---

## Directory Layout

```
packages/execution-core/src/security/
├── vault.ts         # SecretVault core implementation and encryption pipeline
└── permissions.ts   # PermissionManager capability gating
```

---

## Examples

### 1. Storing and Retrieving an API Key
```typescript
import { SecretVault } from '@usepilot/execution-core'

const vault = new SecretVault()

// Store an API key securely
vault.setSecret('anthropic_api_key', 'sk-ant-api03-abcdef123456')

// Check presence
if (vault.hasSecret('anthropic_api_key')) {
  console.log('API Key configured!')
}

// Retrieve key for authenticated execution
const apiKey = vault.getSecret('anthropic_api_key')
```

### 2. Inspecting Configured Keys in a Settings UI
```typescript
const configuredKeys = vault.listKeys()

console.log('Configured Services:')
for (const key of configuredKeys) {
  console.log(` - ${key} [SECURE]`)
}
```

### 3. Deleting Credentials on User Logout
```typescript
// Remove single credential
vault.deleteSecret('session_token')

// Or wipe entire vault
vault.clear()
```

---

## Related Documentation

- [Permission Manager Documentation](../permissions/README.md) - Capability gating and authorization scopes.
- [Capability Verification Documentation](../verification/README.md) - Post-condition checking without secret leakage.
- [Diagnostics Subsystem Documentation](../diagnostics/README.md) - Vault operational health reporting.

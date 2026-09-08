# Secure Secret Vault

The Secret Vault stores sensitive user credentials, session cookies, and API keys with military-grade local encryption.

## Encryption Architecture

- **Algorithm**: AES-256-GCM (Galois/Counter Mode) authenticated symmetric cipher.
- **Key Derivation**: PBKDF2 with SHA-256 (100,000 rounds) using a 16-byte random salt.
- **Initialization Vector**: Cryptographically secure random 12-byte IV per encrypted secret.
- **Authentication**: 16-byte GCM authentication tag guaranteeing ciphertext integrity and tamper detection.

## Zero Plaintext Rule

1. Secrets are encrypted in memory prior to persistence.
2. Plaintext secrets are never stored to disk or database tables unencrypted.
3. Execution journals, manifests, reports, and logs redact secret values as `[REDACTED_SECRET]`.
4. Planner prompts and LLM contexts are strictly barred from receiving raw vault contents.

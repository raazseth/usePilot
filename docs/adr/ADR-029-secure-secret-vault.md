# ADR-029: Secure Secret Vault with Zero Plaintext Persistence

## Context
Automating authentications, banking workflows, and GST portal downloads requires handling sensitive user credentials, session tokens, API keys, and cookie jars. Persisting credentials in plaintext or leaking them into journals, execution manifests, or planner prompts represents a critical security risk.

## Decision
Implement `SecretVault` using military-grade authenticated cryptography:
1. **AES-256-GCM Encryption**: Encrypts secret payloads using AES-256-GCM with distinct cryptographically random 12-byte initialization vectors (IV) and 16-byte authentication tags per entry.
2. **PBKDF2 / Scrypt Key Derivation**: Derives strong 256-bit encryption keys from machine-bound master passwords using 100,000 iterations of PBKDF2-SHA256 and 16-byte unique salts.
3. **Zero Plaintext Persistence**: Secrets are encrypted in-memory before being written to local storage. Plaintext secrets are never written to disk or logs.
4. **Log & Manifest Sanitization**: Execution journals, reports, and manifests explicitly redact secret keys, masking them as `[REDACTED_SECRET]` to prevent accidental exposure in audits or telemetry.

## Consequences
- Guaranteed zero-knowledge secret storage on the local client machine.
- Secure, hands-free authentication for automated business workflows.

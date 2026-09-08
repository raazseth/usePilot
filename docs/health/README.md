# Runtime Health Monitoring

The Runtime Health Monitor tracks subsystem availability, active sessions, and failure-to-recovery ratios.

## Subsystem Health Matrix

| Subsystem | Key Checks | Degraded Conditions |
|---|---|---|
| **Browser** | Active context count, open pages, crash recovery | >5 consecutive navigation failures |
| **Filesystem** | Base directory write permission, disk space | >3 atomic write/move failures |
| **Desktop** | Win32/PowerShell driver readiness | Shell command execution timeouts |
| **Vision** | Local Tesseract.js worker status | Worker initialization or recognition failure |
| **Vault** | AES-256-GCM cipher integrity | Encryption / decryption key errors |
| **Permissions** | Active grants table, approval gate status | Policy resolution exceptions |

Reports are accessible via the desktop diagnostics dashboard at `/diagnostics`.

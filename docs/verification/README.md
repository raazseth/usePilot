# Capability Verification

Capability Verification enforces the core rule: **Execution success ≠ Adapter success**.

Adapters may report successful execution of commands, but tasks are only deemed completed when independent capability-specific verifiers inspect actual system state.

## Verifiers

### BrowserStateVerifier
- Validates page loaded state (`domcontentloaded`, `networkidle`).
- Verifies current URL matches target route or pattern.
- Confirms expected elements exist and are visible in the live DOM.
- Checks downloaded file presence on disk.

### FilesystemVerifier
- Confirms target file exists on disk.
- Compares SHA-256 cryptographic checksum against expected hash.
- Validates directory structure and non-zero file sizes.

### DesktopStateVerifier
- Reads back OS clipboard to verify text was written accurately.
- Inspects system process table to confirm target applications are running.
- Checks window focus and response status.

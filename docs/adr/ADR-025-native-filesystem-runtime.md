# ADR-025: Native Filesystem Runtime with Atomic Swap & Cryptographic Checksums

## Context
Filesystem automation requires absolute reliability. Partial writes, interrupted saves, cross-device move failures, and path traversal attacks can corrupt user workspaces and documents.

## Decision
Implement `NativeFilesystemAdapter` supporting `read_file`, `write_file`, `move_file`, `copy_file`, `delete_file`, `rename_file`, `create_directory`, and `search_files`:
1. **Atomic Write-Swap Pattern**: `write_file` writes data to an adjacent temporary file (`.<name>.<timestamp>.tmp`), flushes buffers to disk, and executes an atomic rename/swap over the target file, guaranteeing zero data corruption.
2. **Cross-Device Move Fallback**: `move_file` attempts atomic `rename()`; if an `EXDEV` cross-device boundary error is encountered, it seamlessly falls back to stream copy followed by source unlink.
3. **Cryptographic Checksumming**: Computes SHA-256 digests on write and move operations to provide tamper detection and independent verification.
4. **Platform-Safe Path Normalization**: Resolves and normalizes Windows and POSIX paths, preventing traversal escapes and invalid character issues.
5. **Glob & Extension Filters**: `search_files` supports recursive traversal with extension filtering, filename matching, and regex queries.

## Consequences
- Guarantees crash-safe, deterministic file operations on Windows and future platforms.
- Supports high-throughput workspace organization without file corruption.

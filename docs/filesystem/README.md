# Native Filesystem Runtime

The Filesystem Runtime enables safe, deterministic, atomic filesystem operations across user directories.

## Capabilities

- `read_file`: Reads UTF-8 text or raw buffers with path boundary enforcement.
- `write_file`: Atomic temp-swap write guaranteeing crash safety and zero data corruption.
- `move_file`: Atomic file rename with cross-device copy-and-unlink fallback.
- `copy_file`: Stream-based file duplication with metadata preservation.
- `delete_file`: Safe unlinking of files and directory trees.
- `rename_file`: Targeted file renaming.
- `create_directory`: Recursive directory tree creation.
- `search_files`: Recursive glob and extension matching with file metadata.

## Atomic Write Safety

```
Target File: invoices/2026-08.pdf
Write Step 1: Write to invoices/.2026-08.pdf.<timestamp>.tmp
Write Step 2: Flush buffers to disk
Write Step 3: Atomic rename tmp -> target
Result: File is never in a half-written state if process terminates.
```

## Checksum Verification

Every write and move generates a SHA-256 cryptographic digest that the independent `FilesystemVerifier` validates prior to marking a task completed.

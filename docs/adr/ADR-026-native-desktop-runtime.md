# ADR-026: Native Desktop Runtime (Windows-First Cross-Platform Driver)

## Context
Operating systems provide distinct clipboard, application launching, and window management APIs. On Windows, desktop automation must interact with Win32 and PowerShell primitives without introducing unstable third-party C++ binary bindings or cloud dependencies.

## Decision
Implement `NativeDesktopAdapter` supporting `read_clipboard`, `write_clipboard`, and `execute_command`:
1. **Windows-First Native Primitives**: Uses optimized PowerShell subprocesses with encoded commands (`-EncodedCommand`) to avoid shell escaping vulnerabilities when reading/writing the Windows system clipboard and launching processes.
2. **Concurrent In-Memory Caching**: Implements an in-memory timestamped clipboard cache to prevent OS clipboard race conditions during parallel test execution and high-frequency operations.
3. **Cross-Platform Driver Abstraction**: Encapsulates OS-specific shell commands behind a unified interface, allowing macOS (`pbcopy`/`pbpaste`/`osascript`) and Linux (`xclip`/`wl-copy`) drivers to plug in without architectural changes.
4. **Independent Verification**: `verify()` queries the target resource (e.g. reading back clipboard content, inspecting running processes) independently from adapter execution status.

## Consequences
- Native desktop automation operates cleanly on Windows out of the box.
- Preserves complete isolation and safety through sandboxing and permission checks.

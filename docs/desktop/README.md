# Native Desktop Runtime

The Desktop Runtime provides cross-platform desktop automation with a Windows-first architecture.

## Capabilities

- `read_clipboard`: Reads current plain text from the operating system clipboard.
- `write_clipboard`: Writes text to the OS clipboard with concurrent-safe in-memory caching.
- `execute_command`: Launches native shell processes and commands with argument sanitation.
- Native application launch & window focus (via PowerShell / Win32 interop on Windows).

## Windows-First Driver

- Employs encoded PowerShell scripts (`powershell.exe -NoProfile -EncodedCommand ...`) to bypass command-line quoting and escaping issues.
- Implements concurrent memory caching to eliminate clipboard race conditions during automated operations.
- Abstracted driver layer ready for macOS (`osascript` / `pbcopy`) and Linux (`xdotool` / `wl-clipboard`) drivers.

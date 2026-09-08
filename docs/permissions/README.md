# Permission Manager

The Permission Manager controls access to privileged capabilities and resources on the user's computer.

## Permission Scopes

| Scope | Lifetime | Storage |
|---|---|---|
| `once` | Single task execution | Transient in memory |
| `session` | Active execution run | Execution session memory |
| `always` | Indefinite across app launches | Local encrypted database |

## Permission Domains

- `browser`: Network navigation, web cookies, CDP controls.
- `filesystem`: Read, write, delete, and directory manipulation across specific file paths.
- `clipboard`: Accessing and writing system clipboard content.
- `desktop`: Launching native applications and executing shell commands.
- `network`: External HTTP endpoints and network calls.

## ApprovalGate Integration

When a capability requires a permission grant that is not currently active, execution halts and presents an interactive `PermissionPrompt` to the user. Execution resumes only upon affirmative grant.

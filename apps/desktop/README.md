# Desktop Application

Desktop Application (`apps/desktop`) is the native graphical interface for usePilot, integrating a Tauri v2 native desktop shell with a React 19 frontend and an out-of-process WebSocket/HTTP bridge to the local backend runtime for task orchestration, approval gates, context inspection, and forensic diagnostics.

---

## Purpose

Automated desktop and browser agents require constant bidirectional communication between the user and the execution engine:
- Users need to converse with the agent, inspect proposed multi-step execution blueprints, and configure local API credentials.
- Autonomous operations require human-in-the-loop authorization gates when accessing privileged files, system clipboards, or executing financial transactions.
- Long-running workflows demand real-time streaming feedback: live browser viewport feeds, active task execution status cards, and verification postcondition checks.
- Post-execution analysis requires an interactive debugger to inspect runtime entity graphs, search indexed documents, and scrub stepped observation replays.

The Desktop Application owns:
- The Tauri v2 native desktop window lifecycle, window title management, and OS system browser opening.
- Out-of-process communication bridge connecting the frontend to the Bun backend sidecar via local IPC, HTTP, and WebSockets.
- Centralized reactive application state management using Zustand (`useAppStore`).
- Multi-route client architecture (`/`, `/chat/:conversationId`, `/context`, `/diagnostics`, `/settings`).
- Live execution monitoring components: planning progress trackers, task cards, browser activity viewports, and permission dialogs.
- Interactive context inspection panels for entity graphs, knowledge items, and stepped observation replay scrubbing.

The Desktop Application intentionally does NOT own:
- Low-level browser automation or Playwright socket connections (owned by the backend execution engine).
- Physical filesystem atomic operations or AES-256-GCM vault persistence (owned by backend adapters).
- Agent planning algorithms or graph evaluation algorithms.

---

## Design Principles

### 1. Process Separation (Rust Shell + Web Frontend + Bun Sidecar)
The application architecture enforces strict process boundaries:
1. **Native Shell (Rust / Tauri v2)**: Lightweight binary managing native OS windows, desktop menus, and system tray integration.
2. **User Interface (React 19 / TypeScript)**: Renders the interface in a secure Webview without direct node.js bindings or native binary compilation risks.
3. **Execution Sidecar (Bun / Node.js)**: Runs all heavy automation engines, browser child processes, filesystem adapters, and OCR neural workers as an independent process communicating over loopback WebSockets.

### 2. Zero Hardcoded Ports via IPC Port Handshake
The backend sidecar selects an available local port dynamically at startup. The Tauri native state manager (`BackendPortState`) receives the port and exposes it to the React frontend via a typed IPC query (`get_backend_port`). The frontend initializes its HTTP and WebSocket clients dynamically, preventing port collisions with other development servers or local applications.

### 3. Unified Reactive State Store
All backend push events (planning stage updates, task progress events, verification results, self-healing retries, and permission prompts) are ingested over a single typed WebSocket connection into a centralized Zustand store (`useAppStore`). Components consume reactive state slices without managing independent network listeners.

### 4. Non-Blocking Human-in-the-Loop Interruption
When an execution requires human authorization or encounters an unknown permission request, the execution engine halts asynchronously. The desktop application displays an interactive modal (`PermissionPrompt` or `ApprovalGate`), allowing the user to inspect the exact action and choose an authorization scope (`once`, `session`, `always`) before signaling the backend to resume.

---

## Design Tradeoffs

| Decision | Alternative Considered | Why This Approach Was Chosen |
|---|---|---|
| **Tauri v2 + Rust shell + Bun backend sidecar** | Monolithic Electron app | Electron bundles full Chromium and Node.js instances, producing large 150MB+ installers and high idle memory (300MB+). Tauri utilizes the OS native webview (~15MB installer, ~40MB idle RAM) while process isolation keeps the backend automation crash-resilient. |
| **Dynamic IPC port handshake (`get_backend_port`)** | Hardcoded port (e.g. `3001`) | Hardcoded ports cause startup failures if multiple instances run or if another local developer service binds the same port. Handshaking ensures 100% reliable local loopback binding. |
| **Unified Zustand store (`useAppStore`)** | Multiple disconnected Context providers | A single observable store eliminates prop-drilling, simplifies complex cross-panel updates (e.g. timeline scrubbing updating replay viewports and active tab highlights), and ensures consistent WebSocket state synchronization. |
| **Local loopback WebSocket/HTTP communication** | In-process native FFI bindings | Separating the backend sidecar over loopback HTTP/WebSocket allows running the automation engine headless in CI/CD or CLI environments without touching desktop GUI code. |

---

## Invariants and Guarantees

1. **Process Independence**: A fatal error or crash in the backend sidecar process will never crash the Tauri desktop window; the UI detects WebSocket disconnection and displays a reconnection overlay.
2. **Loopback Only**: All IPC, WebSocket, and HTTP traffic binds exclusively to `127.0.0.1`. Under no circumstances does the desktop application bind backend listeners to public network interfaces (`0.0.0.0`).
3. **Single Source of UI Truth**: All reactive streaming telemetry (tasks, steps, approvals, replays) is piped directly into `useAppStore`. Individual views and components read state slices from this store.
4. **Zero State Mutation Outside Actions**: Zustand state is never modified directly via component-level assignment; state transitions must occur via defined store actions (`setExecutionStatus`, `addMessage`, `updateTask`).

---

## Failure Modes and Recovery

| Failure Scenario | Detection Mechanism | Subsystem Recovery Behavior | What Recovery Intentionally Does NOT Do |
|---|---|---|---|
| **Backend sidecar disconnects** | WebSocket `onclose` or `onerror` event | Enters exponential backoff reconnection loop; displays offline banner. | Does not terminate the desktop GUI window. |
| **IPC port query timeout** | `invoke('get_backend_port')` rejects | Retries up to 5 times with 500ms backoff before showing sidecar startup error modal. | Does not connect to arbitrary random ports. |
| **Artifact preview missing on disk** | HTTP GET `/api/artifacts/:id` returns 404 | Renders broken artifact placeholder card with error message. | Does not throw unhandled exception or break timeline. |
| **Approval prompt ignored / Timed out** | User does not interact with approval modal | Engine remains halted awaiting response; user can explicitly reject or cancel task. | Does not auto-approve privileged operations. |

---

## Things To Avoid

- **Do NOT bypass `apiClient` or `invokeQuery`**: Always communicate with the backend using the established HTTP/IPC client utilities to ensure port configuration and error handling are honored.
- **Do NOT execute heavy Node.js automation logic inside frontend components**: The desktop frontend is purely a presentation layer; delegate all automation, browser control, and file manipulation to the backend sidecar.
- **Do NOT hardcode loopback ports**: Always fetch the active backend port via `get_backend_port`.
- **Do NOT mutate store state directly**: Use defined Zustand actions to maintain predictable reactivity and state traceability.

---

---

## Where It Fits

The Desktop Application sits in `apps/desktop/` and serves as the primary user-facing client for the monorepo packages.

```
+-------------------------------------------------------------------------+
|                       Tauri v2 Native Shell (Rust)                      |
|  - Window creation, title bar, OS system browser invocation             |
|  - Manages BackendPortState                                             |
+-------------------------------------------------------------------------+
                                     |
                                     | Webview embedding & Tauri IPC
                                     v
+-------------------------------------------------------------------------+
|                       React 19 Frontend (TypeScript)                    |
|  - Routes: /chat, /context, /diagnostics, /settings                     |
|  - Global State: useAppStore (Zustand)                                  |
|  - Components: AppShell, ChatRoute, ContextViewer, ReplayScrubber       |
+-------------------------------------------------------------------------+
             |                                              |
             | Typed HTTP Queries                           | Real-time WebSocket
             v                                              v
+-------------------------------------------------------------------------+
|                        Backend Runtime Sidecar                          |
|         (@usepilot/execution-core, @usepilot/runtime-context)           |
+-------------------------------------------------------------------------+
```

### Callers and Collaborators
- **Tauri IPC (`src-tauri/src/lib.rs`)**: Exposes native commands (`set_backend_port`, `open_external`, `set_window_title`, `get_backend_port`, `get_app_version`, `get_app_data_dir`).
- **Backend API (`shared/api/`)**: `apiClient` dispatches REST queries; `wsManager` maintains real-time bidirectional message streaming.
- **Planner & Execution Engines**: Stream progress, journal entries, and metrics into the frontend for rendering.

---

## Architecture

```
apps/desktop/
├── src-tauri/               # Native Rust Tauri v2 shell
│   ├── Cargo.toml           # Rust dependencies (tauri, tauri-plugin-opener)
│   ├── tauri.conf.json      # Window dimensions, permissions, and build config
│   `-- src/
│       ├── main.rs          # Executable entry point
│       `-- lib.rs           # IPC commands, queries, and BackendPortState
└── src/                     # React 19 Frontend
    ├── App.tsx              # Root router and initialization shell
    ├── main.tsx             # DOM mounting entry
    ├── routes/              # Route views (Chat, Context, Diagnostics, Settings)
    ├── components/          # Reusable UI elements, layout shells, execution cards
    ├── shared/              # API clients, Tauri IPC invocations, and Zustand stores
    └── styles/              # Design tokens, themes, and CSS variables
```

### Component Roles

| Directory / File | Responsibility |
| :--- | :--- |
| `src-tauri/src/lib.rs` | Rust backend managing `BackendPortState`, native window titles, external URL launching, and IPC query handlers. |
| `src/shared/store/appStore.ts` | Centralized Zustand application store managing conversations, blueprint plans, task execution cards, active capabilities, and permission prompts. |
| `src/shared/api/` | Typed API communication layer (`tauri.ts` for native IPC, `client.ts` for HTTP requests, `websocket.ts` for push event subscriptions). |
| `src/routes/` | Page components for Chat, Context inspection, Runtime Diagnostics, Settings, and Welcome screens. |
| `src/components/layout/AppShell.tsx` | Main application frame providing the responsive sidebar, status header, activity bar, and toast notifications. |

---

## Core Concepts

### 1. Application Routing Topology

The frontend uses `react-router-dom` to provide clear workspace separation:

```typescript
<Routes>
  <Route path="/" element={<WelcomeRoute />} />
  <Route path="/chat/:conversationId" element={<ChatRoute />} />
  <Route path="/context" element={<ContextRoute />} />
  <Route path="/diagnostics" element={<DiagnosticsRoute />} />
  <Route path="/settings" element={<SettingsRoute />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

- `/`: Welcome screen displaying recent conversations, prompt input, and quick-start actions.
- `/chat/:conversationId`: Primary execution workspace showing conversation history, interactive blueprint cards, real-time task progress, and live browser activity viewports.
- `/context`: Deep inspection console providing tabs for the Knowledge Store, Entity Graph, Runtime Index search, and stepped Observation Replay player.
- `/diagnostics`: Telemetry dashboard displaying subsystem health states (`healthy`, `degraded`, `unhealthy`), active leak warnings, and performance breakdowns.
- `/settings`: Configuration console for local API keys, model selection, permission grant management, and storage paths.

### 2. Reactive Zustand Store Structure (`AppState`)

```typescript
interface AppState {
  // Initialization & Connections
  status: 'initializing' | 'ready' | 'error'
  backendPort: number | null
  wsStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  settings: Settings | null
  conversations: ConversationSummary[]
  activeConversationId: string | null

  // Planner Domain
  planningProgress: PlanningProgressState | null
  activeBlueprint: ExecutionBlueprint | null
  planningError: string | null

  // Execution Domain
  executionStatus: ExecutionStatus | null
  executionRunId: string | null
  taskStatuses: Record<string, TaskExecutionStatus>
  taskProgress: { completed: number; total: number; currentTaskTitle: string | null }
  pendingApproval: ApprovalRequest | null
  executionJournal: JournalEntry[]
  executionMetrics: Partial<ExecutionMetrics> | null
  lastExecutionReport: ExecutionReport | null

  // Live Capability Telemetry
  browserActivity: {
    url?: string
    title?: string
    screenshot?: string
    activeTab?: number
    action?: string
  } | null
  activeCapability: string | null
  activeAdapterInfo: string | null
  verificationStatus: { taskId?: string; passed: boolean; strategy: string } | null
  recoveryAttempts: Array<{ taskId: string; stage: string; message: string; succeeded: boolean }>
  permissionPrompt: PermissionPromptRequest | null
}
```

---

## Data Flow

```
1. Application Launch
   Tauri opens native Webview -> React mounts App.tsx
      |
      v
2. Handshake & Initialization
   useAppStore.initialize()
   - invokeQuery('get_backend_port') via Tauri IPC
   - Establish ws://127.0.0.1:<port> connection
   - Fetch settings and conversation summaries via apiClient
   - Set app status = 'ready'
      |
      v
3. User Starts Task in /chat
   User enters: "Download the latest invoice from Acme Portal"
   - POST /api/conversations/:id/messages
   - Backend Planner emits planning progress over WebSocket
   - Frontend updates planningProgress state
      |
      v
4. Plan Blueprint Generated
   - Backend emits activeBlueprint
   - Frontend renders interactive BlueprintCard
   - User clicks "Execute Blueprint"
      |
      v
5. Execution Streaming
   Backend streams execution events over WebSocket:
   - task_started: updates taskStatuses[taskId] = 'running'
   - browser_activity: updates browserActivity viewport image
   - verification_result: renders verification badge
   - self_healing: appends to recoveryAttempts[]
      |
      v
6. Execution Completion
   - executionStatus = 'completed'
   - Renders ExecutionReport and metrics summary
```

---

## Public API and IPC Interface

### Tauri Native IPC (`src-tauri/src/lib.rs`)

#### Native Commands (Mutations)
```rust
// Stores the dynamically allocated backend port
set_backend_port(port: u16, state: State<BackendPortState>)

// Launches a URL in the user's default desktop browser
open_external(url: String, app: AppHandle) -> Result<(), String>

// Sets the OS window title
set_window_title(title: String, app: AppHandle) -> Result<(), String>
```

#### Native Queries (Reads)
```rust
// Retrieves the active backend port for WebSocket / HTTP connections
get_backend_port(state: State<BackendPortState>) -> Option<u16>

// Retrieves application package version
get_app_version(app: AppHandle) -> String

// Resolves local OS application data directory
get_app_data_dir(app: AppHandle) -> Result<String, String>
```

---

### Frontend IPC Bridge (`src/shared/api/tauri.ts`)

```typescript
// Type-safe wrapper invoking Tauri native queries
export async function invokeQuery<K extends keyof IPCQueryMap>(
  command: K,
  args?: IPCQueryMap[K]['args']
): Promise<IPCQueryMap[K]['result']>
```

---

## Internal Components

### 1. Initialization Sequence (`initialize`)
In `apps/desktop/src/shared/store/appStore.ts`:
```typescript
initialize: async () => {
  try {
    const port = await invokeQuery('get_backend_port')
    if (!port) throw new Error('Backend port not available')

    set({ backendPort: port })
    apiClient.setBaseUrl(`http://127.0.0.1:${port}`)
    wsManager.connect(`ws://127.0.0.1:${port}`)

    const [settings, conversations] = await Promise.all([
      apiClient.getSettings(),
      apiClient.getConversations(),
    ])

    set({ settings, conversations, status: 'ready' })
  } catch (err) {
    set({ status: 'error', error: String(err) })
  }
}
```
If the backend sidecar is not yet ready, the initialization renders a retryable error screen.

### 2. Live Browser Viewport Component
Located in `src/components/execution/BrowserViewport.tsx`. Subscribes to `state.browserActivity` and renders real-time PNG frames transmitted over the WebSocket, with an overlay showing the current active URL and navigation actions.

---

## Lifecycle

```
[Native App Starts (Tauri Shell)]
             |
             v
[Tauri provisions window & runs lib::run()]
             |
             v
[React Mounts main.tsx -> App.tsx]
  - Displays Spinner ("Starting usePilot...")
  - Queries get_backend_port
  - Connects WebSocket
             |
             v
[Status Transitions to 'ready']
  - Renders AppShell and Router
             |
             v
[User Navigates Routes]
  - /chat: Converses with agent, executes blueprints
  - /context: Inspects graphs, scrubs replays
  - /diagnostics: Reviews system health reports
  - /settings: Updates vault keys & permissions
             |
             v
[Window Close / Exit]
  - Tauri terminates Webview
  - WebSocket disconnected cleanly
```

---

## Error Handling

### 1. Backend Disconnection Resilience
If the WebSocket drops (e.g. backend process restart), `wsManager` transitions status to `'disconnected'` and attempts automatic reconnect with exponential backoff. The UI displays a warning banner without wiping loaded conversation history.

### 2. Startup Fallback Screen
If the native handshake fails or the sidecar process fails to allocate a port, `App.tsx` catches the error and displays a structured error screen with a "Retry" button rather than a blank white screen.

---

## Thread Safety and Concurrency

- **Rust Mutex Synchronization**: In `src-tauri/src/lib.rs`, `BackendPortState` wraps the port in a thread-safe `std::sync::Mutex<Option<u16>>`.
- **Zustand Batching**: State updates in `appStore` leverage React 19's automatic batching to avoid unnecessary re-renders during high-frequency WebSocket event bursts.

---

## Performance Characteristics

| Operation | Performance Profile |
| :--- | :--- |
| **Native Startup** | ~150 - 300 ms (Tauri v2 native window allocation). |
| **Webview Load** | ~50 - 100 ms (local Vite bundle assets). |
| **WebSocket Event Dispatch** | < 1 ms from TCP receive to Zustand state update. |
| **Viewport Screenshot Streaming** | 30 - 60 FPS capable over local loopback connection. |

---

## Testing Strategy

Tests reside in `apps/desktop/src/__tests__/`:

- **Component Rendering**: Verifies that `AppShell`, `Spinner`, and route wrappers mount without unhandled errors.
- **Store State Transitions**: Tests that `setPlanningProgress()`, `setActiveBlueprint()`, and `resetExecution()` transition store properties deterministically.
- **Tauri Mocking**: Validates IPC queries using mock Tauri runtime handlers.
- **WebSocket Reconnection**: Asserts that `wsStatus` accurately transitions between `'connecting'`, `'connected'`, and `'disconnected'`.

---

## Extension Guide

### Adding a New Route and View

1. Create the route component in `apps/desktop/src/routes/new-feature.tsx`.
2. Add the route path in `apps/desktop/src/App.tsx`:
   ```tsx
   <Route path="/new-feature" element={<NewFeatureRoute />} />
   ```
3. Add a navigation item in `apps/desktop/src/components/layout/Sidebar.tsx`.

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **Tauri Window** | Tauri v2 Native Runtime | User / Rust Window APIs | OS Display Server | Desktop application lifetime | OS Window Manager |
| **`useAppStore` State** | Zustand Store | WebSocket events, UI actions | React Views & Components | Frontend session | Memory-only (re-synced from backend) |
| **Backend Port State** | Tauri Native Shell (`lib.rs`) | Sidecar launcher | Frontend IPC query | Application runtime | Kept in Tauri managed state |
| **Active Route State** | React Router | User navigation | App layout | Browser session | In-memory routing |

---

## Failure Assumptions

1. **Process Independence**: Assumes crashes or exceptions in the backend automation engine do not terminate the Tauri window; the UI displays a reconnection banner while retrying.
2. **Loopback Only**: Assumes all IPC, HTTP, and WebSocket communication occurs over `127.0.0.1` and never routes over public network adapters.
3. **Graceful IPC Fallback**: Assumes that in standalone web browser development mode where Tauri IPC is unavailable, `invokeQuery` degrades cleanly to mock fallbacks.

---

## Common Extension Points

- **Adding a New Navigation Route**: Define route component in `src/routes/` and register in `src/App.tsx` routes configuration.
- **Adding a New Reactive Telemetry Slice**: Extend `useAppStore` in `src/shared/store/appStore.ts` with new state properties and corresponding WebSocket event handlers.

---

## Directory Layout

```
apps/desktop/
├── src-tauri/          # Tauri v2 native Rust shell
│   ├── Cargo.toml      # Rust crate configuration
│   ├── tauri.conf.json # Tauri window and security configuration
│   `-- src/lib.rs      # Native commands, queries, and port state
└── src/                # React 19 frontend
    ├── App.tsx         # Root component and router definitions
    ├── main.tsx        # React mounting entry
    ├── routes/         # Page routes (chat, context, diagnostics, settings)
    ├── components/     # UI primitives and execution cards
    ├── shared/         # Zustand store and API bridges
    └── styles/         # Global themes and CSS custom properties
```

---

## Examples

### 1. Invoking Native Queries via the IPC Bridge
```typescript
import { invokeQuery } from './shared/api/tauri'

// Retrieve current backend port
const port = await invokeQuery('get_backend_port')
console.log('Backend connected on port:', port)

// Retrieve application data directory
const dataDir = await invokeQuery('get_app_data_dir')
console.log('App Data Path:', dataDir)
```

### 2. Consuming Execution State in a Component
```typescript
import { useAppStore } from '../shared/store/appStore'

export function ExecutionStatusBadge() {
  const status = useAppStore((state) => state.executionStatus)
  const taskProgress = useAppStore((state) => state.taskProgress)

  if (!status) return null

  return (
    <div className={`status-badge status-${status}`}>
      <span>Status: {status.toUpperCase()}</span>
      <span>Tasks: {taskProgress.completed} / {taskProgress.total}</span>
    </div>
  )
}
```

---

## Related Documentation

- [Runtime Diagnostics Subsystem](../docs/diagnostics/README.md) - Telemetry displayed in `/diagnostics`.
- [Runtime Context Documentation](../docs/runtime-context/README.md) - State inspected in `/context`.
- [Permission Manager Documentation](../docs/permissions/README.md) - Security authorizations managed in `/settings`.

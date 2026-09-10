# Browser Runtime Subsystem

Browser Runtime (`@usepilot/execution-core/src/adapters/browser`) controls multi-tab web automation using Playwright, managing process lifecycles, user profile persistence, download streaming, DOM extraction, credential injection, and locator self-healing.

---

## Purpose

Web automation in an autonomous desktop assistant requires balancing four competing constraints:
1. **Local-First Zero-Download Startup**: Requiring end users to download 400MB+ bundled Chromium binaries on first launch degrades user experience and consumes unnecessary bandwidth.
2. **Session Persistence**: Automated workflows frequently interact with authenticated services (Google Workspace, AWS Console, internal intranets, ERP portals). Requiring users to log in or pass 2FA challenges on every single task run renders task automation impractical.
3. **Selector Mutation Resilience**: Real-world websites constantly change their DOM trees, dynamic CSS class names, and button IDs. Rigid selectors fail quickly without an intelligent locator recovery cascade.
4. **Independent Postcondition Verification**: An automated web task cannot be marked completed simply because an HTTP navigation or click did not throw an unhandled exception. The runtime must verify that the target URL loaded, DOM elements appeared, or the requested file actually reached disk.

### What It Owns

- **Browser Process & Context Management**: Probing, launching, reusing, and closing browser contexts across Chromium, Microsoft Edge, Google Chrome, Brave, and Mozilla Firefox.
- **Session Profile Persistence**: Storing and restoring cookies, local storage, and session tokens within user data directories (`~/.usepilot/browser-profiles`).
- **Capability Execution**: Implementing five core web capabilities: `navigate_website`, `search_web`, `authenticate_user`, `extract_web_data`, and `download_file`.
- **Locator Self-Healing Cascade**: Integration with `SelfHealingPipeline` to locate elements via CSS/XPath selectors, semantic accessibility trees, visual layout coordinates, and OCR text matching.
- **Independent State Verification**: Validating page load states, HTTP status codes, element visibility, and downloaded file checksums after adapter execution.
- **Multi-Tab Orchestration**: Managing concurrent tabs within a single persistent browser context via index-based page switching.

### What It Does NOT Own

- **Natural Language Parsing & Planning**: It does not infer which website to visit or what data to extract; that is determined by `@usepilot/planner-core`.
- **Secret Storage**: Credentials injected into login forms are held and decrypted by `SecretVault`; the browser adapter only receives plaintext inputs at form fill time.
- **Perception Graph Compilation**: Visited URLs and form schemas are forwarded to `@usepilot/runtime-context` for topological graph tracking; the browser adapter does not maintain the entity relationship graph itself.

---

## Design Principles

### 1. System Channel Auto-Detection Over Bundled Binaries

Rather than forcing users to download bundled Playwright binaries, the runtime probes installed system browser channels. On Windows, it prioritizes native Microsoft Edge (`msedge`) and Google Chrome (`chrome`). This enables instantaneous launch (<600ms) utilizing already-installed browser binaries with native OS acceleration.

### 2. Adapter Session Reuse

Launching a browser process takes several hundred milliseconds; navigating through an authentication flow can take seconds. The `PlaywrightBrowserSession` remains alive across all related tasks in an execution plan. Subsequent tasks in the plan reuse the existing open page and context without restarting the browser process.

### 3. Cooperative Cancellation via AbortSignal

All browser operations (page navigation, locator polling, download waiting) listen to the `AdapterContext.signal`. If an operator pauses or cancels an execution run, browser actions terminate cooperatively without leaving orphaned background processes.

### 4. Four-Tier Locator Recovery

Element location never relies solely on brittle CSS selectors. When a selector fails, the locator cascade automatically falls back through:
```
1. DOM Selector (CSS / XPath / Placeholder)
        ↓
2. Semantic Tree (Accessibility role & label)
        ↓
3. Visual Analysis (Bounding box & screenshot)
        ↓
4. OCR Text Matching (Tesseract engine)
```

---

## Where It Fits

```text
                     ┌──────────────────────┐
                     │   ExecutionRunner    │
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │  CapabilityRegistry  │
                     └──────────┬───────────┘
                                │
                                ▼
                 ┌─────────────────────────────┐
                 │  PlaywrightBrowserAdapter   │
                 └──────────────┬──────────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        ▼                       ▼                        ▼
┌────────────────┐      ┌─────────────────┐      ┌───────────────┐
│Playwright-     │      │SelfHealing-     │      │VisionSubsystem│
│BrowserSession  │      │Pipeline         │      │(OCR / Canvas) │
└───────┬────────┘      └─────────────────┘      └───────────────┘
        │
        ├──────────────────────┬──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│Microsoft Edge │      │ Google Chrome │      │Firefox /      │
│(System msedge)│      │(System chrome)│      │Chromium       │
└───────────────┘      └───────────────┘      └───────────────┘
```

- `ExecutionRunner` calls `CapabilityRegistry.resolve('navigate_website', platform)`, which instantiates `PlaywrightBrowserAdapter` (priority 100).
- `PlaywrightBrowserAdapter` delegates tab management, page navigation, and downloads to `PlaywrightBrowserSession`.
- Form inputs, buttons, and scrape targets pass through `SelfHealingPipeline`. If selectors mutated, `VisionSubsystem` performs visual/OCR inspection to locate elements on the canvas.
- Upon completion, `BrowserStateVerifier` inspects the page state to provide independent verification.

---

## Architecture

### Component Diagram

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PlaywrightBrowserAdapter                        │
├────────────────────────────────┬───────────────────────────────────────┤
│ Capability Routing             │ - navigate_website                   │
│                                │ - search_web                          │
│                                │ - authenticate_user                   │
│                                │ - extract_web_data                    │
│                                │ - download_file                       │
├────────────────────────────────┼───────────────────────────────────────┤
│ Session Management             │ PlaywrightBrowserSession              │
│                                │ - Browser Context (UserDataDir)       │
│                                │ - Page Ring Buffer (tabs)             │
│                                │ - Downloads Directory                 │
├────────────────────────────────┼───────────────────────────────────────┤
│ Verification Hook              │ verify(ctx, result)                   │
│                                │ - URL matching                        │
│                                │ - DOM condition check                 │
│                                │ - State capture                       │
└────────────────────────────────┴───────────────────────────────────────┘
```

### Supported Capabilities

| Capability | Parameters (`toolConfig`) | Action | Verification |
|---|---|---|---|
| `navigate_website` | `url`, `waitUntil`, `timeout` | Navigates active page to target URL. Adds `https://` prefix if omitted. | Verifies `page.url()` is non-blank and matches requested destination. |
| `search_web` | `query`, `engine` | Submits URL-encoded search query to search engine endpoint. | Confirms URL navigation and non-empty page title. |
| `authenticate_user`| `username`, `password`, `userSelector`, `passSelector` | Fills credentials using self-healing locators and clicks submit. | Verifies post-submit URL transition or credential field absence. |
| `extract_web_data` | `selector` | Scrapes `innerText` from selector target up to 5,000 characters. | Validates non-empty text content matches criteria. |
| `download_file` | `selector`, `downloadButton` | Waits for browser download event, streams file to download path. | Verifies file existence on disk and non-zero byte size. |

---

## Core Concepts

### 1. Browser Engine Discovery & Channel Probing

When initialized, `PlaywrightBrowserSession` attempts to launch browser channels in order:

```typescript
// On Windows:
1. 'msedge'   (System Microsoft Edge)
2. 'chrome'   (System Google Chrome)
3. undefined  (Bundled Playwright Chromium fallback)

// On macOS & Linux:
1. 'chrome'   (System Google Chrome)
2. undefined  (Bundled Playwright Chromium fallback)
```

This ensures maximum platform compatibility without manual browser binary management.

### 2. Multi-Tab Session Coordination

Tabs are tracked in an indexed array (`private readonly pages: Page[]`):

```typescript
// Open new tab and set as active
const tab2 = await session.newTab('https://dashboard.example.com')

// Switch between tabs by index
await session.switchTab(0) // Return to first tab
```

All tabs share the same `BrowserContext`, meaning cookies, storage, and authentication state are shared seamlessly across tabs.

### 3. Persistent User Data Profiles

Profiles are saved to:
`~/.usepilot/browser-profiles/<engine>/`

This directory stores:
- Cookies (session cookies and persistent authentication tokens)
- LocalStorage and IndexedDB
- Service Worker registrations
- Cache files

When an automation workflow runs repeatedly, the user does not need to re-authenticate each time.

---

## Data Flow

```text
1. Task Dispatch
   ExecutionRunner -> adapter.execute(ctx)
          │
          ▼
2. Session Initialization
   adapter.initialize() -> session.initialize()
   [Probes msedge -> chrome -> chromium fallback]
          │
          ▼
3. Parameter Extraction & URL Normalization
   url = params.url || task.title
   fullUrl = normalizeUrl(url) // adds https:// if protocol omitted
          │
          ▼
4. Page Navigation & Event Waiting
   page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
          │
          ▼
5. Result Formatting
   output = { url: page.url(), title: await page.title(), status: 200 }
          │
          ▼
6. Independent Verification
   adapter.verify(ctx, result) -> BrowserStateVerifier
   [Checks actual page URL, title, and success conditions]
```

---

## Public API

### `PlaywrightBrowserAdapter`

```typescript
export class PlaywrightBrowserAdapter implements ICapabilityAdapter {
  readonly capability: TaskCapability
  readonly priority: number // 100
  readonly platformSupport: ('windows' | 'macos' | 'linux')[]
  readonly name: string // 'PlaywrightBrowserAdapter'

  constructor(capability: TaskCapability, options?: BrowserAdapterOptions)

  initialize(): Promise<void>
  isAvailable(): Promise<boolean>
  execute(ctx: AdapterContext): Promise<AdapterResult>
  verify(ctx: AdapterContext, result: AdapterResult): Promise<VerificationResult>
  cleanup(): Promise<void>
  dispose(): Promise<void>
}
```

### `PlaywrightBrowserSession`

```typescript
export class PlaywrightBrowserSession {
  readonly engine: BrowserEngine
  readonly headless: boolean
  readonly userDataDir: string
  readonly downloadsPath: string

  constructor(config?: BrowserSessionConfig)

  initialize(): Promise<void>
  getPage(): Page
  getContext(): BrowserContext
  newTab(url?: string): Promise<Page>
  switchTab(index: number): Promise<Page>
  captureScreenshot(): Promise<Buffer>
  recover(): Promise<boolean>
  close(): Promise<void>
}
```

---

## Error Handling & Self-Healing

1. **Navigation Timeout**: Default navigation timeout is 30 seconds with `waitUntil: 'domcontentloaded'`. If a server stalls or hangs on third-party tracking scripts, DOM content loaded still allows the task to succeed.
2. **Channel Launch Fallback**: If a requested channel (e.g. `chrome`) is not installed on the user machine, the error is caught silently and the launcher immediately advances to the next channel before falling back to bundled Chromium.
3. **Session Recovery**: If a page crashes (e.g. out-of-memory or target closed), `session.recover()` closes the dead page handle, opens a clean page on the existing browser context, and restores operability.
4. **Selector Mutation**: When standard CSS selectors fail to locate form fields or buttons, `SelfHealingPipeline` uses semantic accessibility roles and OCR visual detection to find the intended element coordinates and complete the click or fill action.

---

## Design Tradeoffs

### 1. `launchPersistentContext` vs. Ephemeral Incognito Contexts
Rather than launching disposable incognito browser windows per execution, the adapter defaults to `chromium.launchPersistentContext()` anchored in a user profile directory (`~/.usepilot/browser-profiles`).
- **Tradeoff**: Persistent profiles preserve user authentication sessions, SSO tokens, and cookies across runs, eliminating repetitive login flows and multi-factor authentication interruptions.
- **Cost**: Requires local disk storage and file-lock management to prevent concurrent profile corruption.

### 2. Multi-Channel Auto-Probing vs. Bundled-Only Chromium
Instead of mandating a 300MB bundled Chromium download, the launcher auto-probes installed channels (`msedge` on Windows, `chrome`, and bundled `chromium` fallback).
- **Tradeoff**: Maximizes out-of-the-box readiness on corporate workstations and Windows machines where Microsoft Edge is pre-installed, reducing initial download footprint.
- **Cost**: Requires channel-detection try-catch handling during cold starts.

### 3. Multi-Tab Single Context vs. Multi-Context Isolation
When multi-page workflows execute, tabs are spawned within the same `BrowserContext` rather than spinning up separate browser contexts.
- **Tradeoff**: Keeps RAM overhead bounded (~80MB–140MB total) and allows seamless session cookie sharing between popups and main tabs.
- **Cost**: Requires active tab index tracking (`activeTabIndex`) within `PlaywrightBrowserSession`.

---

## Invariants and Guarantees

1. **Active Page Consistency**: `session.getPage()` always points to the currently active tab. Switching tabs updates the internal pointer synchronously.
2. **Readiness Invariant**: Navigations wait for `'domcontentloaded'`. A page is never considered ready if the URL is `about:blank` or navigation threw an error.
3. **Clean Process Teardown**: Calling `adapter.dispose()` terminates all spawned pages and shuts down the underlying browser child processes cleanly. Zombie browser processes (`msedge.exe`, `chrome.exe`) are never leaked.
4. **Single-Owner Profile Lock**: A given persistent profile directory can only be held by one active browser session at a time to maintain database integrity.

---

## Failure Modes and Recovery

| Failure Mode | Detection | Automated Recovery | Non-Goals (What It Won't Do) |
|---|---|---|---|
| **Target Page Crash** | `page.isClosed()` or crash event | `session.recover()` creates a new page in the surviving context and navigates to the target. | Does not attempt to reconstruct lost in-memory JS form state. |
| **Missing System Browser** | Playwright spawn exception | Launcher catches error and immediately advances to the next channel in the probe sequence. | Does not attempt to download external browsers without user consent. |
| **Selector Disappearance** | 1,500ms visibility timeout | Escalates to `SelfHealingPipeline` (Semantic -> Visual -> OCR). | Does not use remote LLM calls in the recovery loop. |
| **Stalled Page Scripts** | 30s navigation ceiling | `domcontentloaded` triggers completion even if analytics or tracking scripts hang. | Does not wait indefinitely for network idle. |

---

## Things To Avoid

- **Do NOT instantiate a new browser adapter for every task.** Spinning up a new browser process for each task causes massive CPU spikes and destroys session context. Always reuse the active `BrowserSession`.
- **Do NOT close pages directly via `page.close()` without notifying the session.** Use session tab management so `activeTabIndex` and page pools remain synchronized.
- **Do NOT introduce arbitrary `page.waitForTimeout()` sleeps.** Rely on `locator.isVisible()`, `waitForSelector()`, or verification state checks. Arbitrary sleeps degrade performance and mask race conditions.
- **Do NOT execute concurrent actions on the same `Page` instance.** Playwright pages are not designed for parallel action dispatch. Tasks targeting the same tab must be serialized.

---

## Concurrency & Resource Cleanup

- **Session Ownership**: Browser contexts are managed as long-lived resources tracked by `ExecutionResourceManager`.
- **Process Teardown**: `adapter.dispose()` terminates all open pages, closes the `BrowserContext`, and shuts down the underlying browser engine process cleanly, preventing zombie `msedge.exe` or `chrome.exe` background processes.
- **Lock Management**: Playwright's persistent context uses native file locks within `userDataDir`. If another browser instance holds the lock, the session initiates clean fallback to prevent file corruption.

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **Browser Process** | `PlaywrightBrowserAdapter` | Launcher | OS Process Manager | Execution run | Ephemeral process; killed on `dispose()` |
| **Browser Context** | `BrowserSession` | Adapter, Navigation calls | Adapter, Tracing | Plan duration | Cookies/Storage in `~/.usepilot/browser-profiles` |
| **Active Page** | `BrowserSession` | Tab switcher, Navigators | Automation tasks, Self-Healing | Dynamic per tab | Cleared when tab closes |
| **Trace Archives** | `BrowserTraceRecorder` | Playwright Tracing | Artifact Manager, Diagnostics | Post-task export | Persisted as canonical zip artifacts |

---

## Failure Assumptions

1. **Host Browser Availability**: The adapter assumes at least one compatible browser channel (`msedge`, `chrome`, `chromium`) is present on the host system. If no browser exists, initialization throws an actionable configuration error.
2. **Network Volatility**: The subsystem assumes target web servers may hang or time out, enforcing strict navigation ceilings (`domcontentloaded` + 30s timeout) to prevent deadlocked automation runs.
3. **DOM Volatility**: It assumes web page layouts, class names, and element IDs mutate unpredictably across deployments, delegating locator recovery to the multi-stage self-healing cascade.

---

## Common Extension Points

- **Adding a New Browser Capability**: Add the capability definition to `packages/execution-types/src/capabilities.ts`, implement the execution method in `PlaywrightBrowserAdapter`, and register postcondition checks in `VerificationEngine`.
- **Supporting Alternative Browser Channels**: Extend the channel probe array in `packages/execution-core/src/adapters/browser/launcher.ts` (e.g., adding Chromium-based developer builds or custom enterprise binaries).
- **Custom Page Event Interceptors**: Register event handlers in `BrowserSession.initializePage()` for specialized telemetry (e.g. WebSocket frames, service worker messages).

---

## Performance Characteristics

- **Warm Navigation**: Reused browser sessions navigate to new pages within 100ms–400ms (depending on network latency).
- **System Channel Startup**: Cold launch via system Edge or Chrome averages ~450ms on Windows.
- **Screenshot Capture**: Viewport PNG capture executes in ~15ms via `page.screenshot({ fullPage: false })`.
- **Memory Consumption**: Single page session typically consumes 80MB–140MB of host RAM.

---

## Testing Strategy

Unit and integration tests run against headless local data URLs and mock DOM instances:

- `browser-adapter.test.ts`:
  - Validates session initialization and navigation against inline `data:text/html` URLs.
  - Tests multi-tab coordination, ensuring page switching and tab counts behave predictably.
  - Verifies DOM scraping and CSS selector extraction.
  - Tests verification hooks to confirm blank URLs fail while loaded pages pass.

Run the test suite:

```bash
pnpm --filter @usepilot/execution-core test -- browser-adapter
```

---

## Related Documentation

- [ADR-024: Playwright Browser Runtime with Multi-Channel Profile Persistence](../adr/ADR-024-browser-runtime.md)
- [Self-Healing Element Locator Pipeline](../self-healing/README.md)
- [Vision & OCR Subsystem](../vision/README.md)
- [Browser Trace Recording](../tracing/README.md)
- [Verification Engine](../verification/README.md)

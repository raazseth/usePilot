# ADR-024: Playwright Browser Runtime with Multi-Channel Profile Persistence

## Context
Phase 3 relied on in-memory stub adapters to validate the execution substrate. Production web automation requires real browser engines capable of multi-tab navigation, data extraction, cookie persistence, downloads, uploads, file chooser triggers, CDP protocol hooks, and enterprise authentication across Chrome, Microsoft Edge, Brave, and Firefox. Furthermore, requiring users to download hundreds of megabytes of bundled browser binaries violates local-first simplicity.

## Decision
Implement `PlaywrightBrowserAdapter` and `PlaywrightBrowserSession` using Playwright:
1. **Multi-Channel Probing**: Prioritize native system Microsoft Edge (`msedge`) and Google Chrome (`chrome`) on Windows, launching existing installed browser binaries in under 600ms without separate binary downloads. Fall back to bundled Chromium / Firefox as requested.
2. **Persistent Browser Profiles**: Store cookie jars, local storage, and session tokens across executions inside user data directories using Playwright persistent contexts (`launchPersistentContext`).
3. **Session Reuse**: Manage browser life-cycles via `PlaywrightBrowserSession`. Subsequent tasks within the same execution reuse existing open pages and contexts without recreating browser processes.
4. **Independent Verification**: Navigation, downloads, and DOM extractions verify page load states, HTTP status codes, element visibility, and file existence independently from adapter status.
5. **Deterministic Self-Healing**: Automatically triggers element locator recovery cascade (DOM -> Semantic -> Visual -> OCR) when selectors mutate.

## Consequences
- Enables high-speed, local browser automation with zero external cloud dependencies.
- Retains user logins and cookies across workflow runs safely.
- Adheres strictly to the Adapter Session Model established in Phase 3.

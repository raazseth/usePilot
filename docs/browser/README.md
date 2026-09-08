# Browser Runtime

The Browser Runtime delivers production-grade web automation for usePilot via Playwright, supporting Microsoft Edge, Google Chrome, Brave, and Mozilla Firefox.

## Key Capabilities

- `navigate_website`: High-speed navigation with DOM ready state validation, title tracking, and auto-fallback to native system channels.
- `search_web`: Automated query submission across search engines with structured search result item extraction.
- `authenticate_user`: Form auto-fill, credential injection via `SecretVault`, 2FA pause points, and session cookie preservation.
- `extract_web_data`: Structured table and text data extraction using CSS selectors, text matches, and fallback scrapers.
- `download_file`: Intercepts native browser download events, saving files to local target directories with checksum verification.
- `upload_file`: Triggers file choosers and attaches local files seamlessly to input file elements.

## Architecture

```
Task Execution
     ↓
PlaywrightBrowserAdapter
     ↓
PlaywrightBrowserSession (Persistent Profile / Channel Detector)
     ↓
Playwright Chromium / MS Edge / Firefox Instance
     ↓
Independent Verification (DOM / Screenshot / HTTP Status)
```

## Features

- **System Browser Channel Auto-Detection**: Probes and launches installed Microsoft Edge and Chrome on Windows, skipping large bundled browser downloads.
- **Persistent Profiles**: Preserves user logins, local storage, and session cookies between runs.
- **Multi-Tab Support**: Orchestrates actions across multiple tabs using tab indices.
- **CDP Support**: Direct Chrome DevTools Protocol access for advanced automation.
- **Session Reuse**: Browser contexts stay alive across related tasks in an execution run, eliminating startup latency.

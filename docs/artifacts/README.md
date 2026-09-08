# Runtime Artifact Store

The Runtime Artifact Store manages all immutable files, assets, dumps, and reports generated during workflow execution.

## Directory Layout

```
run-id/
 ├── screenshots/   # Viewport and full-page PNG captures
 ├── downloads/     # Files saved via browser download
 ├── uploads/       # Assets staged for form uploads
 ├── ocr/           # OCR bounding boxes and JSON output
 ├── dom/           # DOM snapshots and tree representations
 ├── html/          # Raw page HTML snapshots
 ├── extracted/     # CSV, JSON, and parsed table data
 ├── reports/       # Execution manifests and summaries
 ├── logs/          # Structured execution logs
 └── browser/       # Playwright trace zips and network logs
```

## Canonical URIs

All artifacts are referenced using virtual URIs:
`artifact://<executionId>/<category>/<fileName>`

Example: `artifact://run-123/screenshots/invoice-page.png`

## Integrity & Privacy

- Every artifact computes a SHA-256 content checksum.
- Absolute filesystem paths are kept within the local store and never exposed to the planner context or cloud prompts.

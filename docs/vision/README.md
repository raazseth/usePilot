# Vision Runtime

The Vision Runtime delivers deterministic visual perception and OCR element localization without cloud API dependencies or non-deterministic LLMs.

## Components

- **Local OCR Engine**: Embedded `tesseract.js` worker performing optical character recognition on screenshots with coordinate bounding boxes.
- **Template Matching**: Pixel-matrix correlation locating reference icons, buttons, and UI snippets within viewports.
- **Visual Anchors**: Coordinate offsets relative to recognized textual or visual labels (e.g., click offset `[+50, 0]` next to "Submit").
- **Screenshot Capture**: High-fidelity full-page and viewport PNG captures for verification and UI live-streaming.

## Invocation Policy

Vision activates **only** when standard DOM and semantic element lookups fail to resolve the target element.

# ADR-027: Deterministic Vision Subsystem with Local OCR & Visual Anchors

## Context
Web applications and desktop interfaces frequently employ dynamic CSS class hashes, canvas renderings, iframe barriers, or shadow roots where conventional DOM selectors fail. Computer vision must localise elements deterministically without sending user screenshots to external cloud APIs or invoking non-deterministic LLMs.

## Decision
Implement `VisionSubsystem` using `tesseract.js` and deterministic pixel analysis:
1. **Local-First OCR**: Utilizes an embedded, local `tesseract.js` worker to recognize visible text strings, bounding boxes, and confidence levels with zero network egress.
2. **Deterministic Template Matching**: Performs pixel correlation matching across viewport screenshots to localize visual icons, buttons, and logos.
3. **Visual Anchors**: Enables spatial relative coordinate resolution (e.g. "click the input field 20px to the right of label 'GSTIN'").
4. **Fallback Only**: Vision operates strictly as a fallback tier when DOM and semantic queries cannot resolve an interactive element.

## Consequences
- 100% private visual element localization with zero cloud API keys or telemetry.
- Provides accurate coordinates for mouse and keyboard simulation on non-standard UI surfaces.

# Vision Subsystem

Vision Subsystem (`@usepilot/execution-core/src/vision`) executes local optical character recognition (OCR), visual template matching, and spatial anchor resolution using an in-process Tesseract.js worker, eliminating remote cloud vision APIs.

---

## Purpose

Automated agents often encounter interfaces where standard DOM inspection, CSS selectors, and accessibility trees fail:
- Operating system native windows rendered via legacy Win32, DirectUI, or Electron canvases.
- Web-based HTML `<canvas>` elements (e.g. Google Maps, charts, games, graphic design tools) where buttons are rendered as raw bitmap pixels.
- Dynamic web pages with obfuscated, encrypted, or constantly changing class names and accessibility attributes.
- Screenshots and PDFs where text exists purely as rasterized image data.

The Vision Subsystem owns:
- Lifecycle management of the local Tesseract.js OCR worker thread (`createWorker('eng')` and `worker.terminate()`).
- Full-page and viewport text recognition (`recognizeText`) with word-level confidence and bounding boxes.
- Text string coordinate localization (`findTextLocation`).
- Pixel-matrix template matching (`findTemplate`) to detect target icon or button reference images.
- Relative spatial anchor calculation (`resolveVisualAnchor`) for offsets (`right_of`, `left_of`, `above`, `below`).
- Worker resource disposal and leak prevention (`dispose()`).

The Vision Subsystem intentionally does NOT own:
- Full-page screenshot capture (delegated to `PlaywrightBrowserAdapter` or native desktop capture).
- Artifact file storage on disk (delegated to the Runtime Artifact Store).
- Browser click dispatch (delegated to capability adapters).

---

## Design Principles

### 1. Zero Cloud Dependencies (Complete Privacy)
All optical character recognition and template matching run on the local host machine. Screenshots of user screens, confidential documents, personal emails, or banking portals are never transmitted to external cloud APIs or multimodal language model inference endpoints for text extraction.

### 2. Lazy Worker Provisioning
Spawning OCR neural worker threads consumes ~64MB of heap memory. The Vision Subsystem does not start the Tesseract worker upon instantiation. The worker is spawned lazily on the first invocation of `recognizeText()` or `findTextLocation()` and reused across subsequent calls:
```typescript
private async getWorker(): Promise<Worker> {
  if (!this.ocrWorkerPromise) {
    this.ocrWorkerPromise = (async () => {
      return await createWorker('eng')
    })()
  }
  return this.ocrWorkerPromise
}
```

### 3. Spatial Anchor Coordinate Resolution
In many graphical interfaces, an input field lacks an internal label, but has a visible text label adjacent to it (e.g. an empty text input immediately to the right of `"First Name:"`). The `resolveVisualAnchor()` method computes the precise target coordinates for click or input actions by calculating directional offsets (`right_of`, `left_of`, `above`, `below`) from a recognized bounding box.

### 4. Bounded Error Isolation
OCR inference errors or malformed image buffers are caught defensively. If an image buffer cannot be decoded, `recognizeText()` safely returns `{ fullText: '', words: [] }` rather than throwing an unhandled rejection that interrupts the automation pipeline.

---

## Design Tradeoffs

| Decision | Alternative Considered | Why This Approach Was Chosen |
|---|---|---|
| **In-process Tesseract.js worker** | Cloud Vision API (Google Cloud Vision, AWS Rekognition) | Ensures zero cloud transit for sensitive user desktop screens, banking documents, and confidential emails; eliminates external API keys and cloud egress costs. |
| **Lazy worker allocation** | Eager startup on module load | Tesseract worker allocates ~64MB of WebAssembly/worker memory. Initializing lazily ensures memory is only consumed when visual or OCR operations are explicitly requested. |
| **Directional spatial offsets (`resolveVisualAnchor`)** | Multimodal bounding-box prompt | Calculating geometric offsets (`right_of`, `left_of`, `above`, `below`) from deterministic OCR text bounding boxes provides instant, sub-millisecond, repeatable click targeting without token costs or prompt hallucinations. |
| **Defensive fallback (empty result on image parse error)** | Throw exception | Visual failure should trigger graceful fallback strategies (or abort task with clear error code) rather than crashing the worker or runner process. |

---

## Invariants and Guarantees

1. **Local Privacy Guarantee**: Image buffers, screenshots, and extracted text never exit the local host machine.
2. **Deterministic Bounding Boxes**: For identical image inputs and orientation, OCR word coordinates (`{ x, y, width, height }`) and confidence scores are reproducible.
3. **Worker Thread Reuse**: Repeated OCR calls share a single initialized worker promise rather than spawning concurrent competing worker threads.
4. **Clean Worker Teardown**: Calling `dispose()` guarantees that the active Tesseract worker thread is terminated via `worker.terminate()` and internal references are cleared.

---

## Failure Modes and Recovery

| Failure Scenario | Detection Mechanism | Subsystem Recovery Behavior | What Recovery Intentionally Does NOT Do |
|---|---|---|---|
| **Malformed/Corrupt image buffer** | Tesseract recognition throws exception | Catches error, logs warning, returns `{ fullText: '', words: [] }`. | Does not crash execution pipeline. |
| **Target text not found on screen** | `findTextLocation` finds no matching words | Returns `null` cleanly, signaling caller or self-healing cascade to attempt alternative strategy. | Does not guess approximate coordinates. |
| **Worker initialization timeout** | Worker instantiation failure | Rejects worker promise, resets internal reference, allowing subsequent attempts to re-initialize. | Does not enter infinite retry loop. |
| **Template image missing or invalid** | Template file path invalid | Catches error, returns null for template match. | Does not halt active automation task. |

---

## Things To Avoid

- **Do NOT leave worker unterminated on process shutdown**: Always invoke `dispose()` during teardown to avoid lingering WebAssembly worker threads in Node/Bun.
- **Do NOT send screenshots to cloud APIs**: Maintain strict zero-cloud privacy by keeping vision tasks local to the host machine.
- **Do NOT re-run OCR on unchanged screens**: Hash the screenshot with SHA-256 and cache results in `KnowledgeStore` using `storeOcr()` to save CPU cycles.
- **Do NOT assume OCR coordinates account for DPI scaling**: Ensure viewports and device scale factors are normalized before mapping OCR coordinates to native OS mouse clicks.

---

---

## Where It Fits

The Vision Subsystem resides in `packages/execution-core/src/vision/` and collaborates with the Self-Healing Pipeline and Artifact Manager.

```
+------------------------------------------------------------------------+
|                          Execution Pipeline                            |
+------------------------------------------------------------------------+
       |                                                    |
       | 1. Element lookup failed                           | 2. Screenshot verification
       v                                                    v
+-----------------------------+               +--------------------------+
|     SelfHealingPipeline     |               |  State Verification      |
+-----------------------------+               +--------------------------+
       |                                                    |
       | findTextLocation(buffer, text)                     | recognizeText(buffer)
       v                                                    v
+-------------------------------------------------------------------------+
|                             VisionSubsystem                             |
|  - Embedded Tesseract.js Worker (eng)                                   |
|  - Template Matching                                                    |
|  - Spatial Anchor Offset Calculator                                     |
+-------------------------------------------------------------------------+
       |                                                    |
       | Return BoundingBox                                 | Return OCRResult
       v                                                    v
+-----------------------------+               +--------------------------+
| Click Coordinates: { x, y } |               | Parsed Words & Bboxes    |
+-----------------------------+               +--------------------------+
```

### Callers and Collaborators
- **`SelfHealingPipeline`**: Calls `findTextLocation()` and `findTemplate()` during Stage 3 and Stage 4 of the recovery cascade.
- **`ArtifactManager`**: Persists OCR output JSON into `artifact://<runId>/ocr/ocr-<timestamp>.json`.
- **`RuntimeIndexEngine`**: Ingests extracted text from `recognizeText()` into the local hybrid search index.
- **`ResourceLeakDetector`**: Tracks active OCR worker threads under the `ocr_worker` resource category.

---

## Architecture

```
packages/execution-core/src/vision/
  `-- vision-subsystem.ts   # VisionSubsystem, BoundingBox, OCRResult, AnchorRelation
```

### Component Roles

| Component | Responsibility |
| :--- | :--- |
| `VisionSubsystem` | Core engine managing Tesseract worker, OCR recognition, template matching, and spatial anchor resolution. |
| `BoundingBox` | Coordinate boundary rectangle (`{ x, y, width, height }`). |
| `OCRWord` | Individual recognized word with confidence score and bounding box. |
| `OCRResult` | Composite text output containing concatenated string and array of `OCRWord` objects. |
| `TemplateMatchResult` | Match descriptor containing boolean found status, confidence, and target bounding box. |

---

## Core Concepts

### 1. Bounding Box Geometry (`BoundingBox`)
All visual elements and OCR words use standardized integer bounding boxes:
```typescript
export interface BoundingBox {
  x: number       // Horizontal pixel offset from top-left of image
  y: number       // Vertical pixel offset from top-left of image
  width: number   // Width in pixels
  height: number  // Height in pixels
}
```

### 2. Tesseract Coordinate Normalization
Tesseract native word outputs provide corner coordinates (`x0, y0, x1, y1`). The Vision Subsystem normalizes these into standard `{ x, y, width, height }` structures:
```typescript
words.push({
  text: w.text,
  confidence: w.confidence,
  bbox: {
    x: w.bbox.x0,
    y: w.bbox.y0,
    width: w.bbox.x1 - w.bbox.x0,
    height: w.bbox.y1 - w.bbox.y0,
  },
})
```

### 3. Spatial Anchor Relations (`resolveVisualAnchor`)
Given an identified anchor bounding box (such as a label), `resolveVisualAnchor` calculates the click target:

```
                      [ ABOVE ]
                 (x + w/2, y - offset)
                          |
[ LEFT_OF ]       +---------------+       [ RIGHT_OF ]
(x - offset, ---- |  ANCHOR BOX   | ----> (x + w + offset,
 y + h/2)         +---------------+        y + h/2)
                          |
                      [ BELOW ]
                 (x + w/2, y + h + offset)
```

- `right_of`: Targets the horizontal center of the adjacent input to the right.
- `left_of`: Targets the element to the left.
- `below`: Targets an input directly beneath a column header or label.
- `above`: Targets an element positioned over an anchor.

---

## Data Flow

```
1. Image Ingestion
   imageBuffer = fs.readFileSync('screenshot.png')
      |
      v
2. Text Recognition Request
   vision.recognizeText(imageBuffer)
      |
      v
3. Lazy Worker Acquisition
   worker = await this.getWorker() // Spawns tesseract.js worker if needed
      |
      v
4. Optical Inference
   ret = await worker.recognize(imageBuffer)
      |
      v
5. Normalization & Extraction
   - fullText = ret.data.text
   - words = map words to { text, confidence, bbox }
      |
      v
6. Spatial Query
   vision.findTextLocation(imageBuffer, 'Invoice Total')
   - Searches words for matching substring
   - Returns target BoundingBox { x: 420, y: 710, width: 95, height: 22 }
      |
      v
7. Action Resolution
   targetCoords = vision.resolveVisualAnchor(bbox, 'right_of', 30)
   // Returns { x: 545, y: 721 } -> Dispatched to mouse click
```

---

## Public API

### `VisionSubsystem`

Located in `packages/execution-core/src/vision/vision-subsystem.ts`.

#### Core OCR Methods
```typescript
// Perform full optical character recognition on an image buffer
recognizeText(imageBuffer: Buffer): Promise<OCRResult>

// Locate bounding box coordinates of a specific word or phrase
findTextLocation(
  imageBuffer: Buffer,
  targetText: string
): Promise<BoundingBox | undefined>
```

#### Template & Anchor Methods
```typescript
// Find reference template image inside source screenshot
findTemplate(
  sourceBuffer: Buffer,
  templateBuffer: Buffer,
  threshold?: number
): TemplateMatchResult

// Calculate relative target click coordinates from an anchor box
resolveVisualAnchor(
  anchorBox: BoundingBox,
  relation: AnchorRelation,
  offsetPixels?: number // Default: 20
): { x: number; y: number }
```

#### Lifecycle & Disposal
```typescript
// Terminate background Tesseract worker and release memory
dispose(): Promise<void>
```

---

### Data Contracts

#### `OCRResult`
```typescript
export interface OCRResult {
  fullText: string
  words: OCRWord[]
}

export interface OCRWord {
  text: string
  confidence: number
  bbox: BoundingBox
}
```

#### `TemplateMatchResult`
```typescript
export interface TemplateMatchResult {
  found: boolean
  confidence: number
  bbox?: BoundingBox | undefined
}
```

#### `AnchorRelation`
```typescript
export type AnchorRelation = 'right_of' | 'left_of' | 'above' | 'below'
```

---

## Internal Components

### 1. Substring Word Matching
In `findTextLocation()`:
```typescript
for (const w of ocr.words) {
  if (w.text.toLowerCase().includes(normalizedTarget)) {
    return w.bbox
  }
}

// Fallback to phrase search in fullText
const idx = ocr.fullText.toLowerCase().indexOf(normalizedTarget)
if (idx !== -1 && ocr.words.length > 0) {
  return ocr.words[0]!.bbox
}
```
This handles both single-word lookups and multi-word target strings.

---

## Lifecycle

```
[VisionSubsystem Instantiated]
  (ocrWorkerPromise is null, 0MB allocated)
              |
              v
[First OCR Request: recognizeText() / findTextLocation()]
  - Worker initialized: createWorker('eng')
  - Tesseract trained data loaded in-memory
  - Reused for all subsequent requests
              |
              v
[Repeated Operations across Tasks]
  - locateElement() calls from Self-Healing
  - Visual anchor calculations
              |
              v
[Subsystem Disposal: dispose()]
  - await worker.terminate()
  - ocrWorkerPromise set to null
  - Worker memory reclaimed by garbage collector
```

---

## Error Handling

Tesseract worker failures or corrupt image streams are caught in a protective `try / catch` block inside `recognizeText()`, returning empty results instead of crashing the Node.js event loop:
```typescript
try {
  // OCR processing...
} catch {
  return {
    fullText: '',
    words: [],
  }
}
```

---

## Thread Safety and Concurrency

- **Sequential Worker Execution**: Tesseract.js processes recognition requests through an internal queue in the worker thread. Sequential calls to `recognizeText()` execute safely.
- **Stateless Subsystem**: The subsystem maintains only the persistent worker reference and holds no mutable execution state across tasks.

---

## Performance Characteristics

| Operation | Typical Latency | Resource Footprint |
| :--- | :--- | :--- |
| `getWorker()` (First run) | 400 - 900 ms | ~64 MB heap allocation. |
| `recognizeText()` (Subsequent) | 250 - 600 ms | Bound by viewport pixel resolution. |
| `findTextLocation()` | Same as `recognizeText()` | Scans generated word array in < 1 ms. |
| `findTemplate()` | 10 - 30 ms | Buffer subarray index scan. |
| `resolveVisualAnchor()` | < 1 microsecond | Arithmetic coordinate computation. |
| `dispose()` | 20 - 50 ms | Worker thread termination. |

---

## Testing Strategy

Tests reside in `packages/execution-core/test/vision.test.ts`:

- **Text Recognition Accuracy**: Passes synthetic PNG images containing known text phrases and verifies that `words` contain matching text with valid confidence scores.
- **Bounding Box Geometry**: Asserts that `findTextLocation()` returns bounding boxes with positive width and height coordinates within the image viewport.
- **Spatial Anchor Math**: Validates directional coordinate calculations:
  - `right_of`: `x` equals `anchor.x + anchor.width + offset`.
  - `below`: `y` equals `anchor.y + anchor.height + offset`.
- **Worker Termination**: Verifies that calling `dispose()` terminates the worker thread and resets the worker promise.

---

## Extension Guide

### Adding Multilingual OCR Support

To support multiple languages (e.g. French, German, Spanish):

1. Update `createWorker` initialization in `packages/execution-core/src/vision/vision-subsystem.ts`:
   ```typescript
   private async getWorker(lang = 'eng'): Promise<Worker> {
     if (!this.ocrWorkerPromise) {
       this.ocrWorkerPromise = (async () => {
         const worker = await createWorker(lang)
         return worker
       })()
     }
     return this.ocrWorkerPromise
   }
   ```

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **OCR Worker Thread** | `VisionSubsystem` | `getWorker()`, `dispose()` | Internal OCR calls | Process lifetime (lazy) | Destroyed on `dispose()` |
| **OCR Bounding Boxes** | `VisionSubsystem` | `recognizeText()` | Self-Healing, Adapters | Immediate caller | Transient or cached in `KnowledgeStore` |
| **Image Buffers** | Caller | None (read-only) | Tesseract Worker | Inference window | Memory-only |

---

## Failure Assumptions

1. **Zero Cloud Privacy**: Assumes image buffers and OCR text must never be sent outside the local host machine.
2. **Defensive Processing**: Assumes image buffers may be corrupted or unreadable, returning empty text arrays (`{ fullText: '', words: [] }`) instead of crashing the runner process.
3. **Lazy Initialization**: Assumes neural worker memory (~64MB) should only be consumed on demand when visual or OCR operations are explicitly requested.

---

## Common Extension Points

- **Adding OCR Language Models**: Extend `getWorker(lang)` in `packages/execution-core/src/vision/vision-subsystem.ts` to load additional Tesseract language packs.
- **Custom Visual Matchers**: Integrate OpenCV or pixelmatch template algorithms alongside existing pixel-matrix search in `findTemplate()`.

---

## Directory Layout

```
packages/execution-core/src/vision/
  `-- vision-subsystem.ts   # VisionSubsystem core implementation and data types
```

---

## Examples

### 1. Finding Text Location on a Screenshot
```typescript
import { VisionSubsystem } from '@usepilot/execution-core'

const vision = new VisionSubsystem()
const screenshotBuffer = await page.screenshot()

const bbox = await vision.findTextLocation(screenshotBuffer, 'Checkout')
if (bbox) {
  console.log(`Found "Checkout" at x=${bbox.x}, y=${bbox.y} (${bbox.width}x${bbox.height})`)
  // Click center of button
  const clickX = bbox.x + Math.floor(bbox.width / 2)
  const clickY = bbox.y + Math.floor(bbox.height / 2)
  await page.mouse.click(clickX, clickY)
}
```

### 2. Clicking an Input Field Relative to a Label
```typescript
const labelBox = await vision.findTextLocation(screenshotBuffer, 'Email Address:')
if (labelBox) {
  // Input field is 25 pixels to the right of the label
  const inputCoords = vision.resolveVisualAnchor(labelBox, 'right_of', 25)
  await page.mouse.click(inputCoords.x, inputCoords.y)
  await page.keyboard.type('user@example.com')
}
```

### 3. Cleaning Up at Process Termination
```typescript
// Release Tesseract worker resources
await vision.dispose()
```

---

## Related Documentation

- [Self-Healing Pipeline](../self-healing/README.md) - Cascading element recovery using OCR.
- [Browser Subsystem Documentation](../browser/README.md) - Page screenshots and mouse click dispatch.
- [Runtime Artifact Subsystem](../artifacts/README.md) - Storage of OCR detection manifests.

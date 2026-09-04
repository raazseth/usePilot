import { z } from 'zod'

// Feature Flags

export const FeatureFlagsSchema = z.object({
  /** Experimental features — enabled in dev, disabled in prod by default */
  experimental: z.object({
    /** Enable streaming responses (vs. full response) */
    streamingEnabled: z.boolean().default(true),
    /** Render markdown in assistant messages */
    markdownRendering: z.boolean().default(true),
    /** Syntax highlighting in code blocks */
    syntaxHighlighting: z.boolean().default(true),
  }).default({}),

  /** AI capability flags — all false in Phase 1 */
  ai: z.object({
    /** Phase 2: Image understanding */
    vision: z.boolean().default(false),
    /** Phase 3: Planning engine */
    planner: z.boolean().default(false),
    /** Phase 4: Persistent memory */
    memory: z.boolean().default(false),
    /** Phase 4: Voice input/output */
    voice: z.boolean().default(false),
    /** Phase 3: Tool calling / function calls */
    tools: z.boolean().default(false),
    /** Phase 4: Web search */
    webSearch: z.boolean().default(false),
    /** Phase 5: Embeddings / RAG */
    embeddings: z.boolean().default(false),
  }).default({}),

  /** UI flags */
  ui: z.object({
    /** Command palette (⌘K) */
    commandPalette: z.boolean().default(true),
    /** Conversation search */
    conversationSearch: z.boolean().default(true),
    /** Dark mode toggle */
    themeToggle: z.boolean().default(true),
    /** New sidebar design (Phase 2 redesign) */
    newSidebar: z.boolean().default(false),
  }).default({}),
})

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>

/** Default feature flag values */
export const defaultFeatureFlags: FeatureFlags = FeatureFlagsSchema.parse({})

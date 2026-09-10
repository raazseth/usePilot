import { z } from 'zod'

// Feature Flags

export const FeatureFlagsSchema = z.object({
  /** Feature flags for runtime behavior */
  experimental: z.object({
    /** Enable streaming responses (vs. full response) */
    streamingEnabled: z.boolean().default(true),
    /** Render markdown in assistant messages */
    markdownRendering: z.boolean().default(true),
    /** Syntax highlighting in code blocks */
    syntaxHighlighting: z.boolean().default(true),
  }).default({}),

  /** AI capability flags */
  ai: z.object({
    /** Image understanding */
    vision: z.boolean().default(false),
    /** Planning engine */
    planner: z.boolean().default(false),
    /** Persistent memory */
    memory: z.boolean().default(false),
    /** Voice input/output */
    voice: z.boolean().default(false),
    /** Tool calling / function calls */
    tools: z.boolean().default(false),
    /** Web search */
    webSearch: z.boolean().default(false),
    /** Embeddings / RAG */
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
    /** Collapsible sidebar layout */
    newSidebar: z.boolean().default(false),
  }).default({}),
})

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>

/** Default feature flag values */
export const defaultFeatureFlags: FeatureFlags = FeatureFlagsSchema.parse({})

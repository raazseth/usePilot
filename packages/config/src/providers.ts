import { z } from 'zod'

export const ProviderDefaultsSchema = z.object({
  ollama: z.object({
    name: z.string().default('Ollama'),
    baseUrl: z.string().url().default('http://localhost:11434'),
    defaultModel: z.string().default('llama3.2'),
  }).default({}),
  lmstudio: z.object({
    name: z.string().default('LM Studio'),
    baseUrl: z.string().url().default('http://localhost:1234'),
    defaultModel: z.string().default(''),
  }).default({}),
  openaiCompatible: z.object({
    name: z.string().default('OpenAI Compatible'),
    baseUrl: z.string().url().default('https://api.openai.com'),
    defaultModel: z.string().default('gpt-4o-mini'),
  }).default({}),
})

export type ProviderDefaults = z.infer<typeof ProviderDefaultsSchema>

export const providerDefaults: ProviderDefaults = ProviderDefaultsSchema.parse({})

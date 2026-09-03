import type { StreamChunk } from './provider.interface'

/**
 * Collect all chunks from a stream into a complete response.
 */
export async function collectStream(stream: AsyncIterable<StreamChunk>): Promise<{
  content: string
  finishReason: StreamChunk['finishReason']
  usage: StreamChunk['usage']
}> {
  let content = ''
  let finishReason: StreamChunk['finishReason'] = null
  let usage: StreamChunk['usage'] = undefined

  for await (const chunk of stream) {
    content += chunk.token
    if (chunk.done) {
      finishReason = chunk.finishReason
      usage = chunk.usage
    }
  }

  return { content, finishReason, usage }
}

/**
 * Collect stream into a plain string.
 */
export async function streamToText(stream: AsyncIterable<StreamChunk>): Promise<string> {
  const { content } = await collectStream(stream)
  return content
}

/**
 * Wrap a stream with abort signal support.
 * Throws when the signal fires.
 */
export async function* createAbortableStream(
  stream: AsyncIterable<StreamChunk>,
  signal: AbortSignal
): AsyncIterable<StreamChunk> {
  for await (const chunk of stream) {
    if (signal.aborted) {
      return
    }
    yield chunk
  }
}

import { describe, it, expect } from 'vitest'
import { collectStream, streamToText, createAbortableStream } from '../stream'
import { AIProviderError, AIProviderErrorCode } from '../errors'
import type { StreamChunk } from '../provider.interface'

describe('AI Core Stream Utilities', () => {
  it('collects tokens from stream into full text', async () => {
    async function* mockGenerator(): AsyncIterable<StreamChunk> {
      yield { token: 'Hello', done: false }
      yield { token: ' ', done: false }
      yield { token: 'World', done: false }
      yield { token: '!', done: true, finishReason: 'stop' }
    }

    const result = await collectStream(mockGenerator())
    expect(result.content).toBe('Hello World!')
    expect(result.finishReason).toBe('stop')
  })

  it('streamToText converts stream directly to string', async () => {
    async function* mockGenerator(): AsyncIterable<StreamChunk> {
      yield { token: 'A', done: false }
      yield { token: 'B', done: false }
      yield { token: 'C', done: true }
    }

    const text = await streamToText(mockGenerator())
    expect(text).toBe('ABC')
  })

  it('createAbortableStream stops emission when aborted', async () => {
    const controller = new AbortController()

    async function* mockGenerator(): AsyncIterable<StreamChunk> {
      yield { token: '1', done: false }
      controller.abort()
      yield { token: '2', done: false }
    }

    const abortable = createAbortableStream(mockGenerator(), controller.signal)
    const text = await streamToText(abortable)
    expect(text).toBe('1')
  })

  it('instantiates AIProviderError with correct error code and cause', () => {
    const error = new AIProviderError({
      message: 'Connection timed out',
      code: AIProviderErrorCode.Timeout,
      provider: 'ollama',
      cause: new Error('Network failure'),
    })

    expect(error.name).toBe('AIProviderError')
    expect(error.code).toBe('REQUEST_TIMEOUT')
    expect(error.provider).toBe('ollama')
    expect(error.cause).toBeDefined()
  })
})

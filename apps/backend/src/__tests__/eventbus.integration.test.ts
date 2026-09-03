import { describe, it, expect } from 'vitest'
import { EventBus } from '../events/bus'

describe('EventBus Integration', () => {
  it('publishes and subscribes to typed domain events', async () => {
    const bus = new EventBus()
    const received: Array<{ id: string; title: string }> = []

    const unsubscribe = bus.on('conversation.created', (payload) => {
      received.push(payload)
    })

    await bus.emit('conversation.created', {
      id: 'conv-123',
      title: 'First Chat',
    })

    expect(received.length).toBe(1)
    expect(received[0]?.id).toBe('conv-123')
    expect(received[0]?.title).toBe('First Chat')

    unsubscribe()

    await bus.emit('conversation.created', {
      id: 'conv-456',
      title: 'Second Chat',
    })

    expect(received.length).toBe(1) // No new calls after unsubscribe
  })

  it('supports wildcard handlers for auditing and logging', async () => {
    const bus = new EventBus()
    const auditLog: string[] = []

    bus.onAny((event) => {
      auditLog.push(event.type)
    })

    await bus.emit('conversation.created', { id: 'c1', title: 'T1' })
    await bus.emit('conversation.deleted', { id: 'c1' })

    expect(auditLog).toEqual(['conversation.created', 'conversation.deleted'])
  })

  it('handles subscriber errors without crashing other subscribers', async () => {
    const bus = new EventBus()
    let healthySubscriberRan = false

    bus.on('message.streaming.cancelled', () => {
      throw new Error('Exploding subscriber')
    })

    bus.on('message.streaming.cancelled', () => {
      healthySubscriberRan = true
    })

    await bus.emit('message.streaming.cancelled', { id: 'm1', conversationId: 'c1' })
    expect(healthySubscriberRan).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'

import { ExecutionResourceManager } from '../resource-manager'

describe('ExecutionResourceManager', () => {
  it('registers and tracks active resources', () => {
    const rm = new ExecutionResourceManager()
    rm.register({
      id: 'res-1',
      type: 'temp_file',
      description: 'temporary log file',
      dispose: async () => {},
      registeredAt: Date.now(),
    })

    expect(rm.listActive().length).toBe(1)
    expect(rm.listActive()[0]?.id).toBe('res-1')

    rm.unregister('res-1')
    expect(rm.listActive().length).toBe(0)
  })

  it('cleanupAll disposes all resources and recovers from errors', async () => {
    const rm = new ExecutionResourceManager()
    let res1Disposed = false
    let res2Disposed = false

    rm.register({
      id: 'res-1',
      type: 'adapter',
      description: 'failing adapter',
      dispose: async () => {
        res1Disposed = true
        throw new Error('Disposal failed!')
      },
      registeredAt: Date.now(),
    })

    rm.register({
      id: 'res-2',
      type: 'handle',
      description: 'process handle',
      dispose: async () => {
        res2Disposed = true
      },
      registeredAt: Date.now(),
    })

    await rm.cleanupAll(1000)

    expect(res1Disposed).toBe(true)
    expect(res2Disposed).toBe(true)
    expect(rm.listActive().length).toBe(0)
  })
})

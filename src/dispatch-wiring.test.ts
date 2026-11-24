import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sessionStatusFromAgent } from './dispatch.js'

describe('sessionStatusFromAgent', () => {
  it('reports the two states the host can prove', () => {
    expect(sessionStatusFromAgent({ status: 'running' })).toBe('running')
    expect(sessionStatusFromAgent({ status: 'idle' })).toBe('idle')
  })

  it('reports unknown rather than guessing a state', () => {
    // `unknown` must not decay into `idle`: "idle and nothing submitted" is exactly the silence the
    // stalled detector escalates, so an unobservable Session would be accused of stalling.
    expect(sessionStatusFromAgent(undefined)).toBe('unknown')
    expect(sessionStatusFromAgent(null)).toBe('unknown')
    expect(sessionStatusFromAgent({})).toBe('unknown')
    expect(sessionStatusFromAgent({ status: 'starting' })).toBe('unknown')
    expect(sessionStatusFromAgent('running')).toBe('unknown')
  })
})

/**
 * The dispatcher declares `sessionStatus` as optional, and for a while nothing supplied it: the whole
 * idle branch of the stalled detector — the one that catches "acknowledged, then stopped" — was
 * skipped in production while remaining green in its own tests. `apply()` needs a full host, so the
 * wiring is asserted on the source, which is the only cheap way to catch a port that exists, is
 * tested, and is never passed.
 */
describe('dispatcher wiring', () => {
  const source = readFileSync(join(import.meta.dirname, 'plugin.ts'), 'utf8')

  it('passes the Session status the stalled detector needs', () => {
    expect(source).toMatch(/sessionStatus:\s*async \(sessionId\) => sessionStatusFromAgent\(/)
  })

  it('keeps the rotation gate on the same reading of the status', () => {
    expect(source).toMatch(/sessionStatus = sessionStatusFromAgent\(/)
  })
})

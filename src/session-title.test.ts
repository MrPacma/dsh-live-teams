import { describe, expect, it, vi } from 'vitest'
import { applySessionTitle, isRetiredTitle, retiredSessionTitle, rotationStamp, sessionTitleFor } from './session-title.js'

function dependencies(rename?: (sessionId: string, title: string) => Promise<unknown>) {
  const calls: Array<[string, string]> = []
  return {
    calls,
    warn: vi.fn(),
    rename: async (sessionId: string, title: string) => {
      calls.push([sessionId, title])
      return rename === undefined ? { title, seq: 1 } : rename(sessionId, title)
    },
  }
}

describe('session titles', () => {
  it('formats the member name and the team name with a spaced hyphen', () => {
    expect(sessionTitleFor('Builder', 'B1 Check')).toBe('Builder - B1 Check')
  })

  it('titles a Session that had none and reports the missing previous title', async () => {
    const deps = dependencies()
    const result = await applySessionTitle(deps, { sessionId: 's-1', displayName: 'Builder', teamName: 'B1 Check', reason: 'member-added' })
    expect(deps.calls).toEqual([['s-1', 'Builder - B1 Check']])
    expect(result).toEqual({ from: null, to: 'Builder - B1 Check', reason: 'member-added', renamed: true })
  })

  it('renames an adopted Session and keeps its previous title', async () => {
    const deps = dependencies()
    const result = await applySessionTitle(deps, { sessionId: 's-2', displayName: 'Lead', teamName: 'B1 Check', reason: 'member-added', previousTitle: 'Приветствие в чате' })
    expect(deps.calls).toEqual([['s-2', 'Lead - B1 Check']])
    expect(result?.from).toBe('Приветствие в чате')
    expect(result?.renamed).toBe(true)
  })

  it('leaves a matching title alone, so repeated operations stay quiet', async () => {
    const deps = dependencies()
    const result = await applySessionTitle(deps, { sessionId: 's-3', displayName: 'Builder', teamName: 'B1 Check', reason: 'member-renamed', previousTitle: 'Builder - B1 Check' })
    expect(deps.calls).toEqual([])
    expect(result).toEqual({ from: 'Builder - B1 Check', to: 'Builder - B1 Check', reason: 'member-renamed', renamed: false })
  })

  it('reports a failed rename instead of throwing, so membership is unaffected', async () => {
    const deps = dependencies(async () => { throw new Error('no title service') })
    const result = await applySessionTitle(deps, { sessionId: 's-4', displayName: 'Builder', teamName: 'B1 Check', reason: 'member-added' })
    expect(result).toBeUndefined()
    expect(deps.warn).toHaveBeenCalledOnce()
    expect(String(deps.warn.mock.calls[0]?.[0])).toContain('no title service')
  })

  it('renames with the new member name when a member is renamed', async () => {
    const deps = dependencies()
    const result = await applySessionTitle(deps, { sessionId: 's-5', displayName: 'Reviewer', teamName: 'B1 Check', reason: 'member-renamed', previousTitle: 'Builder - B1 Check' })
    expect(deps.calls).toEqual([['s-5', 'Reviewer - B1 Check']])
    expect(result?.from).toBe('Builder - B1 Check')
    expect(result?.to).toBe('Reviewer - B1 Check')
  })
})

/**
 * Two Sessions with the same name — one live, one retired — is the first confusion a human hits after
 * a rotation. The replaced one carries a stamp, and the stamp is the durable marker the session list
 * can be read by.
 */
describe('retired Session titles', () => {
  it('stamps zero-padded local date and time', () => {
    expect(rotationStamp(new Date(2026, 0, 5, 3, 4).getTime())).toBe('05.01.2026 03:04')
    expect(rotationStamp(new Date(2026, 10, 24, 23, 59).getTime())).toBe('24.11.2026 23:59')
    expect(rotationStamp(new Date(2026, 11, 31, 0, 0).getTime())).toBe('31.12.2026 00:00')
  })

  it('keeps the name the Session already had', () => {
    const at = new Date(2026, 10, 24, 13, 45).getTime()
    expect(retiredSessionTitle('Лидер - Uniwire', at)).toBe('Лидер - Uniwire (Rotated 24.11.2026 13:45)')
    expect(retiredSessionTitle('Разбор багов', at)).toBe('Разбор багов (Rotated 24.11.2026 13:45)')
  })

  it('trims a long base but never the stamp, so two rotations still differ', () => {
    const at = new Date(2026, 10, 24, 13, 45).getTime()
    const title = retiredSessionTitle('x'.repeat(400), at)
    expect(title.length).toBeLessThanOrEqual(200)
    expect(title.endsWith(' (Rotated 24.11.2026 13:45)')).toBe(true)
    expect(title.startsWith('x')).toBe(true)
  })

  it('falls back to a neutral base rather than starting with the stamp', () => {
    expect(retiredSessionTitle('   ', new Date(2026, 10, 24, 13, 45).getTime())).toBe('Session (Rotated 24.11.2026 13:45)')
  })

  it('recognises an already stamped title, so a repeated pass renames nothing', () => {
    expect(isRetiredTitle('Лидер - Uniwire (Rotated 24.11.2026 13:45)')).toBe(true)
    expect(isRetiredTitle('  Лидер - Uniwire (Rotated 01.02.2026 03:04)  ')).toBe(true)
    expect(isRetiredTitle('Лидер - Uniwire')).toBe(false)
    expect(isRetiredTitle('Ротация 24.11.2026')).toBe(false)
  })

  it('applies an explicit title and reports the rotation reason', async () => {
    const deps = dependencies()
    const title = retiredSessionTitle('Лидер - Uniwire', new Date(2026, 10, 24, 13, 45).getTime())
    const result = await applySessionTitle(deps, { sessionId: 's-6', displayName: 'Лидер', teamName: 'Uniwire', reason: 'member-rotated', previousTitle: 'Лидер - Uniwire', title })
    expect(deps.calls).toEqual([['s-6', 'Лидер - Uniwire (Rotated 24.11.2026 13:45)']])
    expect(result).toEqual({ from: 'Лидер - Uniwire', to: title, reason: 'member-rotated', renamed: true })
  })

  it('reports a refused stamp instead of throwing, so the rotation is unaffected', async () => {
    const deps = dependencies(async () => { throw new Error('session is gone') })
    const result = await applySessionTitle(deps, { sessionId: 's-7', displayName: 'Лидер', teamName: 'Uniwire', reason: 'member-rotated', previousTitle: 'Лидер - Uniwire', title: 'Лидер - Uniwire (Rotated 24.11.2026 13:45)' })
    expect(result).toBeUndefined()
    expect(deps.warn).toHaveBeenCalledOnce()
  })
})

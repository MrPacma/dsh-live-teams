import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The runtime reads these directories relative to the installed package. A
 * directory that is not declared in `files` is not copied by a package install,
 * so the feature silently ships empty — visible only in a real installation.
 */
const REQUIRED_RUNTIME_DIRECTORIES = ['roles']

describe('package payload', () => {
  it('declares every runtime directory the plugin reads', () => {
    const payload = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { files?: string[] }
    const declared = payload.files ?? []
    for (const directory of REQUIRED_RUNTIME_DIRECTORIES) {
      expect(declared.some((entry) => entry === directory || entry.startsWith(`${directory}/`))).toBe(true)
    }
  })

  it('ships at least one role file in the global registry', () => {
    const directory = join(packageRoot, 'roles')
    expect(existsSync(directory)).toBe(true)
    expect(readdirSync(directory).filter((entry) => entry.endsWith('.md')).length).toBeGreaterThan(0)
  })

  /**
   * The host reads the manifest as JSON, and a UTF-8 BOM is not valid JSON: a `link:` install then
   * fails with `Unexpected token '\uFEFF'` and the plugin never mounts. Windows PowerShell's
   * `Set-Content -Encoding utf8` writes exactly that BOM, so a perfectly ordinary version bump can
   * take the profile down. Checked here because nothing else reads the file as raw bytes.
   */
  it('has a manifest with no byte-order mark', () => {
    const bytes = readFileSync(join(packageRoot, 'package.json'))
    expect(bytes.length).toBeGreaterThan(3)
    expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false)
    expect(() => JSON.parse(bytes.toString('utf8'))).not.toThrow()
  })
})

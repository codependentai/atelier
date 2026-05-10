import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, readSettings, updateSettings, withRecentVault, writeSettings } from './settings.js'

let tempRoot: string | undefined

afterEach(async () => {
  if (tempRoot) {
    await fs.rm(tempRoot, { recursive: true, force: true })
    tempRoot = undefined
  }
})

async function settingsPath(): Promise<string> {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'html-vault-settings-'))
  return path.join(tempRoot, 'settings.json')
}

describe('settings', () => {
  it('returns defaults when settings do not exist', async () => {
    await expect(readSettings(await settingsPath())).resolves.toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to defaults when settings are corrupt', async () => {
    const filePath = await settingsPath()
    await fs.writeFile(filePath, '{not-json', 'utf8')

    await expect(readSettings(filePath)).resolves.toEqual(DEFAULT_SETTINGS)
  })

  it('persists normalized settings updates', async () => {
    const filePath = await settingsPath()

    const settings = await updateSettings(filePath, {
      workspaceMode: 'split',
      sourceSplit: 90,
      leftSidebarCollapsed: true,
    })

    expect(settings).toMatchObject({
      workspaceMode: 'split',
      sourceSplit: 75,
      leftSidebarCollapsed: true,
    })
    await expect(readSettings(filePath)).resolves.toMatchObject(settings)
  })

  it('dedupes and orders recent vaults', async () => {
    const first = withRecentVault(DEFAULT_SETTINGS, 'C:/vaults/one')
    const second = withRecentVault(first, 'C:/vaults/two')
    const third = withRecentVault(second, 'C:/vaults/one')

    expect(third.recentVaults).toEqual(['C:/vaults/one', 'C:/vaults/two'])
    expect(third.lastVaultPath).toBe('C:/vaults/one')
  })

  it('writes default settings to nested AppData-style paths', async () => {
    const filePath = path.join(await settingsPath(), '..', 'nested', 'settings.json')

    await writeSettings(filePath, DEFAULT_SETTINGS)

    await expect(readSettings(filePath)).resolves.toEqual(DEFAULT_SETTINGS)
  })
})

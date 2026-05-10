import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { AppSettings, AppSettingsUpdate, Theme, WorkspaceMode } from '../src/shared/types.js'

export const DEFAULT_SETTINGS: AppSettings = {
  recentVaults: [],
  workspaceMode: 'preview',
  sourceSplit: 42,
  leftSidebarCollapsed: false,
  inspectorCollapsed: false,
  theme: 'dark',
}

const WORKSPACE_MODES: WorkspaceMode[] = ['preview', 'split', 'source', 'graph', 'reading']
const THEMES: Theme[] = ['dark', 'light']

export async function readSettings(settingsPath: string): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(settingsPath, 'utf8')
    return normalizeSettings(JSON.parse(raw) as Partial<AppSettings>)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function writeSettings(settingsPath: string, settings: AppSettings): Promise<AppSettings> {
  const normalized = normalizeSettings(settings)
  await fs.mkdir(path.dirname(settingsPath), { recursive: true })
  await fs.writeFile(settingsPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  return normalized
}

export async function updateSettings(settingsPath: string, update: AppSettingsUpdate): Promise<AppSettings> {
  const current = await readSettings(settingsPath)
  return writeSettings(settingsPath, normalizeSettings({ ...current, ...update }))
}

export function withRecentVault(settings: AppSettings, vaultPath: string): AppSettings {
  const recentVaults = [vaultPath, ...settings.recentVaults.filter((path) => path !== vaultPath)].slice(0, 12)

  return normalizeSettings({
    ...settings,
    lastVaultPath: vaultPath,
    recentVaults,
  })
}

export function normalizeSettings(settings: Partial<AppSettings>): AppSettings {
  const workspaceMode = WORKSPACE_MODES.includes(settings.workspaceMode as WorkspaceMode)
    ? (settings.workspaceMode as WorkspaceMode)
    : DEFAULT_SETTINGS.workspaceMode
  const recentVaults = dedupeStrings(settings.recentVaults)
  const sourceSplit =
    typeof settings.sourceSplit === 'number' && Number.isFinite(settings.sourceSplit)
      ? clamp(settings.sourceSplit, 25, 75)
      : DEFAULT_SETTINGS.sourceSplit
  const theme = THEMES.includes(settings.theme as Theme)
    ? (settings.theme as Theme)
    : DEFAULT_SETTINGS.theme

  return {
    recentVaults,
    ...(typeof settings.lastVaultPath === 'string' && settings.lastVaultPath.trim()
      ? { lastVaultPath: settings.lastVaultPath }
      : {}),
    workspaceMode,
    sourceSplit,
    leftSidebarCollapsed:
      typeof settings.leftSidebarCollapsed === 'boolean'
        ? settings.leftSidebarCollapsed
        : DEFAULT_SETTINGS.leftSidebarCollapsed,
    inspectorCollapsed:
      typeof settings.inspectorCollapsed === 'boolean'
        ? settings.inspectorCollapsed
        : DEFAULT_SETTINGS.inspectorCollapsed,
    theme,
  }
}

function dedupeStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return []
  }

  return [...new Set(values.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())))]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

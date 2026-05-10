import { useEffect, useRef, useState } from 'react'
import {
  ChevronUp,
  DoorOpen,
  FolderOpen,
  FolderPlus,
  Library,
  Moon,
  Settings as SettingsIcon,
  Sun,
} from 'lucide-react'
import type { Theme } from '../shared/types'

export interface VaultSettingsValues {
  vaultName?: string
  defaultTemplate?: string
  ignoredPaths?: string[]
}

export interface VaultSettingsTemplate {
  name: string
  format: 'html' | 'md'
}

type SettingsTab = 'vault' | 'appearance'

export function VaultSettingsDialog({
  initial,
  templates,
  theme,
  currentVaultPath,
  currentVaultName,
  recentVaults,
  onSave,
  onChangeTheme,
  onOpenVault,
  onPickFolder,
  onCreateNewVault,
  onCloseVault,
  onCancel,
}: {
  initial: VaultSettingsValues
  templates: VaultSettingsTemplate[]
  theme: Theme
  currentVaultPath: string
  currentVaultName: string
  recentVaults: string[]
  onSave: (values: VaultSettingsValues) => Promise<void>
  onChangeTheme: (theme: Theme) => void
  onOpenVault: (rootPath: string) => void
  onPickFolder: () => void
  onCreateNewVault: () => void
  onCloseVault: () => void
  onCancel: () => void
}) {
  const [tab, setTab] = useState<SettingsTab>('vault')
  const [vaultName, setVaultName] = useState(initial.vaultName ?? '')
  const [defaultTemplate, setDefaultTemplate] = useState(initial.defaultTemplate ?? '')
  const [ignoredPathsText, setIgnoredPathsText] = useState((initial.ignoredPaths ?? []).join('\n'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const switcherWrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }
      event.preventDefault()
      if (switcherOpen) {
        setSwitcherOpen(false)
      } else {
        onCancel()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel, switcherOpen])

  useEffect(() => {
    if (!switcherOpen) {
      return
    }
    const handler = (event: MouseEvent) => {
      if (!switcherWrapperRef.current) {
        return
      }
      if (!switcherWrapperRef.current.contains(event.target as Node)) {
        setSwitcherOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [switcherOpen])

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      const ignoredPaths = ignoredPathsText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
      const trimmedName = vaultName.trim()
      const trimmedTemplate = defaultTemplate.trim()
      await onSave({
        ...(trimmedName ? { vaultName: trimmedName } : {}),
        ...(trimmedTemplate ? { defaultTemplate: trimmedTemplate } : {}),
        ...(ignoredPaths.length > 0 ? { ignoredPaths } : {}),
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
      setSaving(false)
    }
  }

  const otherRecents = recentVaults.filter((path) => path !== currentVaultPath)

  return (
    <div className="prompt-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Vault settings">
      <div className="vault-settings-dialog">
        <aside className="settings-sidebar">
          <header className="settings-sidebar-header">
            <SettingsIcon size={14} />
            <span>Settings</span>
          </header>
          <nav className="settings-tabs">
            <button
              type="button"
              className={tab === 'vault' ? 'active' : ''}
              onClick={() => setTab('vault')}
            >
              Vault
            </button>
            <button
              type="button"
              className={tab === 'appearance' ? 'active' : ''}
              onClick={() => setTab('appearance')}
            >
              Appearance
            </button>
          </nav>
          <div className="settings-sidebar-footer" ref={switcherWrapperRef}>
            <button
              type="button"
              className="vault-switcher-trigger"
              onClick={() => setSwitcherOpen((open) => !open)}
              aria-expanded={switcherOpen}
            >
              <Library size={14} />
              <span className="vault-switcher-name" title={currentVaultPath}>
                {currentVaultName}
              </span>
              <ChevronUp size={14} className={switcherOpen ? 'rotated' : ''} />
            </button>

            {switcherOpen ? (
              <div className="vault-switcher-popover" role="menu">
                {otherRecents.length > 0 ? (
                  <div className="vault-switcher-section">
                    <div className="vault-switcher-section-label">Switch to</div>
                    {otherRecents.slice(0, 6).map((path) => (
                      <button
                        type="button"
                        key={path}
                        className="vault-switcher-item"
                        onClick={() => {
                          setSwitcherOpen(false)
                          onOpenVault(path)
                        }}
                      >
                        <span className="vault-switcher-item-name">
                          {path.split(/[\\/]/).at(-1) ?? path}
                        </span>
                        <span className="vault-switcher-item-path">{path}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="vault-switcher-section">
                  <button
                    type="button"
                    className="vault-switcher-action"
                    onClick={() => {
                      setSwitcherOpen(false)
                      onPickFolder()
                    }}
                  >
                    <FolderOpen size={14} />
                    <span>Open another vault…</span>
                  </button>
                  <button
                    type="button"
                    className="vault-switcher-action"
                    onClick={() => {
                      setSwitcherOpen(false)
                      onCreateNewVault()
                    }}
                  >
                    <FolderPlus size={14} />
                    <span>Create new vault…</span>
                  </button>
                  <button
                    type="button"
                    className="vault-switcher-action destructive"
                    onClick={() => {
                      setSwitcherOpen(false)
                      onCloseVault()
                    }}
                  >
                    <DoorOpen size={14} />
                    <span>Close vault</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <main className="settings-content">
          {tab === 'vault' ? (
            <>
              <header className="settings-pane-header">
                <h2>Vault</h2>
                <p>
                  Stored at <code>.htmlvault/config.json</code> in this vault.
                </p>
              </header>

              <label className="settings-row">
                <div className="settings-row-label">
                  <span className="settings-row-name">Vault name</span>
                  <span className="settings-row-hint">Display name shown in the sidebar.</span>
                </div>
                <input
                  className="settings-row-control"
                  value={vaultName}
                  placeholder="My Vault"
                  onChange={(event) => setVaultName(event.target.value)}
                />
              </label>

              <label className="settings-row">
                <div className="settings-row-label">
                  <span className="settings-row-name">Default template</span>
                  <span className="settings-row-hint">
                    {templates.length === 0
                      ? 'Drop files into .htmlvault/templates/ to add templates.'
                      : 'Used when creating new files without an explicit template.'}
                  </span>
                </div>
                <select
                  className="settings-row-control"
                  value={defaultTemplate}
                  onChange={(event) => setDefaultTemplate(event.target.value)}
                >
                  <option value="">(none)</option>
                  {templates.map((template) => (
                    <option key={`${template.name}-${template.format}`} value={template.name}>
                      {template.name} ({template.format})
                    </option>
                  ))}
                </select>
              </label>

              <label className="settings-row settings-row-stack">
                <div className="settings-row-label">
                  <span className="settings-row-name">Ignored paths</span>
                  <span className="settings-row-hint">
                    One per line. Folder name (matches anywhere) or relative path from vault root.
                  </span>
                </div>
                <textarea
                  className="settings-row-control"
                  value={ignoredPathsText}
                  placeholder={'drafts\narchive/old\n_private'}
                  rows={6}
                  onChange={(event) => setIgnoredPathsText(event.target.value)}
                />
              </label>

              {error ? <div className="error-banner">{error}</div> : null}

              <div className="settings-content-actions">
                <button type="button" className="dialog-secondary" disabled={saving} onClick={onCancel}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="dialog-primary"
                  disabled={saving}
                  onClick={() => void handleSubmit()}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          ) : (
            <>
              <header className="settings-pane-header">
                <h2>Appearance</h2>
                <p>App-level preferences. Changes apply immediately.</p>
              </header>

              <div className="settings-row">
                <div className="settings-row-label">
                  <span className="settings-row-name">Theme</span>
                  <span className="settings-row-hint">Light or dark across the workspace and preview.</span>
                </div>
                <div className="settings-row-control settings-segmented">
                  <button
                    type="button"
                    className={theme === 'light' ? 'active' : ''}
                    onClick={() => onChangeTheme('light')}
                  >
                    <Sun size={14} />
                    <span>Light</span>
                  </button>
                  <button
                    type="button"
                    className={theme === 'dark' ? 'active' : ''}
                    onClick={() => onChangeTheme('dark')}
                  >
                    <Moon size={14} />
                    <span>Dark</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

import { FolderOpen, FolderPlus, Sparkles } from 'lucide-react'
import type { AppSettings } from '../shared/types'

export function WelcomeScreen({
  settings,
  busy,
  error,
  onOpenFolder,
  onCreateVault,
  onCreateDemo,
  onOpenRecent,
}: {
  settings: AppSettings
  busy: boolean
  error: string | null
  onOpenFolder: () => void
  onCreateVault: () => void
  onCreateDemo: () => void
  onOpenRecent: (rootPath: string) => void
}) {
  return (
    <main className="welcome-shell">
      <section className="welcome-stack">
        <h1 className="welcome-wordmark">ATELIER</h1>
        <p className="welcome-tagline">a workshop for HTML and Markdown</p>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="welcome-actions" aria-label="Start">
          <button type="button" className="welcome-action primary" disabled={busy} onClick={onOpenFolder}>
            <FolderOpen size={16} />
            <span>Open Vault</span>
          </button>
          <button type="button" className="welcome-action" disabled={busy} onClick={onCreateVault}>
            <FolderPlus size={16} />
            <span>New Vault</span>
          </button>
          <button type="button" className="welcome-action" disabled={busy} onClick={onCreateDemo}>
            <Sparkles size={16} />
            <span>Demo Vault</span>
          </button>
        </div>

        {settings.recentVaults.length ? (
          <section className="recent-panel">
            <h2>Recent</h2>
            <div className="recent-list">
              {settings.recentVaults.slice(0, 5).map((rootPath) => (
                <button type="button" key={rootPath} disabled={busy} onClick={() => onOpenRecent(rootPath)}>
                  <span>{rootPath.split(/[\\/]/).at(-1) ?? rootPath}</span>
                  <small>{rootPath}</small>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  )
}

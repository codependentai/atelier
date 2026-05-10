import { Clipboard } from 'lucide-react'

export function PromptPanel({
  selectedPath,
  onCopyPrompt,
}: {
  selectedPath: string
  onCopyPrompt: (kind: 'create' | 'revise') => void
}) {
  return (
    <div className="prompt-panel">
      <p>Copy a vault-aware instruction for Claude Code, Codex, or any local coding agent.</p>
      <div className="prompt-actions">
        <button type="button" onClick={() => onCopyPrompt('create')}>
          <Clipboard size={15} />
          <span>Create artifact</span>
        </button>
        <button type="button" onClick={() => onCopyPrompt('revise')} disabled={!selectedPath}>
          <Clipboard size={15} />
          <span>Revise selected</span>
        </button>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

export interface PromptDialogConfig {
  title: string
  message?: string
  defaultValue?: string
  placeholder?: string
  submitLabel?: string
  cancelLabel?: string
  selectOnFocus?: 'all' | 'stem'
}

export function PromptDialog({
  config,
  onSubmit,
  onCancel,
}: {
  config: PromptDialogConfig
  onSubmit: (value: string) => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [value, setValue] = useState(config.defaultValue ?? '')

  useEffect(() => {
    if (!inputRef.current) {
      return
    }

    inputRef.current.focus()
    const initial = config.defaultValue ?? ''
    if (config.selectOnFocus === 'stem') {
      const dotIndex = initial.lastIndexOf('.')
      if (dotIndex > 0) {
        inputRef.current.setSelectionRange(0, dotIndex)
        return
      }
    }
    inputRef.current.select()
  }, [config.defaultValue, config.selectOnFocus])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const trimmed = value.trim()
  const canSubmit = trimmed.length > 0

  const handleSubmit = () => {
    if (canSubmit) {
      onSubmit(trimmed)
    }
  }

  return (
    <div className="prompt-dialog-backdrop" role="dialog" aria-modal="true" aria-label={config.title}>
      <div className="prompt-dialog">
        <h2>{config.title}</h2>
        {config.message ? <p>{config.message}</p> : null}
        <input
          ref={inputRef}
          value={value}
          placeholder={config.placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleSubmit()
            }
          }}
        />
        <div className="prompt-dialog-actions">
          <button type="button" className="dialog-secondary" onClick={onCancel}>
            {config.cancelLabel ?? 'Cancel'}
          </button>
          <button type="button" className="dialog-primary" disabled={!canSubmit} onClick={handleSubmit}>
            {config.submitLabel ?? 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

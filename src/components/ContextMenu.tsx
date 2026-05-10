import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface ContextMenuItem {
  key: string
  label: string
  icon?: ReactNode
  destructive?: boolean
  separatorBefore?: boolean
  onSelect: () => void
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}) {
  const ref = useRef<HTMLUListElement | null>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    if (!ref.current) {
      return
    }

    const rect = ref.current.getBoundingClientRect()
    const padding = 8
    const maxLeft = window.innerWidth - rect.width - padding
    const maxTop = window.innerHeight - rect.height - padding

    setPosition({
      left: Math.max(padding, Math.min(x, maxLeft)),
      top: Math.max(padding, Math.min(y, maxTop)),
    })
  }, [x, y])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const handlePointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKey)
    window.addEventListener('pointerdown', handlePointer, true)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('pointerdown', handlePointer, true)
    }
  }, [onClose])

  return (
    <ul
      ref={ref}
      className="context-menu"
      role="menu"
      style={{ left: position.left, top: position.top }}
    >
      {items.map((item) => (
        <li key={item.key} role="none" className={item.separatorBefore ? 'has-separator' : undefined}>
          <button
            type="button"
            role="menuitem"
            className={item.destructive ? 'destructive' : undefined}
            onClick={() => {
              item.onSelect()
              onClose()
            }}
          >
            {item.icon ? <span className="context-menu-icon">{item.icon}</span> : null}
            <span>{item.label}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

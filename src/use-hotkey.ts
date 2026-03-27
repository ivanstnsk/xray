import { useEffect } from 'react'

export interface HotKey {
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  key: string
}

export const DEFAULT_HOT_KEY: HotKey = { metaKey: true, shiftKey: true, key: 'x' }

/**
 * Toggles a boolean state via keyboard shortcut.
 * Matches modifier keys exactly — e.g. Cmd+Shift+X won't fire if Alt is also held.
 */
export function useHotkey(
  hotKey: HotKey,
  onToggle: () => void,
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === hotKey.key &&
        !!e.metaKey === !!hotKey.metaKey &&
        !!e.ctrlKey === !!hotKey.ctrlKey &&
        !!e.altKey === !!hotKey.altKey &&
        !!e.shiftKey === !!hotKey.shiftKey
      ) {
        onToggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [hotKey.key, hotKey.metaKey, hotKey.ctrlKey, hotKey.altKey, hotKey.shiftKey, onToggle])
}

import { useEffect, useRef } from 'react'

export interface HotKey {
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  key: string
}

export type ActivationMode = 'toggle' | 'hold'

export const DEFAULT_HOT_KEY: HotKey = { metaKey: true, shiftKey: true, key: 'x' }

export interface UseHotkeyOptions {
  /** How the matching shortcut changes the inspector state. */
  activationMode?: ActivationMode
  /** Called when a matching keydown starts a hold activation. */
  onEnable?: () => void
  /** Called when a configured key/modifier keyup, blur, or visibility loss ends a hold activation. */
  onDisable?: () => void
}

const NOOP = () => {}

function matchesHotKey(
  e: KeyboardEvent,
  key: string,
  metaKey?: boolean,
  ctrlKey?: boolean,
  altKey?: boolean,
  shiftKey?: boolean,
) {
  return (
    e.key === key &&
    !!e.metaKey === !!metaKey &&
    !!e.ctrlKey === !!ctrlKey &&
    !!e.altKey === !!altKey &&
    !!e.shiftKey === !!shiftKey
  )
}

function isHotKeyPart(
  e: KeyboardEvent,
  key: string,
  metaKey?: boolean,
  ctrlKey?: boolean,
  altKey?: boolean,
  shiftKey?: boolean,
) {
  return (
    e.key === key ||
    (metaKey && e.key === 'Meta') ||
    (ctrlKey && e.key === 'Control') ||
    (altKey && e.key === 'Alt') ||
    (shiftKey && e.key === 'Shift')
  )
}

/**
 * Changes a boolean state via keyboard shortcut.
 * Matches modifier keys exactly — e.g. Cmd+Shift+X won't fire if Alt is also held.
 */
export function useHotkey(
  hotKey: HotKey,
  onToggle: () => void,
  {
    activationMode = 'toggle',
    onEnable = NOOP,
    onDisable = NOOP,
  }: UseHotkeyOptions = {},
) {
  const holdActiveRef = useRef(false)
  const { key, metaKey, ctrlKey, altKey, shiftKey } = hotKey

  useEffect(() => {
    const releaseHold = () => {
      if (!holdActiveRef.current) return
      holdActiveRef.current = false
      onDisable()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!matchesHotKey(e, key, metaKey, ctrlKey, altKey, shiftKey)) return

      if (activationMode === 'hold') {
        // Browsers emit repeated keydowns while a key is held. A hold starts
        // once and ends on keyup, so repeats must not re-trigger activation.
        if (!e.repeat) {
          holdActiveRef.current = true
          onEnable()
        }
        return
      }

      onToggle()
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      // A modifier's keyup clears its modifier flag before the event is
      // dispatched, so the full shortcut no longer matches at that point.
      // Release on any part of an active shortcut instead.
      if (
        activationMode === 'hold' &&
        holdActiveRef.current &&
        isHotKeyPart(e, key, metaKey, ctrlKey, altKey, shiftKey)
      ) {
        releaseHold()
      }
    }

    const handleWindowBlur = releaseHold

    const handleVisibilityChange = () => {
      if (
        activationMode === 'hold' &&
        (document.hidden || document.visibilityState === 'hidden')
      ) {
        releaseHold()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    if (activationMode === 'hold') {
      window.addEventListener('keyup', handleKeyUp)
      window.addEventListener('blur', handleWindowBlur)
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (activationMode === 'hold') {
        window.removeEventListener('keyup', handleKeyUp)
        window.removeEventListener('blur', handleWindowBlur)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        releaseHold()
      }
    }
  }, [
    key,
    metaKey,
    ctrlKey,
    altKey,
    shiftKey,
    activationMode,
    onToggle,
    onEnable,
    onDisable,
  ])
}

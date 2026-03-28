'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useBadge } from './use-badge'
import { useHotkey, DEFAULT_HOT_KEY, type HotKey } from './use-hotkey'
import { useInspector } from './use-inspector'
import { useNextIndicator } from './use-next-indicator'

// --- Types ---

export interface XrayProps {
  /** Keyboard shortcut to toggle. Default: Cmd+Shift+X */
  hotKey?: HotKey
  /** code-inspector-plugin server port. Default: 5678 */
  port?: number
  /** Accent color for overlay/tooltip/button. Default: '#6366f1' (indigo) */
  color?: string
  /** Whether to show the floating toggle button. Default: true */
  showButton?: boolean
  /** Whether to position next to Next.js dev indicator. Default: true */
  followNextIndicator?: boolean
}

const DEFAULT_PORT = 5678
const DEFAULT_COLOR = '#6366f1'

function colorWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// --- Component ---

function XrayImpl({
  hotKey = DEFAULT_HOT_KEY,
  port = DEFAULT_PORT,
  color = DEFAULT_COLOR,
  showButton = true,
  followNextIndicator = true,
}: XrayProps = {}) {
  const [mounted, setMounted] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)

  const toggle = useCallback(() => setEnabled((prev) => !prev), [])

  useEffect(() => setMounted(true), [])
  const { element: anchor, isDragging, searching } = useNextIndicator(followNextIndicator)

  useHotkey(hotKey, toggle)
  useBadge({ badgeRef, show: showButton && !searching, anchor, anchorDragging: isDragging, onTap: toggle })
  useInspector({
    enabled,
    port,
    overlayRef,
    tooltipRef,
    ignoreRefs: [badgeRef],
  })

  if (!mounted) return null

  return createPortal(
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          zIndex: 99998,
          border: `2px solid ${color}`,
          borderRadius: '3px',
          backgroundColor: colorWithAlpha(color, 0.08),
          transition: 'none',
          display: 'none',
        }}
      />
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          zIndex: 99999,
          backgroundColor: color,
          color: 'white',
          fontSize: '11px',
          fontFamily: 'monospace',
          fontWeight: 600,
          padding: '2px 7px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          display: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
      />
      {/* Toggle button */}
      {showButton && (
        <div
          ref={badgeRef}
          style={{
            position: 'fixed',
            zIndex: 2147483646,
            width: '36px',
            height: '36px',
            transformOrigin: 'center center',
            scale: '0',
          }}
        >
          <button
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(48px)',
              border: 'none',
              borderRadius: '50%',
              boxShadow: enabled
                ? `0 0 0 1px ${color}, inset 0 0 0 1px ${colorWithAlpha(color, 0.4)}, 0 16px 32px -8px rgba(0, 0, 0, 0.24)`
                : '0 0 0 1px #171717, inset 0 0 0 1px hsla(0, 0%, 100%, 0.14), 0 16px 32px -8px rgba(0, 0, 0, 0.24)',
              opacity: enabled ? 1 : 0.4,
              transition: 'opacity 200ms ease, box-shadow 200ms ease',
              cursor: 'pointer',
              userSelect: 'none',
              padding: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
            onMouseLeave={(e) => {
              if (!enabled) e.currentTarget.style.opacity = '0.4'
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={enabled ? color : 'white'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transition:
                  'stroke 200ms ease, transform 300ms cubic-bezier(0.23, 0.88, 0.26, 0.92)',
                transform: enabled ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            >
              <circle cx="12" cy="12" r="10" strokeOpacity="0.5" />
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          </button>
        </div>
      )}
    </>,
    document.body,
  )
}

export const Xray: (props?: XrayProps) => React.ReactNode =
  process.env.NODE_ENV === 'development' ? XrayImpl : () => null

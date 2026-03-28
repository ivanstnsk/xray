import { useEffect, useRef, type RefObject } from 'react'

const BADGE_SIZE = 36
const BADGE_GAP = 4
const DRAG_THRESHOLD = 10
const EDGE_MARGIN = 12

interface UseBadgeOptions {
  badgeRef: RefObject<HTMLElement | null>
  show: boolean
  /** Element to anchor next to. When null, badge is independently draggable. */
  anchor: HTMLElement | null
  /** Whether the anchor is currently being dragged (hides badge until settled). */
  anchorDragging: boolean
  /** Called on tap (pointerup without drag). */
  onTap?: () => void
}

const TOAST_ATTR = 'data-xray-toast'

const MESSAGES = [
  'here you are',
  'found you',
  'right behind you',
  'missed me?',
  'can\'t escape me',
]

// --- "Just for fun" toast messages ---
// Completely unnecessary. The badge works fine without this.
// But where's the joy in that?

const TOAST_GAP = 24

function showToast(badge: HTMLElement) {
  removeToast()

  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
  const toast = document.createElement('div')
  toast.setAttribute(TOAST_ATTR, '')
  toast.textContent = msg

  Object.assign(toast.style, {
    position: 'fixed',
    zIndex: '2147483647',
    opacity: '0',
    whiteSpace: 'nowrap',
    fontSize: '11px',
    fontFamily: 'system-ui, sans-serif',
    fontWeight: '600',
    color: '#fff',
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(12px)',
    padding: '4px 10px',
    borderRadius: '8px',
    pointerEvents: 'none',
    transition: 'opacity 300ms ease, transform 300ms cubic-bezier(0.23, 0.88, 0.26, 0.92)',
  } satisfies Partial<CSSStyleDeclaration>)

  document.body.appendChild(toast)

  // Badge in top half → toast below; badge in bottom half → toast above.
  // Horizontally centered on badge.
  const badgeRect = badge.getBoundingClientRect()
  const toastRect = toast.getBoundingClientRect()

  const isTop = badgeRect.top + BADGE_SIZE / 2 < window.innerHeight / 2
  const top = isTop
    ? badgeRect.bottom + TOAST_GAP
    : badgeRect.top - TOAST_GAP - toastRect.height

  const badgeCenterX = badgeRect.left + badgeRect.width / 2
  const left = badgeCenterX - toastRect.width / 2
  const slideFrom = isTop ? -8 : 8

  toast.style.top = `${top}px`
  toast.style.left = `${left}px`
  toast.style.transform = `translateY(${slideFrom}px)`

  void toast.offsetHeight
  toast.style.opacity = '1'
  toast.style.transform = 'translateY(0)'
}

function removeToast(immediate = false) {
  const existing = document.querySelector(`[${TOAST_ATTR}]`) as HTMLElement | null
  if (!existing) return
  if (immediate) {
    existing.remove()
    return
  }
  existing.style.opacity = '0'
  existing.addEventListener('transitionend', () => existing.remove(), { once: true })
}

const SPRING = 'scale 300ms cubic-bezier(0.23, 0.88, 0.26, 0.92)'

function reveal(badge: HTMLElement) {
  badge.style.transition = SPRING
  badge.style.scale = '1'
  const onEnd = () => {
    badge.style.transition = ''
    badge.removeEventListener('transitionend', onEnd)
  }
  badge.addEventListener('transitionend', onEnd)
}

/**
 * Positions the floating toggle button. Two modes:
 *
 * 1. **Anchored** (`anchor` is set) — positions beside the anchor element and
 *    hides/reappears when the anchor is dragged.
 * 2. **Standalone** (`anchor` is null) — positions at bottom-left and is
 *    directly draggable by the user to any screen edge.
 */
export function useBadge({ badgeRef, show, anchor, anchorDragging, onTap }: UseBadgeOptions) {
  const hasDraggedRef = useRef(false)

  // Reset when anchor changes (new indicator, or lost).
  useEffect(() => {
    hasDraggedRef.current = false
  }, [anchor])

  // --- Anchored mode: track anchor position ---
  useEffect(() => {
    if (!show || !anchor) return

    const badge = badgeRef.current
    if (!badge) return

    // Start hidden — reveal after first position is set.
    badge.style.scale = '0'
    let revealed = false
    let rafId: number
    let lastKey = ''

    const position = () => {
      const rect = anchor.getBoundingClientRect()
      const midX = rect.left + rect.width / 2
      const isRight = midX > window.innerWidth / 2

      badge.style.bottom = ''
      badge.style.left = isRight
        ? `${rect.left - BADGE_SIZE - BADGE_GAP}px`
        : `${rect.right + BADGE_GAP}px`
      badge.style.top = `${rect.top + (rect.height - BADGE_SIZE) / 2}px`
    }

    const tick = () => {
      const rect = anchor.getBoundingClientRect()
      const key = `${rect.top},${rect.left},${rect.right},${rect.bottom}`
      if (key !== lastKey) {
        lastKey = key
        position()
        if (!revealed) {
          revealed = true
          reveal(badge)
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(rafId)
  }, [badgeRef, show, anchor])

  // --- Anchored mode: hide/reappear during anchor drag ---
  useEffect(() => {
    if (!show || !anchor) return

    const badge = badgeRef.current
    if (!badge) return

    let hideTimeout: ReturnType<typeof setTimeout> | undefined
    let reappearTimeout: ReturnType<typeof setTimeout> | undefined
    let toastTimeout: ReturnType<typeof setTimeout> | undefined

    if (anchorDragging) {
      hasDraggedRef.current = true
      badge.style.transition = 'scale 200ms ease'
      badge.style.scale = '0'
      hideTimeout = setTimeout(() => {
        badge.style.display = 'none'
      }, 200)
    } else {
      clearTimeout(hideTimeout)
      reappearTimeout = setTimeout(() => {
        badge.style.scale = '0'
        badge.style.display = ''
        badge.style.transition = SPRING
        void badge.offsetHeight
        badge.style.scale = '1'
        if (hasDraggedRef.current) {
          showToast(badge)
          toastTimeout = setTimeout(() => removeToast(), 2000)
        }
      }, 1000)
    }

    return () => {
      clearTimeout(hideTimeout)
      clearTimeout(reappearTimeout)
      clearTimeout(toastTimeout)
      removeToast()
    }
  }, [badgeRef, show, anchor, anchorDragging])

  // --- Standalone mode: draggable badge ---
  useEffect(() => {
    if (!show || anchor) return

    const badge = badgeRef.current
    if (!badge) return

    // Position first, then reveal.
    badge.style.scale = '0'
    badge.style.top = ''
    badge.style.bottom = `${EDGE_MARGIN}px`
    badge.style.left = `${EDGE_MARGIN}px`
    requestAnimationFrame(() => reveal(badge))

    let dragging = false
    let dragStartX = 0
    let dragStartY = 0
    let badgeStartX = 0
    let badgeStartY = 0
    let moved = false

    const onPointerDown = (e: PointerEvent) => {
      if (!badge.contains(e.target as Node)) return
      dragging = true
      moved = false
      dragStartX = e.clientX
      dragStartY = e.clientY
      const rect = badge.getBoundingClientRect()
      badgeStartX = rect.left
      badgeStartY = rect.top
      badge.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - dragStartX
      const dy = e.clientY - dragStartY
      if (!moved && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return
      if (!moved) badge.style.cursor = 'grabbing'
      moved = true

      let x = badgeStartX + dx
      let y = badgeStartY + dy
      x = Math.max(0, Math.min(x, window.innerWidth - BADGE_SIZE))
      y = Math.max(0, Math.min(y, window.innerHeight - BADGE_SIZE))

      badge.style.bottom = ''
      badge.style.left = `${x}px`
      badge.style.top = `${y}px`
    }

    const snapToCorner = (x: number, y: number) => {
      const midX = x + BADGE_SIZE / 2
      const midY = y + BADGE_SIZE / 2
      const snapLeft = midX < window.innerWidth / 2
      const snapTop = midY < window.innerHeight / 2

      badge.style.transition = 'left 300ms cubic-bezier(0.23, 0.88, 0.26, 0.92), top 300ms cubic-bezier(0.23, 0.88, 0.26, 0.92)'
      badge.style.left = snapLeft
        ? `${EDGE_MARGIN}px`
        : `${window.innerWidth - BADGE_SIZE - EDGE_MARGIN}px`
      badge.style.top = snapTop
        ? `${EDGE_MARGIN}px`
        : `${window.innerHeight - BADGE_SIZE - EDGE_MARGIN}px`

      const onEnd = () => {
        badge.style.transition = ''
        badge.removeEventListener('transitionend', onEnd)
      }
      badge.addEventListener('transitionend', onEnd)
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      badge.style.cursor = ''
      badge.releasePointerCapture(e.pointerId)

      if (moved) {
        const rect = badge.getBoundingClientRect()
        snapToCorner(rect.left, rect.top)
      }
    }

    badge.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove, true)
    window.addEventListener('pointerup', onPointerUp, true)

    return () => {
      badge.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove, true)
      window.removeEventListener('pointerup', onPointerUp, true)
    }
  }, [badgeRef, show, anchor])

  // --- Tap detection (both modes) ---
  // Fires onTap on pointerup if the pointer didn't move past the drag threshold.
  const onTapRef = useRef(onTap)
  onTapRef.current = onTap

  useEffect(() => {
    if (!show) return
    const badge = badgeRef.current
    if (!badge) return

    let down = false
    let startX = 0
    let startY = 0
    let moved = false

    const onPointerDown = (e: PointerEvent) => {
      if (!badge.contains(e.target as Node)) return
      down = true
      moved = false
      startX = e.clientX
      startY = e.clientY
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!down || moved) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) {
        moved = true
      }
    }

    const onPointerUp = () => {
      if (!down) return
      down = false
      if (!moved) onTapRef.current?.()
    }

    badge.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove, true)
    window.addEventListener('pointerup', onPointerUp, true)

    return () => {
      badge.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove, true)
      window.removeEventListener('pointerup', onPointerUp, true)
    }
  }, [badgeRef, show])
}

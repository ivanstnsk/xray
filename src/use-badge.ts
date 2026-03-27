import { useEffect, type RefObject } from 'react'

const BADGE_SIZE = 36
const BADGE_GAP = 4
const DRAG_THRESHOLD = 10

function findNextjsIndicator(): HTMLElement | null {
  const portal = document.querySelector('nextjs-portal')
  if (!portal?.shadowRoot) return null
  return (
    (portal.shadowRoot.querySelector('[data-nextjs-toast]') ??
      portal.shadowRoot.querySelector('div')) as HTMLElement | null
  )
}

interface UseBadgeOptions {
  badgeRef: RefObject<HTMLElement | null>
  show: boolean
  followNextIndicator: boolean
}

/**
 * Positions the floating toggle button. When `followNextIndicator` is true,
 * tracks the Next.js dev indicator (which is draggable to any corner) and
 * hides during drag with a scale animation. Falls back to bottom-left when
 * no indicator is found.
 *
 * Fixes from the original:
 * - Cleans up timeouts on unmount (no stale refs firing after teardown).
 * - Stops the rAF loop once the fallback position is set (no wasted frames).
 */
export function useBadge({ badgeRef, show, followNextIndicator }: UseBadgeOptions) {
  useEffect(() => {
    if (!show) return

    const badge = badgeRef.current
    if (!badge) return

    // Start invisible until first position is set.
    badge.style.scale = '0'

    let rafId: number
    let dragging = false
    let dragStartX = 0
    let dragStartY = 0
    let hidden = false
    let settling = false
    let positioned = false
    let settled = false // true once fallback position is locked in
    let hideTimeout: ReturnType<typeof setTimeout> | undefined
    let reappearTimeout: ReturnType<typeof setTimeout> | undefined

    const getIndicator = (): HTMLElement | null =>
      followNextIndicator ? findNextjsIndicator() : null

    const positionBadge = () => {
      if (!badge) return

      const indicator = getIndicator()
      if (indicator) {
        const rect = indicator.getBoundingClientRect()
        const midX = rect.left + rect.width / 2
        const isRight = midX > window.innerWidth / 2

        badge.style.left = ''
        badge.style.bottom = ''
        badge.style.left = isRight
          ? `${rect.left - BADGE_SIZE - BADGE_GAP}px`
          : `${rect.right + BADGE_GAP}px`
        badge.style.top = `${rect.top + (rect.height - BADGE_SIZE) / 2}px`
      } else {
        badge.style.top = ''
        badge.style.bottom = '12px'
        badge.style.left = '12px'
        settled = true
      }

      if (!positioned) {
        positioned = true
        requestAnimationFrame(() => {
          badge.style.scale = '1'
        })
      }
    }

    // --- Drag detection (hides badge while Next.js indicator is dragged) ---

    const onPointerDown = (e: PointerEvent) => {
      const indicator = getIndicator()
      if (!indicator) return
      const rect = indicator.getBoundingClientRect()
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        dragging = true
        dragStartX = e.clientX
        dragStartY = e.clientY
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - dragStartX
      const dy = e.clientY - dragStartY
      if (!hidden && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        hidden = true
        settling = true
        badge.style.transition = 'scale 200ms ease'
        badge.style.scale = '0'
        hideTimeout = setTimeout(() => {
          badge.style.display = 'none'
        }, 200)
      }
    }

    const onPointerUp = () => {
      if (!dragging) return
      dragging = false
      if (hidden) {
        reappearTimeout = setTimeout(() => {
          hidden = false
          settling = false
          settled = false // indicator moved, re-enter polling
          badge.style.scale = '0'
          badge.style.display = ''
          badge.style.transition = 'scale 300ms cubic-bezier(0.23, 0.88, 0.26, 0.92)'
          void badge.offsetHeight // force reflow
          badge.style.scale = '1'
        }, 1000)
      }
    }

    // --- Position polling ---

    let lastKey = ''
    const tick = () => {
      if (settled) return // fallback position locked, stop polling

      if (!hidden && !settling) {
        const indicator = getIndicator()
        if (indicator) {
          const rect = indicator.getBoundingClientRect()
          const key = `${rect.top},${rect.left},${rect.right},${rect.bottom}`
          if (key !== lastKey) {
            lastKey = key
            positionBadge()
          }
        } else if (lastKey !== 'fallback') {
          lastKey = 'fallback'
          positionBadge()
        }
      }

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointermove', onPointerMove, true)
    window.addEventListener('pointerup', onPointerUp, true)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(hideTimeout)
      clearTimeout(reappearTimeout)
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointermove', onPointerMove, true)
      window.removeEventListener('pointerup', onPointerUp, true)
    }
  }, [badgeRef, show, followNextIndicator])
}

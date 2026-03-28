import { useEffect, useRef, useState } from 'react'

const DRAG_THRESHOLD = 10

function findIndicator(): HTMLElement | null {
  for (const portal of document.querySelectorAll('nextjs-portal')) {
    if (!portal.shadowRoot) continue
    const toast = portal.shadowRoot.querySelector('[data-nextjs-toast]') as HTMLElement | null
    if (toast) return toast
  }
  return null
}

const DISCOVERY_TIMEOUT = 5000

export interface NextIndicatorState {
  element: HTMLElement | null
  isDragging: boolean
  /** True while still searching for the indicator. Badge should wait. */
  searching: boolean
}

/**
 * Discovers the Next.js dev indicator via MutationObserver (no polling),
 * then tracks drag gestures on it so the badge can hide during reposition.
 */
export function useNextIndicator(enabled: boolean): NextIndicatorState {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [isDragging, setDragging] = useState(false)
  const [searching, setSearching] = useState(enabled)
  const elementRef = useRef<HTMLElement | null>(null)

  // --- Discovery: MutationObserver watching for <nextjs-portal> ---
  useEffect(() => {
    if (!enabled) {
      elementRef.current = null
      setElement(null)
      setSearching(false)
      return
    }

    // Check if already in the DOM.
    const existing = findIndicator()
    if (existing) {
      elementRef.current = existing
      setElement(existing)
      return
    }

    // Only search if Next.js portals exist (meaning Next.js is loading
    // but the toast hasn't rendered yet). No portals = not a Next.js app.
    const hasPortals = document.querySelectorAll('nextjs-portal').length > 0
    if (!hasPortals) {
      setSearching(false)
      return
    }

    setSearching(true)
    const observers: MutationObserver[] = []

    const found = (el: HTMLElement) => {
      elementRef.current = el
      setElement(el)
      setSearching(false)
      observers.forEach((o) => o.disconnect())
      clearTimeout(timeout)
    }

    // Give up after DISCOVERY_TIMEOUT and fall back to standalone mode.
    const timeout = setTimeout(() => {
      setSearching(false)
      observers.forEach((o) => o.disconnect())
    }, DISCOVERY_TIMEOUT)

    // Watch shadow roots of existing portals that haven't rendered the toast yet.
    const observeShadowRoots = () => {
      for (const portal of document.querySelectorAll('nextjs-portal')) {
        if (!portal.shadowRoot) continue
        const shadowObserver = new MutationObserver(() => {
          const indicator = findIndicator()
          if (indicator) found(indicator)
        })
        shadowObserver.observe(portal.shadowRoot, { childList: true, subtree: true })
        observers.push(shadowObserver)
      }
    }

    observeShadowRoots()

    // Watch for new <nextjs-portal> elements being added to the DOM,
    // then observe their shadow roots for the toast.
    const bodyObserver = new MutationObserver(() => {
      const indicator = findIndicator()
      if (indicator) {
        found(indicator)
      } else {
        observeShadowRoots()
      }
    })
    bodyObserver.observe(document.body, { childList: true, subtree: true })
    observers.push(bodyObserver)

    return () => {
      clearTimeout(timeout)
      observers.forEach((o) => o.disconnect())
    }
  }, [enabled])

  // --- Drag detection on the discovered element ---
  useEffect(() => {
    if (!element) return

    let dragging = false
    let startX = 0
    let startY = 0

    const onPointerDown = (e: PointerEvent) => {
      const rect = element.getBoundingClientRect()
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        dragging = true
        startX = e.clientX
        startY = e.clientY
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) {
        setDragging(true)
      }
    }

    const onPointerUp = () => {
      if (!dragging) return
      dragging = false
      setDragging(false)
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointermove', onPointerMove, true)
    window.addEventListener('pointerup', onPointerUp, true)

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointermove', onPointerMove, true)
      window.removeEventListener('pointerup', onPointerUp, true)
    }
  }, [element])

  return { element, isDragging, searching }
}

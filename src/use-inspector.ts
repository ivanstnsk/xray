import { useEffect, useRef, type RefObject } from 'react'

// --- Fiber utilities ---

function getFiberFromElement(el: Element): any | null {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'))
  return key ? (el as any)[key] : null
}

function getComponentName(fiber: any): string | null {
  if (!fiber.type || typeof fiber.type === 'string') return null
  return fiber.type.displayName || fiber.type.name || null
}

function getComponentInfo(el: Element): { name: string } | null {
  let fiber = getFiberFromElement(el)
  if (!fiber) return null

  let depth = 0
  while (fiber && depth < 30) {
    const name = getComponentName(fiber)
    if (name) return { name }
    fiber = fiber.return
    depth++
  }

  return null
}

// --- data-insp-path utilities ---

function parseInspPath(attr: string) {
  const parts = attr.split(':')
  parts.pop() // nodeName
  const column = parts.pop()!
  const line = parts.pop()!
  const filePath = parts.join(':') // join handles Windows paths with ':'
  return { filePath, line, column }
}

function findInspPath(el: Element | null): string | null {
  while (el) {
    const attr = el.getAttribute?.('data-insp-path')
    if (attr) return attr
    el = el.parentElement
  }
  return null
}

// --- Hook ---

interface UseInspectorOptions {
  enabled: boolean
  port: number
  overlayRef: RefObject<HTMLDivElement | null>
  tooltipRef: RefObject<HTMLDivElement | null>
  /** Elements to ignore during inspection (e.g. the badge). */
  ignoreRefs: RefObject<HTMLElement | null>[]
}

/**
 * When enabled, highlights the React component under the cursor and opens
 * its source file on click. Blocks all pointer interactions to prevent
 * accidental navigation.
 *
 * Uses a rAF loop instead of scroll events so it stays in sync with
 * smooth-scrolling libraries (Lenis, etc.).
 */
export function useInspector({
  enabled,
  port,
  overlayRef,
  tooltipRef,
  ignoreRefs,
}: UseInspectorOptions) {
  const currentTarget = useRef<Element | null>(null)

  // Block interactions + click-to-open
  useEffect(() => {
    if (!enabled) return

    const isIgnored = (e: Event) =>
      ignoreRefs.some(
        (ref) =>
          ref.current &&
          (e.target === ref.current || ref.current.contains(e.target as Node)),
      )

    const blockEvent = (e: Event) => {
      if (isIgnored(e)) return
      e.preventDefault()
      e.stopPropagation()
    }

    const handleClick = (e: MouseEvent) => {
      if (isIgnored(e)) return
      e.preventDefault()
      e.stopPropagation()

      const attr = findInspPath(e.target as Element)
      if (!attr) return

      const { filePath, line, column } = parseInspPath(attr)
      const url = `http://localhost:${port}/?file=${encodeURIComponent(filePath)}&line=${line}&column=${column}`
      const xhr = new XMLHttpRequest()
      xhr.open('GET', url, true)
      xhr.send()
    }

    const events = ['mousedown', 'mouseup', 'pointerdown', 'pointerup'] as const
    window.addEventListener('click', handleClick, true)
    events.forEach((e) => window.addEventListener(e, blockEvent, true))
    return () => {
      window.removeEventListener('click', handleClick, true)
      events.forEach((e) => window.removeEventListener(e, blockEvent, true))
    }
  }, [enabled, port, ignoreRefs])

  // Hover tracking + overlay positioning via rAF
  useEffect(() => {
    if (!enabled) {
      if (overlayRef.current) overlayRef.current.style.display = 'none'
      if (tooltipRef.current) tooltipRef.current.style.display = 'none'
      currentTarget.current = null
      return
    }

    let mouseX = 0
    let mouseY = 0

    const hideOverlay = () => {
      if (overlayRef.current) overlayRef.current.style.display = 'none'
      if (tooltipRef.current) tooltipRef.current.style.display = 'none'
    }

    const isIgnoredElement = (target: Element) =>
      ignoreRefs.some(
        (ref) => ref.current && (target === ref.current || ref.current.contains(target)),
      )

    const updateTooltipContent = (target: Element, info: { name: string }) => {
      const tooltip = tooltipRef.current
      if (!tooltip) return

      tooltip.textContent = ''

      const nameLine = document.createElement('div')
      nameLine.textContent = info.name
      tooltip.appendChild(nameLine)

      const attr = findInspPath(target)
      if (attr) {
        const { filePath, line } = parseInspPath(attr)
        const pathLine = document.createElement('div')
        pathLine.textContent = `${filePath}:${line}`
        pathLine.style.opacity = '0.7'
        pathLine.style.fontSize = '10px'
        tooltip.appendChild(pathLine)
      }
    }

    const inspectTarget = (target: Element) => {
      if (
        !target ||
        target === overlayRef.current ||
        target === tooltipRef.current ||
        isIgnoredElement(target) ||
        target === document.documentElement ||
        target === document.body
      ) {
        if (target === document.documentElement || target === document.body) {
          hideOverlay()
          currentTarget.current = null
        }
        return
      }

      if (target === currentTarget.current) return
      currentTarget.current = target

      const info = getComponentInfo(target)
      if (!info) {
        hideOverlay()
        return
      }

      updateTooltipContent(target, info)
    }

    const updateOverlayPosition = () => {
      const target = currentTarget.current
      if (!target || !target.isConnected) {
        hideOverlay()
        return
      }

      const rect = target.getBoundingClientRect()

      if (overlayRef.current) {
        const s = overlayRef.current.style
        s.display = 'block'
        s.top = `${rect.top}px`
        s.left = `${rect.left}px`
        s.width = `${rect.width}px`
        s.height = `${rect.height}px`
      }

      if (tooltipRef.current) {
        const s = tooltipRef.current.style
        s.display = 'block'

        const gap = 12
        let top = mouseY + gap
        let left = mouseX + gap

        if (top + tooltipRef.current.offsetHeight > window.innerHeight) {
          top = mouseY - tooltipRef.current.offsetHeight - gap
        }
        if (left + tooltipRef.current.offsetWidth > window.innerWidth) {
          left = mouseX - tooltipRef.current.offsetWidth - gap
        }

        s.top = `${Math.max(0, top)}px`
        s.left = `${Math.max(0, left)}px`
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
      inspectTarget(e.target as Element)
      updateOverlayPosition()
    }

    const handleMouseLeave = () => {
      hideOverlay()
      currentTarget.current = null
    }

    let rafId: number
    const tick = () => {
      const el = document.elementFromPoint(mouseX, mouseY)
      if (el) inspectTarget(el)
      updateOverlayPosition()
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [enabled, overlayRef, tooltipRef, ignoreRefs])
}

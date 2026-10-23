import { useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'

/** How far a row must be dragged, as a share of its width, before letting go triggers the action. */
const TRIGGER = 0.3
/** Movement before deciding whether the finger is scrolling or swiping. */
const SLOP = 8

export type SwipeState = 'idle' | 'dragging' | 'settling'

/**
 * iOS-style swipe on a row, for touch only: left for `onLeft`, right for `onRight`. Vertical
 * movement is left to the browser, so the list still scrolls normally.
 */
export function useSwipe(onLeft: () => void, onRight: () => void) {
  const [dx, setDx] = useState(0)
  const [state, setState] = useState<SwipeState>('idle')
  const [width, setWidth] = useState(0)
  const start = useRef<{ x: number; y: number; width: number } | null>(null)
  const axis = useRef<'x' | 'y' | null>(null)
  // A swipe ends with a click on whatever is under the finger; that click must not count.
  const swallowClick = useRef(false)

  function onPointerDown(e: ReactPointerEvent<HTMLElement>) {
    if (e.pointerType !== 'touch' || state === 'settling') return
    start.current = { x: e.clientX, y: e.clientY, width: e.currentTarget.offsetWidth }
    axis.current = null
  }

  function onPointerMove(e: ReactPointerEvent<HTMLElement>) {
    if (!start.current) return
    const moveX = e.clientX - start.current.x
    const moveY = e.clientY - start.current.y
    if (axis.current === null) {
      if (Math.abs(moveX) > SLOP && Math.abs(moveX) > Math.abs(moveY)) {
        axis.current = 'x'
        e.currentTarget.setPointerCapture(e.pointerId)
        setWidth(start.current.width)
        setState('dragging')
      } else if (Math.abs(moveY) > SLOP) {
        axis.current = 'y'
      }
    }
    if (axis.current !== 'x') return
    // Past the trigger point the row follows the finger more slowly, like iOS.
    const limit = start.current.width * TRIGGER
    const eased =
      Math.abs(moveX) > limit ? Math.sign(moveX) * (limit + (Math.abs(moveX) - limit) * 0.5) : moveX
    setDx(eased)
  }

  function finish() {
    const begun = start.current
    start.current = null
    if (!begun || axis.current !== 'x') return
    swallowClick.current = true
    setTimeout(() => (swallowClick.current = false), 50)
    const limit = begun.width * TRIGGER
    setState('settling')
    if (dx <= -limit) {
      // Slide the row out of view, then remove it.
      setDx(-begun.width)
      setTimeout(() => {
        onLeft()
        setDx(0)
        setState('idle')
      }, 180)
    } else {
      setDx(0)
      setTimeout(() => setState('idle'), 180)
      if (dx >= limit) onRight()
    }
  }

  return {
    dx,
    state,
    /** True while past the trigger point, so the action underneath can show it will happen. */
    armed: state === 'dragging' && Math.abs(dx) >= width * TRIGGER,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      onClickCapture: (e: ReactMouseEvent) => {
        if (swallowClick.current) {
          e.preventDefault()
          e.stopPropagation()
        }
      },
    },
  }
}

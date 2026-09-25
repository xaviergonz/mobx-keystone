import { useLayoutEffect, useRef } from "react"
import styles from "./TreeGraphic.module.css"

export const pulseDuration = 650

/** A glowing dot that travels once along `d`, from its end to its start, after `delay` ms. */
export function Pulse({ d, delay = 0 }: { d: string; delay?: number }) {
  const pathRef = useRef<SVGPathElement>(null)
  const dotRef = useRef<SVGGElement>(null)

  // Layout effect, so the dot is placed before the first paint instead of flashing at 0,0.
  useLayoutEffect(() => {
    const path = pathRef.current
    const dot = dotRef.current
    if (!path || !dot) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dot.style.display = "none"
      return
    }

    const length = path.getTotalLength()
    const place = (t: number) => {
      // Ease in and out, so the dot is seen along the whole branch.
      const u = Math.max(0, t)
      const eased = u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2
      const p = path.getPointAtLength(length * (1 - eased))
      dot.setAttribute("transform", `translate(${p.x} ${p.y})`)
      // Hidden until it starts; then fades in quickly and out at the very end.
      dot.style.opacity = t < 0 ? "0" : String(Math.min(1, t * 6, (1 - t) * 6))
    }

    let frame = 0
    const start = performance.now() + delay
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / pulseDuration)
      place(t)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    place(-1)
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [delay])

  return (
    <g>
      <path ref={pathRef} d={d} fill="none" stroke="none" />
      <g ref={dotRef} className={styles.pulse}>
        <circle r="9" className={styles.pulseHalo} />
        <circle r="4" className={styles.pulseCore} />
      </g>
    </g>
  )
}

import { useLayoutEffect, useState } from "react"
import styles from "./TreeGraphic.module.css"

const typingDelay = 90

/** How long erasing `from` and typing `to` takes. */
export const typingDuration = (from: string, to: string) => (from.length + to.length) * typingDelay

/** A todo's text; when `typeFrom` is given, it erases that text and types the new one letter by letter. */
export function TodoLabel({
  className,
  x,
  text,
  typeFrom,
}: {
  className: string
  x: number
  text: string
  typeFrom?: string
}) {
  const [typed, setTyped] = useState<string | undefined>(undefined)

  // Layout effect, so the new text never flashes before the typing starts.
  useLayoutEffect(() => {
    if (typeFrom === undefined || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(undefined)
      return
    }
    // Every intermediate string: erase the old text, then type the new one.
    const frames: string[] = []
    for (let n = typeFrom.length; n >= 0; n--) frames.push(typeFrom.slice(0, n))
    for (let n = 1; n <= text.length; n++) frames.push(text.slice(0, n))

    let frame = 0
    setTyped(frames[0])
    const timer = setInterval(() => {
      frame++
      if (frame >= frames.length) {
        clearInterval(timer)
        setTyped(undefined)
        return
      }
      setTyped(frames[frame])
    }, typingDelay)
    return () => clearInterval(timer)
  }, [typeFrom, text])

  const typing = typed !== undefined
  return (
    <text className={className} x={x} y="222">
      "{typing ? typed : text}
      {typing && <tspan className={styles.caret}>|</tspan>}"
    </text>
  )
}

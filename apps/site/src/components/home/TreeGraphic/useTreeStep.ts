import { useEffect, useRef, useState } from "react"
import { lastTreeStep } from "./treeSteps"

// Slow enough to follow what each action does.
const firstStepDelay = 1500
const stepDelay = 2600
const finalHoldDelay = 5000

/** Advances through the tree steps in a loop, pausing while off-screen. */
export function useTreeStep() {
  const ref = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(lastTreeStep)
      return
    }

    let visible = true
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    if (ref.current) observer.observe(ref.current)

    let current = 0
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      const delay =
        current === 0 ? firstStepDelay : current === lastTreeStep ? finalHoldDelay : stepDelay
      timer = setTimeout(() => {
        if (visible && !document.hidden) {
          current = current === lastTreeStep ? 0 : current + 1
          setStep(current)
        }
        schedule()
      }, delay)
    }
    schedule()

    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [])

  return { ref, step }
}

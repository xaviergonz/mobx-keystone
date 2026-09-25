import { useEffect, useState } from "react"
import { clsx } from "../../../utils/clsx"
import shared from "../shared.module.css"
import { Pulse, pulseDuration } from "./Pulse"
import { SnapshotView } from "./SnapshotView"
import { TodoLabel, typingDuration } from "./TodoLabel"
import styles from "./TreeGraphic.module.css"
import { treeSteps } from "./treeSteps"
import { useTreeStep } from "./useTreeStep"

const slotX = [95, 270, 445]

/** The edges from the store down to the todo in slot `i`, as one path. */
const branchPath = (i: number) => `M270 48 L270 132 C270 156 ${slotX[i]} 150 ${slotX[i]} 176`

/** An outline that grows out of a node and fades, restarted by remounting it. */
function Ripple({
  x,
  y,
  width,
  height,
  delay = 0,
}: {
  x: number
  y: number
  width: number
  height: number
  delay?: number
}) {
  return (
    <rect
      className={styles.ripple}
      style={{ animationDelay: `${delay}ms` }}
      x={x}
      y={y}
      width={width}
      height={height}
      rx="10"
    />
  )
}

/** Animated model tree with its action, patch and snapshot panels. */
export function TreeGraphic() {
  const { ref, step } = useTreeStep()
  const current = treeSteps[step]
  const onStore = current.action?.on === "store"

  // The patch leaves the changed todo once the change is visible: after a new todo has popped in,
  // or after its new text has been typed. It reaches the store (and the patches and snapshot
  // panels) when the pulse ends.
  const patchDelay =
    current.change === "add"
      ? 450
      : current.change === "text" && current.target !== undefined
        ? typingDuration(
            treeSteps[step - 1].todos[current.target].text,
            current.todos[current.target].text
          )
        : 0
  const patchArrival = patchDelay + pulseDuration

  // The last step whose patch has reached the store. Until then the patches and snapshot panels
  // keep showing the previous step.
  const [patchedStep, setPatchedStep] = useState(step)
  useEffect(() => {
    if (
      current.target === undefined ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setPatchedStep(step)
      return
    }
    const timer = setTimeout(() => setPatchedStep(step), patchArrival)
    return () => clearTimeout(timer)
  }, [step, current.target, patchArrival])
  const shownPatchStep = patchedStep === step || current.target === undefined ? step : step - 1

  const logUpTo = (last: number) =>
    treeSteps
      .slice(1, last + 1)
      .map((s, i) => ({ ...s, id: i }))
      .reverse()
      .slice(0, 3)

  return (
    <div ref={ref} className={clsx(shared.glass, styles.tree)}>
      <svg
        viewBox="0 0 540 244"
        role="img"
        aria-label={`A model tree: TodoStore holds a todos array with ${current.todos.length} Todo models`}
      >
        <path
          className={clsx(styles.treeEdge, current.action && styles.treeEdgeActive)}
          d="M270 48 L270 92"
        />
        {current.todos.map((_todo, i) => (
          <path
            key={i}
            className={clsx(
              styles.treeEdge,
              styles.edgeEnter,
              current.target === i && styles.treeEdgeActive
            )}
            d={`M270 132 C270 156 ${slotX[i]} 150 ${slotX[i]} 176`}
            pathLength={1}
          />
        ))}
        <rect
          className={clsx(styles.treeNode, onStore && styles.treeNodeActive)}
          x="180"
          y="8"
          width="180"
          height="40"
          rx="10"
        />
        {onStore && (
          // The action is called on the store.
          <Ripple key={`store-action-${step}`} x={180} y={8} width={180} height={40} />
        )}
        {current.target !== undefined && (
          // The patch reaches the store.
          <Ripple
            key={`store-patch-${step}`}
            x={180}
            y={8}
            width={180}
            height={40}
            delay={patchArrival}
          />
        )}
        <text className={styles.treeText} x="270" y="33" textAnchor="middle">
          TodoStore
        </text>
        <rect className={styles.treeNode} x="210" y="92" width="120" height="40" rx="10" />
        <text className={styles.treeTextMuted} x="270" y="117" textAnchor="middle">
          todos[]
        </text>
        {current.todos.map((todo, i) => {
          const x = slotX[i] - 80
          const active = current.target === i && !onStore
          return (
            <g key={i} className={styles.nodeEnter}>
              <rect
                className={clsx(styles.treeNode, active && styles.treeNodeActive)}
                x={x}
                y="176"
                width="160"
                height="60"
                rx="10"
              />
              {active && <Ripple key={`todo-${step}`} x={x} y={176} width={160} height={60} />}
              <text className={styles.treeText} x={x + 16} y="200">
                Todo
              </text>
              <TodoLabel
                className={active ? styles.treeTextAccent : styles.treeTextFaint}
                x={x + 16}
                text={todo.text}
                // Only the step that edits this todo types its new text in.
                typeFrom={
                  current.change === "text" && active
                    ? treeSteps[step - 1].todos[i].text
                    : undefined
                }
              />
              <text
                // Remount when toggled so the check mark pops in.
                key={String(todo.done)}
                className={clsx(
                  styles.check,
                  todo.done && styles.checkDone,
                  todo.done && current.change === "done" && active && styles.checkPop
                )}
                x={x + 140}
                y="222"
                textAnchor="middle"
              >
                {todo.done ? "✓" : "○"}
              </text>
            </g>
          )
        })}
        {current.target !== undefined && (
          // The patch, travelling up from the changed todo to the store.
          <Pulse key={step} d={branchPath(current.target)} delay={patchDelay} />
        )}
      </svg>

      <div className={styles.treePanels}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={shared.blueText}>ACTIONS</span>
            <span>onActionMiddleware</span>
          </div>
          <ul className={clsx(styles.logList, styles.actionsLog)}>
            {logUpTo(step).map((s) => (
              <li key={s.id}>
                <span className={shared.muted}>{s.action?.on}.</span>
                {s.action?.call}
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={shared.accentText}>PATCHES</span>
            <span>onPatches</span>
          </div>
          <ul className={styles.logList}>
            {logUpTo(shownPatchStep).map((s) => (
              <li key={s.id}>
                <span className={shared.accentText}>{s.patch?.op}</span> {s.patch?.path}
                <span className={styles.patchValue}>→ {s.patch?.value}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={clsx(styles.panel, styles.snapshotPanel)}>
          <div className={styles.panelHead}>
            <span className={shared.blueText}>SNAPSHOT</span>
            <span>getSnapshot(store)</span>
          </div>
          <SnapshotView step={shownPatchStep} />
        </div>
      </div>
    </div>
  )
}

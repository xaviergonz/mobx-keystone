import { clsx } from "../../../utils/clsx"
import shared from "../shared.module.css"
import { SnapshotView } from "./SnapshotView"
import { TodoLabel } from "./TodoLabel"
import styles from "./TreeGraphic.module.css"
import { treeSteps } from "./treeSteps"
import { useTreeStep } from "./useTreeStep"

const slotX = [95, 270, 445]

/** Animated model tree with its action, patch and snapshot panels. */
export function TreeGraphic() {
  const { ref, step } = useTreeStep()
  const current = treeSteps[step]
  const log = treeSteps
    .slice(1, step + 1)
    .map((s, i) => ({ ...s, id: i }))
    .reverse()
  const onStore = current.action?.on === "store"

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
      </svg>

      <div className={styles.treePanels}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={shared.blueText}>ACTIONS</span>
            <span>onActionMiddleware</span>
          </div>
          <ul className={clsx(styles.logList, styles.actionsLog)}>
            {log.slice(0, 3).map((s) => (
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
            {log.slice(0, 3).map((s) => (
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
          <SnapshotView step={step} />
        </div>
      </div>
    </div>
  )
}

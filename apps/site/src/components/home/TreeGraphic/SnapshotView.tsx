import type { ReactNode } from "react"
import { k, str } from "../codeTokens"
import styles from "./TreeGraphic.module.css"
import { treeSteps } from "./treeSteps"

export function SnapshotView({ step }: { step: number }) {
  const { todos, target, change } = treeSteps[step]
  // Keying by step restarts the highlight animation whenever something changes.
  const flash = (node: ReactNode) => (
    <span key={step} className={styles.flash}>
      {node}
    </span>
  )

  return (
    <pre>
      {"{\n"}
      {"  "}todos: [{todos.length === 0 ? "]" : "\n"}
      {todos.map((todo, i) => {
        const text = str(`"${todo.text}"`)
        const done = k(String(todo.done))
        const line = (
          <>
            {"    { "}text: {change === "text" && target === i ? flash(text) : text}, done:{" "}
            {change === "done" && target === i ? flash(done) : done}, $modelType:{" "}
            {str('"todo/Todo"')}
            {" },\n"}
          </>
        )
        return <span key={i}>{change === "add" && target === i ? flash(line) : line}</span>
      })}
      {todos.length > 0 && "  ]"},{"\n"}
      {"  "}$modelType: {str('"todo/Store"')}
      {"\n}"}
    </pre>
  )
}

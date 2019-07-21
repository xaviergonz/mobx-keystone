import {
  ActionCall,
  getSnapshot,
  newModel,
  onActionMiddleware,
  onPatches,
  Patch,
} from "mobx-keystone"
import { observer } from "mobx-react"
import React, { useEffect, useState } from "react"
import { rootStore, Todo, TodoList } from "./store"

// we use mobx-react to connect to the data, as it is usual in mobx
// this library is framework agnostic, so it can work anywhere mobx can work
// (even outside of a UI)

export const App = observer(() => {
  const [actions] = useState<ActionCall[]>([])
  useEffect(() => {
    // we can use action middlewares for several things
    // in this case we will keep a log of the actions done over the todo list
    const disposer = onActionMiddleware(rootStore, (actionCall, _actionContext, next) => {
      actions.push(actionCall)
      return next()
    })
    return disposer
  }, [rootStore])

  const [patchesList] = useState<Patch[][]>([])
  useEffect(() => {
    // also it is possible to get a list of changes in the form of patches,
    // even with inverse patches to undo the changes
    const disposer = onPatches(rootStore, (patches, _inversePatches) => {
      patchesList.push(patches)
    })
    return disposer
  })

  // we can convert any model (or part of it) into a plain JS structure
  // with it we can:
  // - serialize to later deserialize it with `fromSnapshot`
  // - pass it to non mobx-friendly components
  // snapshots respect immutability, so if a subobject is changed
  // its refrence will be kept
  const rootStoreSnapshot = getSnapshot(rootStore)

  return (
    <>
      <TodoListView list={rootStore} />

      <br />

      <PreSection title="Action log">{actions.map(actionCallToText)}</PreSection>

      <PreSection title="Patch log">{patchesList.map(patchesToText)}</PreSection>

      <PreSection title="Generated immutable snapshot">
        {JSON.stringify(rootStoreSnapshot, null, 2)}
      </PreSection>
    </>
  )
})

const TodoListView = observer(({ list }: { list: TodoList }) => {
  const todoRef = React.useRef<HTMLInputElement>(null)

  const renderTodo = (todo: Todo) => (
    <TodoView
      key={todo.modelId}
      done={todo.data.done}
      text={todo.data.text}
      onClick={() => todo.setDone(!todo.data.done)}
      onRemove={() => list.remove(todo)}
    />
  )

  return (
    <div>
      {list.pending.length > 0 && (
        <>
          <h5>TODO</h5>
          {list.pending.map(t => renderTodo(t))}
        </>
      )}

      {list.done.length > 0 && (
        <>
          <h5>DONE</h5>
          {list.done.map(t => renderTodo(t))}
        </>
      )}
      <br />
      <input ref={todoRef} placeholder="I will..." />
      <button
        onClick={() => {
          list.add(newModel(Todo, { text: todoRef.current!.value }))
        }}
      >
        Add todo
      </button>
    </div>
  )
})

function TodoView({
  done,
  text,
  onClick,
  onRemove,
}: {
  done: boolean
  text: string
  onClick(): void
  onRemove(): void
}) {
  return (
    <div style={{ cursor: "pointer" }}>
      <span
        onClick={onClick}
        style={{
          textDecoration: done ? "line-through" : "inherit",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: "1.5rem",
            textAlign: "center",
            marginRight: 8,
          }}
        >
          {done ? "✔️" : "👀"}
        </span>
        {text}
        {}
      </span>
      <span onClick={onRemove} style={{ marginLeft: 16 }}>
        ❌
      </span>
    </div>
  )
}

function actionCallToText(actionCall: ActionCall) {
  const args = actionCall.args.map(arg => JSON.stringify(arg)).join(", ")
  const path = actionCall.targetPath.join("/")
  return `[${path}] ${actionCall.actionName}(${args})\n`
}

function patchToText(patch: Patch) {
  const path = patch.path.join("/")
  let str = `[${path}] ${patch.op}`
  if (patch.op !== "remove") {
    str += " -> " + JSON.stringify(patch.value)
  }
  return str + "\n"
}

function patchesToText(patches: Patch[]) {
  return patches.map(patchToText)
}

function PreSection(props: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h5>{props.title}</h5>
      <pre style={{ fontSize: 10, whiteSpace: "pre-wrap" }}>{props.children}</pre>
    </>
  )
}

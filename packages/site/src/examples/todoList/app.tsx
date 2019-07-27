import {
  ActionCall,
  getSnapshot,
  newModel,
  onActionMiddleware,
  onPatches,
  Patch,
} from "mobx-keystone"
import { observer, useLocalStore } from "mobx-react"
import React, { useEffect, useState } from "react"
import { createRootStore, Todo, TodoList } from "./store"

// we use mobx-react to connect to the data, as it is usual in mobx
// this library is framework agnostic, so it can work anywhere mobx can work
// (even outside of a UI)

export const App = observer(() => {
  const [rootStore] = useState(() => createRootStore())

  return <MainView rootStore={rootStore} />
})

// this is just for the client/server demo
export const cancelledActionSymbol = Symbol("cancelledAction")
interface ExtendedActionCall extends ActionCall {
  cancelled: boolean
}

export const MainView = observer((props: { rootStore: TodoList }) => {
  const data = useLocalStore(() => ({
    actions: [] as ExtendedActionCall[],
    patchesList: [] as Patch[][],

    addAction(actionCall: ExtendedActionCall) {
      this.actions.push(actionCall)
    },
    addPatches(patches: Patch[]) {
      this.patchesList.push(patches)
    },
  }))

  useEffect(() => {
    // we can use action middlewares for several things
    // in this case we will keep a log of the actions done over the todo list
    const disposer = onActionMiddleware(props.rootStore, {
      onFinish(actionCall, ctx) {
        const extendedActionCall: ExtendedActionCall = {
          ...actionCall,
          cancelled: !!ctx.data[cancelledActionSymbol],
        }
        data.addAction(extendedActionCall)
      },
    })
    return disposer
  }, [props.rootStore])

  useEffect(() => {
    // also it is possible to get a list of changes in the form of patches,
    // even with inverse patches to undo the changes
    const disposer = onPatches(props.rootStore, (patches, _inversePatches) => {
      data.addPatches(patches)
    })
    return disposer
  })

  // we can convert any model (or part of it) into a plain JS structure
  // with it we can:
  // - serialize to later deserialize it with `fromSnapshot`
  // - pass it to non mobx-friendly components
  // snapshots respect immutability, so if a subobject is changed
  // its refrence will be kept
  const rootStoreSnapshot = getSnapshot(props.rootStore)

  return (
    <>
      <TodoListView list={props.rootStore} />

      <br />

      <PreSection title="Action log">
        {data.actions.map((action, index) => (
          <ActionCallToText actionCall={action} key={index} />
        ))}
      </PreSection>

      <PreSection title="Patch log">{data.patchesList.map(patchesToText)}</PreSection>

      <PreSection title="Generated immutable snapshot">
        {JSON.stringify(rootStoreSnapshot, null, 2)}
      </PreSection>
    </>
  )
})

const TodoListView = observer(({ list }: { list: TodoList }) => {
  const [newTodo, setNewTodo] = React.useState("")

  const renderTodo = (todo: Todo) => (
    <TodoView
      key={todo.modelId}
      done={todo.data.done}
      text={todo.data.text}
      onClick={() => todo.setDone(!todo.data.done)}
      onRemove={() => list.remove(todo.modelId)}
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
      <input
        value={newTodo}
        onChange={ev => {
          setNewTodo(ev.target.value || "")
        }}
        placeholder="I will..."
      />
      <button
        onClick={() => {
          list.add(newModel(Todo, { text: newTodo }))
          setNewTodo("")
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

function ActionCallToText(props: { actionCall: ExtendedActionCall }) {
  const actionCall = props.actionCall

  const args = actionCall.args.map(arg => JSON.stringify(arg)).join(", ")
  const path = actionCall.targetPath.join("/")
  let text = `[${path}] ${actionCall.actionName}(${args})`
  if (actionCall.cancelled) {
    return (
      <>
        <span style={{ textDecoration: "line-through" }}>{text}</span>{" "}
        <span>(cancelled and sent to server)</span>
        <br />
      </>
    )
  }
  return (
    <>
      <span>{text}</span>
      <br />
    </>
  )
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

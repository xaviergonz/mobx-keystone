import { observer } from "mobx-react"
import React, { useState } from "react"
import { LogsView } from "./logs"
import { createRootStore, Todo, TodoList } from "./store"

// we use mobx-react to connect to the data, as it is usual in mobx
// this library is framework agnostic, so it can work anywhere mobx can work
// (even outside of a UI)

export const App = observer(() => {
  const [rootStore] = useState(() => createRootStore())

  return (
    <>
      <TodoListView list={rootStore} />
      <br />
      <LogsView rootStore={rootStore} />
    </>
  )
})

export const TodoListView = observer(({ list }: { list: TodoList }) => {
  const [newTodo, setNewTodo] = React.useState("")

  const renderTodo = (todo: Todo) => (
    <TodoView
      key={todo.id}
      done={todo.done}
      text={todo.text}
      onClick={() => todo.setDone(!todo.done)}
      onRemove={() => list.remove(todo)}
    />
  )

  return (
    <div>
      {list.pending.length > 0 && (
        <>
          <h5>TODO</h5>
          {list.pending.map((t) => renderTodo(t))}
        </>
      )}

      {list.done.length > 0 && (
        <>
          <h5>DONE</h5>
          {list.done.map((t) => renderTodo(t))}
        </>
      )}
      <br />
      <input
        value={newTodo}
        onChange={(ev) => {
          setNewTodo(ev.target.value || "")
        }}
        placeholder="I will..."
      />
      <button
        onClick={() => {
          list.add(new Todo({ text: newTodo }))
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

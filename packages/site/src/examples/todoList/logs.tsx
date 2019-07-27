import { ActionCall, getSnapshot, onActionMiddleware, onPatches, Patch } from "mobx-keystone"
import { observer, useLocalStore } from "mobx-react"
import React, { useEffect } from "react"
import { TodoList } from "./store"

// this is just for the client/server demo
export const cancelledActionSymbol = Symbol("cancelledAction")
interface ExtendedActionCall extends ActionCall {
  cancelled: boolean
}

export const LogsView = observer((props: { rootStore: TodoList }) => {
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

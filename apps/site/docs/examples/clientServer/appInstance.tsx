import {
  ActionTrackingResult,
  applyPatches,
  defaultSerializer,
  fromSnapshot,
  onActionMiddleware,
  Patch,
} from "mobx-keystone"
import { observer } from "mobx-react-lite"
import { useEffect, useState } from "react"
import { TodoListView } from "../todoList/app"
import { cancelledActionSymbol, LogsView, serverActionNameSymbol } from "../todoList/logs"
import { TodoList } from "../todoList/store"
import { server } from "./server"

function initAppInstance() {
  // we get the snapshot from the server, which is a serializable object
  const rootStoreSnapshot = server.getInitialState()

  // and hydrate it into a proper object
  const rootStore = fromSnapshot<TodoList>(rootStoreSnapshot)

  let serverAction = false
  let serverActionName: string | undefined
  const applyServerPatches = (patches: Patch[], actionName: string | undefined) => {
    const wasServerAction = serverAction
    const previousServerActionName = serverActionName
    serverAction = true
    serverActionName = actionName
    try {
      // the server sends the patches its actions produced, so applying them leaves the local root
      // store exactly as the server's, including any model ids generated there
      applyPatches(rootStore, patches)
    } finally {
      serverAction = wasServerAction
      serverActionName = previousServerActionName
    }
  }

  // listen to patch messages to be replicated into the local root store
  server.onMessage(({ patches, actionName }) => {
    applyServerPatches(patches, actionName)
  })

  // also listen to local actions, cancel them and send them to the server
  const sendLocalActionsToServer = () =>
    onActionMiddleware(rootStore, {
      onStart(actionCall, ctx) {
        if (serverAction) {
          // just run the server action unmodified
          ctx.data[serverActionNameSymbol] = serverActionName // just for logging purposes
          return undefined
        } else {
          // if the action does not come from the server cancel it silently
          // and send it to the server, which will run it and send back the patches it produced
          // (the call is encoded before the action runs, so any references in its arguments
          // point at the tree as the server still has it)
          void server
            .sendCall(defaultSerializer.encodeCall(rootStore, actionCall))
            .then((reply) => {
              if ("error" in reply) {
                console.warn("the server could not run the call:", reply.error.message)
              }
            })

          ctx.data[cancelledActionSymbol] = true // just for logging purposes

          // "cancel" the action by returning undefined
          return {
            result: ActionTrackingResult.Return,
            value: undefined,
          }
        }
      },
    })

  return { rootStore, sendLocalActionsToServer }
}

export const AppInstance = observer(() => {
  const [{ rootStore, sendLocalActionsToServer }] = useState(() => initAppInstance())

  // register this middleware in an effect, after `LogsView` registers its own (children's effects
  // run first), so the log wraps it and still shows the actions this one cancels
  useEffect(() => sendLocalActionsToServer(), [sendLocalActionsToServer])

  return (
    <>
      <TodoListView list={rootStore} />
      <br />
      <LogsView rootStore={rootStore} />
    </>
  )
})

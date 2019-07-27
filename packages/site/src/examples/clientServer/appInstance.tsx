import {
  ActionCall,
  ActionTrackingResult,
  applyAction,
  deserializeActionCall,
  fromSnapshot,
  onActionMiddleware,
  serializeActionCall,
} from "mobx-keystone"
import { observer } from "mobx-react"
import React, { useState } from "react"
import { TodoListView } from "../todoList/app"
import { cancelledActionSymbol, LogsView } from "../todoList/logs"
import { TodoList } from "../todoList/store"
import { server } from "./server"

function initAppInstance() {
  // we get the snapshot from the server, which is a serializable object
  const rootStoreSnapshot = server.getInitialState()

  // and hydrate it into a proper object
  const rootStore = fromSnapshot<TodoList>(rootStoreSnapshot)

  let serverAction = false
  const runServerActionLocally = (actionCall: ActionCall) => {
    const deserializedActionCall = deserializeActionCall(actionCall)

    let wasServerAction = serverAction
    serverAction = true
    try {
      applyAction(rootStore, deserializedActionCall)
    } finally {
      serverAction = wasServerAction
    }
  }

  // listen to action messages to be replicated into the local root store
  server.onMessage(actionCall => {
    runServerActionLocally(actionCall)
  })

  // also listen to local actions, cancel them and send them to the server
  onActionMiddleware(rootStore, {
    onStart(actionCall, ctx) {
      if (!serverAction) {
        // if the action does not come from the server cancel it silently
        // and send it to the server
        // it will then be replicated by the server and properly executed
        server.sendMessage(serializeActionCall(actionCall))

        ctx.data[cancelledActionSymbol] = true // just for logging purposes

        // "cancel" the action by returning undefined
        return {
          result: ActionTrackingResult.Return,
          value: undefined,
        }
      } else {
        // just run the server action unmodified
        return undefined
      }
    },
  })

  return rootStore
}

export const AppInstance = observer(() => {
  const [rootStore] = useState(() => initAppInstance())

  return (
    <>
      <TodoListView list={rootStore} />
      <br />
      <LogsView rootStore={rootStore} />
    </>
  )
})

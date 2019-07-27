import {
  ActionCall,
  ActionTrackingResult,
  applyAction,
  deserializeActionCall,
  fromSnapshot,
  getSnapshot,
  onActionMiddleware,
  serializeActionCall,
} from "mobx-keystone"
import { observer } from "mobx-react"
import React, { useState } from "react"
import { cancelledActionSymbol, MainView } from "../todoList/app"
import { createRootStore, TodoList } from "../todoList/store"

// in this example we will be synchronizing two separate root stores
// via action capturing and applying, which will simulate how to instances of an app
// talk with a server to keep in sync

// we will use pessimistic updates, this is, we will cancel the local action
// and then actually run the action when the server tells the client to do so

// "server" part
type MsgListener = (actionCall: ActionCall) => void

class Server {
  private serverRootStore = createRootStore()
  private msgListeners: MsgListener[] = []

  getInitialState() {
    return getSnapshot(this.serverRootStore)
  }

  onMessage(listener: (actionCall: ActionCall) => void) {
    this.msgListeners.push(listener)
  }

  sendMessage(actionCall: ActionCall) {
    // the timeouts are just to simulate network delays
    setTimeout(() => {
      const deserializedActionCall = deserializeActionCall(actionCall)
      // apply the action over the server root store
      applyAction(this.serverRootStore, deserializedActionCall)

      setTimeout(() => {
        // and distribute message
        this.msgListeners.forEach(listener => listener(actionCall))
      }, 500)
    }, 500)
  }
}

const server = new Server()

// app instance part

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

        // cancel the action by returning undefined
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

  return <MainView rootStore={rootStore} />
})

// we will expose both app instances in the ui

export const App = observer(() => {
  return (
    <div style={{ display: "flex", flexDirection: "row" }}>
      <div style={{ flex: "1 1 0" }}>
        <h2>App Instance #1</h2>
        <AppInstance />
      </div>

      <div style={{ flex: "1 1 0" }}>
        <h2>App Instance #2</h2>
        <AppInstance />
      </div>
    </div>
  )
})

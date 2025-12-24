import { LoroDoc } from "loro-crdt"
import { observable } from "mobx"
import { getSnapshot, registerRootStore } from "mobx-keystone"
import { applyJsonObjectToLoroMap, bindLoroToMobxKeystone } from "mobx-keystone-loro"
import { observer } from "mobx-react"
import { useEffect, useState } from "react"
import { TodoListView } from "../todoList/app"
import { createDefaultTodoList, TodoList } from "../todoList/store"

function getInitialState() {
  const doc = new LoroDoc()
  const loroRootStore = doc.getMap("rootStore")

  const todoListSnapshot = getSnapshot(createDefaultTodoList())
  applyJsonObjectToLoroMap(loroRootStore, todoListSnapshot)
  doc.commit()

  const update = doc.export({ mode: "snapshot" })

  return update
}

// we get the initial state from the server, which is a Loro update
const rootStoreLoroUpdate = getInitialState()

function initAppInstance() {
  // hydrate into a Loro document
  const doc = new LoroDoc()
  doc.import(rootStoreLoroUpdate)

  // and create a binding into a mobx-keystone object rootStore
  const { boundObject: rootStore } = bindLoroToMobxKeystone({
    mobxKeystoneType: TodoList,
    loroDoc: doc,
    loroObject: doc.getMap("rootStore"),
  })

  // although not strictly required, it is always a good idea to register your root stores
  // as such, since this allows the model hook `onAttachedToRootStore` to work and other goodies
  registerRootStore(rootStore)

  // expose the connection status as an observable
  const status = observable({
    connected: true,
    setConnected(value: boolean) {
      this.connected = value
    },
  })

  // Simple sync via BroadcastChannel
  const channel = new BroadcastChannel("mobx-keystone-loro-binding-demo")

  let lastSentVersion = doc.version()

  const unsubLocalUpdates = doc.subscribeLocalUpdates((update) => {
    if (status.connected) {
      channel.postMessage({ update, fromPeer: doc.peerIdStr })
      lastSentVersion = doc.version()
    }
  })

  channel.onmessage = (event) => {
    if (!status.connected) return

    const { update, fromPeer, isSyncRequest } = event.data
    if (fromPeer === doc.peerIdStr) return // ignore own messages if any

    try {
      doc.import(update)
      lastSentVersion = doc.version()

      if (isSyncRequest) {
        // if it is a sync request, send back only the changes they are missing
        channel.postMessage({
          update: doc.export({ mode: "update", from: event.data.version }),
          fromPeer: doc.peerIdStr,
          isSyncRequest: false,
        })
      }
    } catch (e) {
      console.error("Import failed", e)
    }
  }

  const toggleConnection = () => {
    const newConnected = !status.connected
    status.setConnected(newConnected)
    if (newConnected) {
      // when reconnecting, send our current state to others and ask for theirs
      channel.postMessage({
        update: doc.export({ mode: "update", from: lastSentVersion }),
        version: doc.version(),
        fromPeer: doc.peerIdStr,
        isSyncRequest: true,
      })
      // checkpoint the version we just sent
      lastSentVersion = doc.version()
    }
  }

  return { rootStore, status, toggleConnection, dispose: () => unsubLocalUpdates() }
}

export const AppInstance = observer(() => {
  const [{ rootStore, status, toggleConnection, dispose }] = useState(() => initAppInstance())

  useEffect(() => {
    return () => {
      dispose()
    }
  }, [dispose])

  return (
    <>
      <TodoListView list={rootStore} />

      <br />

      <div>{status.connected ? "Online (sync enabled)" : "Offline (sync disabled)"}</div>
      <button
        type="button"
        onClick={() => {
          toggleConnection()
        }}
        style={{ width: "fit-content" }}
      >
        {status.connected ? "Disconnect" : "Connect"}
      </button>
    </>
  )
})

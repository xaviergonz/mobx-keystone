import { observable } from "mobx"
import { getSnapshot, registerRootStore } from "mobx-keystone"
import { applyJsonObjectToYMap, bindYjsToMobxKeystone } from "mobx-keystone-yjs"
import { observer } from "mobx-react"
import { useState } from "react"
import { WebrtcProvider } from "y-webrtc"
import * as Y from "yjs"
import { TodoListView } from "../todoList/app"
import { TodoList, createDefaultTodoList } from "../todoList/store"

function getInitialState() {
  // here we just generate what a client would have saved from a previous session,
  // but it could be stored in each client local storage or something like that

  const yjsDoc = new Y.Doc()
  const yjsRootStore = yjsDoc.getMap("rootStore")

  const todoListSnapshot = getSnapshot(createDefaultTodoList())
  applyJsonObjectToYMap(yjsRootStore, todoListSnapshot)

  const updateV2 = Y.encodeStateAsUpdateV2(yjsDoc)

  yjsDoc.destroy()

  return updateV2
}

function initAppInstance() {
  // we get the initial state from the server, which is a Yjs update
  const rootStoreYjsUpdate = getInitialState()

  // hydrate into a Yjs document
  const yjsDoc = new Y.Doc()
  Y.applyUpdateV2(yjsDoc, rootStoreYjsUpdate)

  // and create a binding into a mobx-keystone object rootStore
  const { boundObject: rootStore } = bindYjsToMobxKeystone({
    mobxKeystoneType: TodoList,
    yjsDoc,
    yjsObject: yjsDoc.getMap("rootStore"),
  })

  // although not strictly required, it is always a good idea to register your root stores
  // as such, since this allows the model hook `onAttachedToRootStore` to work and other goodies
  registerRootStore(rootStore)

  // connect to other peers via webrtc
  const webrtcProvider = new WebrtcProvider("mobx-keystone-yjs-binding-demo", yjsDoc)

  // expose the webrtc connection status as an observable
  const status = observable({
    connected: webrtcProvider.connected,
    setConnected(value: boolean) {
      this.connected = value
    },
  })

  webrtcProvider.on("status", (event) => {
    status.setConnected(event.connected)
  })

  const toggleWebrtcProviderConnection = () => {
    if (webrtcProvider.connected) {
      webrtcProvider.disconnect()
    } else {
      webrtcProvider.connect()
    }
  }

  return { rootStore, status, toggleWebrtcProviderConnection }
}

export const AppInstance = observer(() => {
  const [{ rootStore, status, toggleWebrtcProviderConnection }] = useState(() => initAppInstance())

  return (
    <>
      <TodoListView list={rootStore} />

      <br />

      <div>{status.connected ? "Online (sync enabled)" : "Offline (sync disabled)"}</div>
      <button
        type="button"
        onClick={() => {
          toggleWebrtcProviderConnection()
        }}
        style={{ width: "fit-content" }}
      >
        {status.connected ? "Disconnect" : "Connect"}
      </button>
    </>
  )
})

import { action, observable } from "mobx"
import { registerRootStore } from "mobx-keystone"
import { bindYjsToMobxKeystone } from "mobx-keystone-yjs"
import { observer } from "mobx-react"
import { nanoid } from "nanoid"
import { useState } from "react"
import * as Y from "yjs"
import { TodoListView } from "../todoList/app"
import { TodoList } from "../todoList/store"
import { server } from "./server"

function initAppInstance() {
  // we get the initial state from the server, which is a Yjs update
  const rootStoreYjsUpdate = server.getInitialState()

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

  const clientId = nanoid()

  const connected = observable.box(true)
  const isConnected = () => connected.get()

  server.onMessage({
    clientId: clientId,
    listener: (msg, fromClientId) => {
      if (!isConnected()) {
        // simulate a disconnection
        return
      }

      if (msg.type === "yjsUpdate") {
        // whenever we get an update from another client apply it to our Y.js doc
        // the binding will make sure it ends up in the root store
        Y.applyUpdateV2(yjsDoc, msg.update, fromClientId)
      } else if (msg.type === "requestYjsUpdateSinceVector") {
        // another client reconnected and is asking for the changes from his version
        // send our changes since that version, but only if there are changes
        const currentVector = Y.encodeStateVector(yjsDoc)
        if (!areUint8ArraysEqual(currentVector, msg.vector)) {
          // we have changes, send them
          const update = Y.encodeStateAsUpdateV2(yjsDoc, msg.vector)
          server.sendMessage(clientId, {
            type: "yjsUpdate",
            update,
          })

          // and also request updates since our version
          server.sendMessage(clientId, {
            type: "requestYjsUpdateSinceVector",
            vector: Y.encodeStateVector(yjsDoc),
          })
        }
      }
    },
  })

  // whenever our Y.js doc changes send the update to the other clients
  yjsDoc.on("updateV2", (updateV2: Uint8Array) => {
    if (!isConnected()) {
      // simulate a disconnection
      return
    }

    server.sendMessage(clientId, {
      type: "yjsUpdate",
      update: updateV2,
    })
  })

  const toggleConnected = action(() => {
    connected.set(!connected.get())

    if (isConnected()) {
      // request updates since our version
      server.sendMessage(clientId, {
        type: "requestYjsUpdateSinceVector",
        vector: Y.encodeStateVector(yjsDoc),
      })
    }
  })

  return { rootStore, isConnected, toggleConnected }
}

export const AppInstance = observer(() => {
  const [{ rootStore, isConnected, toggleConnected }] = useState(() => initAppInstance())

  return (
    <>
      <TodoListView list={rootStore} />
      <br />
      <div>{isConnected() ? "Connected" : "Disconnected"}</div>
      <button onClick={() => toggleConnected()}>{isConnected() ? "Disconnect" : "Connect"}</button>
    </>
  )
})

function areUint8ArraysEqual(arr1: Uint8Array, arr2: Uint8Array): boolean {
  if (arr1.length !== arr2.length) {
    return false
  }
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false
    }
  }
  return true
}

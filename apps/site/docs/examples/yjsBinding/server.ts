import { applySnapshot, getSnapshot } from "mobx-keystone"
import { bindYjsToMobxKeystone } from "mobx-keystone-yjs"
import * as Y from "yjs"
import { createDefaultTodoList, TodoList } from "../todoList/store"

type Message =
  | {
      type: "yjsUpdate"
      update: Uint8Array
    }
  | {
      type: "requestYjsUpdateSinceVector"
      vector: Uint8Array
    }

type MsgListener = {
  clientId: string
  listener: (msg: Message, fromClientId: string) => void
}

class Server {
  private savedYjsUpdate: Uint8Array
  private msgListeners: MsgListener[] = []

  constructor() {
    // here we just generate what a client would have saved from a previous session,
    // but it could be stored in each client local storage or something like that
    const yjsDoc = new Y.Doc()
    const yjsRootStore = yjsDoc.getMap("rootStore")

    const { boundObject, dispose: disposeBinding } = bindYjsToMobxKeystone({
      mobxKeystoneType: TodoList,
      yjsDoc,
      yjsObject: yjsRootStore,
    })

    // initialize yjs with default todo list
    applySnapshot(boundObject, getSnapshot(createDefaultTodoList()))

    this.savedYjsUpdate = Y.encodeStateAsUpdateV2(yjsDoc)

    disposeBinding()
    yjsDoc.destroy()
  }

  getInitialState() {
    return this.savedYjsUpdate
  }

  onMessage(listener: MsgListener) {
    this.msgListeners.push(listener)
  }

  sendMessage(fromClientId: string, msg: Message) {
    // the timeouts are just to simulate network delays
    setTimeout(() => {
      // broadcast to all clients other than the origin
      this.msgListeners.forEach((client) => {
        if (client.clientId !== fromClientId) {
          client.listener(msg, fromClientId)
        }
      })
    }, 500)
  }
}

export const server = new Server()

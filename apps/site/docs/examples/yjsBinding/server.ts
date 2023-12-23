import { getSnapshot } from "mobx-keystone"
import { applyJsonObjectToYMap } from "mobx-keystone-yjs"
import * as Y from "yjs"
import { createDefaultTodoList } from "../todoList/store"

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

    const todoListSnapshot = getSnapshot(createDefaultTodoList())
    applyJsonObjectToYMap(yjsRootStore, todoListSnapshot)

    this.savedYjsUpdate = Y.encodeStateAsUpdateV2(yjsDoc)

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

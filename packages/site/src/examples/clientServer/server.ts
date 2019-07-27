import { ActionCall, applyAction, deserializeActionCall, getSnapshot } from "mobx-keystone"
import { createRootStore } from "../todoList/store"

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

export const server = new Server()

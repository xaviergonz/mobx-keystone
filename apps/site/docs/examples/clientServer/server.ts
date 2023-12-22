import {
  applySerializedActionAndTrackNewModelIds,
  getSnapshot,
  SerializedActionCall,
  SerializedActionCallWithModelIdOverrides,
} from "mobx-keystone"
import { createRootStore } from "../todoList/store"

type MsgListener = (actionCall: SerializedActionCallWithModelIdOverrides) => void

class Server {
  private serverRootStore = createRootStore()
  private msgListeners: MsgListener[] = []

  getInitialState() {
    return getSnapshot(this.serverRootStore)
  }

  onMessage(listener: MsgListener) {
    this.msgListeners.push(listener)
  }

  sendMessage(actionCall: SerializedActionCall) {
    // the timeouts are just to simulate network delays
    setTimeout(() => {
      // apply the action over the server root store
      // sometimes applying actions might fail (for example on invalid operations
      // such as when one client asks to delete a model from an array and other asks to mutate it)
      // so we try / catch it
      let serializedActionCallToReplicate: SerializedActionCallWithModelIdOverrides | undefined
      try {
        // we use this to apply the action on the server side and keep track of new model IDs being
        // generated, so the clients will have the chance to keep those in sync
        const applyActionResult = applySerializedActionAndTrackNewModelIds(
          this.serverRootStore,
          actionCall
        )
        serializedActionCallToReplicate = applyActionResult.serializedActionCall
      } catch (err) {
        console.error("error applying action to server:", err)
      }

      if (serializedActionCallToReplicate) {
        setTimeout(() => {
          // and distribute message, which includes new model IDs to keep them in sync
          this.msgListeners.forEach((listener) => listener(serializedActionCallToReplicate!))
        }, 500)
      }
    }, 500)
  }
}

export const server = new Server()

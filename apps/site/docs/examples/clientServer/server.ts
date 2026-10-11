import {
  applyCallAsync,
  CallError,
  CallErrorJson,
  defaultSerializer,
  EncodedCall,
  getCurrentActionContext,
  getSnapshot,
  JsonValue,
  onPatches,
  Patch,
} from "mobx-keystone"
import { createRootStore } from "../todoList/store"

export interface ServerMessage {
  patches: Patch[]
  // the action that made the change, for display only
  actionName: string | undefined
}

export type CallReply = { ok: JsonValue } | { error: CallErrorJson | { message: string } }

type MsgListener = (msg: ServerMessage) => void

// the timeouts are just to simulate network delays
const networkDelay = () => new Promise((resolve) => setTimeout(resolve, 250))

// JSON round trip, as if it went through the network
const overTheWire = <T>(value: T): T => JSON.parse(JSON.stringify(value))

class Server {
  private serverRootStore = createRootStore()
  private msgListeners: MsgListener[] = []

  constructor() {
    // broadcast every change, in order, tagged with the top-level action that made it
    // (for a flow step, the flow)
    onPatches(this.serverRootStore, (patches) => {
      const msg = overTheWire<ServerMessage>({
        patches,
        actionName: getCurrentActionContext()?.rootContext.actionName,
      })
      void networkDelay().then(() => {
        this.msgListeners.forEach((listener) => {
          listener(msg)
        })
      })
    })
  }

  getInitialState() {
    return getSnapshot(this.serverRootStore)
  }

  onMessage(listener: MsgListener) {
    this.msgListeners.push(listener)
  }

  async sendCall(encodedCall: EncodedCall): Promise<CallReply> {
    const json = overTheWire(encodedCall)
    await networkDelay()

    const root = this.serverRootStore
    try {
      // resolve the target and the action, then run it (flows included)
      // the default `canCall` only allows model actions, which is all clients need here
      const call = defaultSerializer.decodeCall(root, json)
      const result = await applyCallAsync(root, call)
      return overTheWire({ ok: defaultSerializer.encodeValue(root, result) })
    } catch (err) {
      // calls can fail, e.g. when one client deletes a todo another one is changing.
      // a `CallError` describes what was wrong with the call and is safe to send back;
      // any other error comes from the app, so log it and send a generic message
      if (err instanceof CallError) {
        return overTheWire({ error: err.toJSON() })
      }
      console.error("error applying call on the server:", err)
      return { error: { message: "the call failed" } }
    }
  }
}

export const server = new Server()

import { action, createAtom, type IAtom, reaction } from "mobx"
import {
  frozen,
  getParentToChildPath,
  Model,
  mobxComputed,
  model,
  tProp,
  types,
} from "mobx-keystone"
import * as Y from "yjs"
import { failure } from "../utils/error"
import { isYjsValueDeleted } from "../utils/isYjsValueDeleted"
import { resolveYjsPath } from "./resolveYjsPath"
import { yjsBindingContext } from "./yjsBindingContext"

// Delta[][], since each single change is a Delta[]
// we use frozen so that we can reuse each delta change
const deltaListType = types.array(types.frozen(types.unchecked<unknown[]>()))

export const yjsTextModelId = "mobx-keystone-yjs/YjsTextModel"

/**
 * A mobx-keystone model that represents a Yjs.Text object.
 */
@model(yjsTextModelId)
export class YjsTextModel extends Model({
  deltaList: tProp(deltaListType, () => []),
}) {
  /**
   * Helper function to create a YjsTextModel instance with a simple text.
   */
  static withText(text: string): YjsTextModel {
    return new DecoratedYjsTextModel({
      deltaList: [
        frozen([
          {
            insert: text,
          },
        ]),
      ],
    })
  }

  /**
   * The Y.js path from the bound object to the YjsTextModel instance.
   */
  @mobxComputed
  private get _yjsObjectPath() {
    const ctx = yjsBindingContext.get(this)
    if (ctx?.boundObject == null) {
      throw failure(
        "the YjsTextModel instance must be part of a bound object before it can be accessed"
      )
    }

    const path = getParentToChildPath(ctx.boundObject, this)
    if (!path) {
      throw failure("a path from the bound object to the YjsTextModel instance is not available")
    }

    return path
  }

  /**
   * The Yjs.Text object present at this mobx-keystone node's path.
   */
  @mobxComputed
  private get _yjsObjectAtPath(): unknown {
    const path = this._yjsObjectPath

    const ctx = yjsBindingContext.get(this)!

    return resolveYjsPath(ctx.yjsObject, path)
  }

  /**
   * The Yjs.Text object represented by this mobx-keystone node.
   */
  @mobxComputed
  get yjsText(): Y.Text {
    const yjsObject = this._yjsObjectAtPath

    if (!(yjsObject instanceof Y.Text)) {
      throw failure(`Y.Text was expected at path ${JSON.stringify(this._yjsObjectPath)}`)
    }

    return yjsObject
  }

  /**
   * Atom that gets changed when the associated Y.js text changes.
   */
  yjsTextChangedAtom = createAtom("yjsTextChangedAtom")

  /**
   * The text value of the Yjs.Text object.
   * Shortcut for `yjsText.toString()`, but computed.
   */
  @mobxComputed
  get text(): string {
    this.yjsTextChangedAtom.reportObserved()

    const ctx = yjsBindingContext.get(this)
    if (ctx?.boundObject != null) {
      try {
        const yjsText = this.yjsText
        // Deleted text loses its content; live empty text needs no fallback.
        if (!isYjsValueDeleted(yjsText)) {
          return yjsText.toString()
        }
      } catch {
        // fall back
      }
    }

    // fall back to deltaList
    return this.deltaListToText()
  }

  private deltaListToText(): string {
    const doc = new Y.Doc()
    try {
      const text = doc.getText()
      doc.transact(() => {
        for (const delta of this.deltaList) {
          text.applyDelta(delta.data)
        }
      })
      return text.toString()
    } finally {
      doc.destroy()
    }
  }

  protected onInit() {
    return hookYjsTextChangedAtom(() => this.yjsText, this.yjsTextChangedAtom)
  }
}

// we use this trick just to avoid a babel bug that causes classes used inside classes not to be overriden
// by the decorator
const DecoratedYjsTextModel = YjsTextModel

function hookYjsTextChangedAtom(getYjsText: () => Y.Text, textChangedAtom: IAtom) {
  let disposeObserveYjsText: (() => void) | undefined

  let disposePendingNotification: (() => void) | undefined
  const observeFn = (_event: Y.YTextEvent, transaction: Y.Transaction) => {
    // Shallow text observers run before the binding's deep observer. Notify
    // reactions only after incoming deltas have reached the model history and
    // Yjs has finished cleanup, so reaction edits start a fresh transaction.
    disposePendingNotification?.()
    disposePendingNotification = scheduleTextNotification(transaction.doc, () => {
      disposePendingNotification = undefined
      textChangedAtom.reportChanged()
    })
  }

  const disposeReactionToYTextChange = reaction(
    () => {
      try {
        const yjsText = getYjsText()
        return isYjsValueDeleted(yjsText) ? undefined : yjsText
      } catch {
        return undefined
      }
    },
    (yjsText) => {
      disposePendingNotification?.()
      disposeObserveYjsText?.()
      disposeObserveYjsText = undefined

      if (yjsText) {
        yjsText.observe(observeFn)

        disposeObserveYjsText = () => {
          yjsText.unobserve(observeFn)
        }
      }

      textChangedAtom.reportChanged()
    },
    {
      fireImmediately: true,
    }
  )

  return () => {
    disposeReactionToYTextChange()
    disposePendingNotification?.()
    disposeObserveYjsText?.()
    disposeObserveYjsText = undefined
  }
}

interface PendingTextNotifications {
  callbacks: Set<() => void>
  flush: () => void
}

const pendingTextNotifications = new WeakMap<Y.Doc, PendingTextNotifications>()

function scheduleTextNotification(doc: Y.Doc, callback: () => void): () => void {
  let pending = pendingTextNotifications.get(doc)
  if (!pending) {
    const callbacks = new Set<() => void>()
    const flush = action("notifyYjsTextChanges", () => {
      doc.off("afterAllTransactions", flush)
      pendingTextNotifications.delete(doc)
      // All changed texts become visible to reactions in one MobX batch.
      for (const notify of callbacks) notify()
      callbacks.clear()
    })
    pending = { callbacks, flush }
    pendingTextNotifications.set(doc, pending)
    doc.on("afterAllTransactions", flush)
  }
  pending.callbacks.add(callback)
  return () => {
    pending.callbacks.delete(callback)
    if (pending.callbacks.size === 0 && pendingTextNotifications.get(doc) === pending) {
      doc.off("afterAllTransactions", pending.flush)
      pendingTextNotifications.delete(doc)
    }
  }
}

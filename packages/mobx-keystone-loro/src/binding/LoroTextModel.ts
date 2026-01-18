import { type Delta, LoroText } from "loro-crdt"
import { computed, createAtom } from "mobx"
import {
  frozen,
  getParentToChildPath,
  getSnapshotModelType,
  Model,
  model,
  modelAction,
  type SnapshotOutOf,
  tProp,
  types,
} from "mobx-keystone"
import { getOrCreateLoroCollectionAtom } from "../utils/getOrCreateLoroCollectionAtom"
import { loroBindingContext } from "./loroBindingContext"
import { resolveLoroPath } from "./resolveLoroPath"

export const loroTextModelId = "mobx-keystone-loro/LoroTextModel"

/**
 * Type for the delta stored in the model.
 * Uses Quill delta format: array of operations with insert, delete, retain.
 */
export type LoroTextDeltaList = Delta<string>[]

/**
 * A mobx-keystone model representing Loro rich text.
 * This model stores the current delta state (Quill format) and syncs with LoroText.
 */
@model(loroTextModelId)
export class LoroTextModel extends Model({
  /**
   * The current delta representing the rich text content.
   * Uses Quill delta format.
   */
  deltaList: tProp(types.frozen(types.unchecked<LoroTextDeltaList>()), () => frozen([])),
}) {
  /**
   * Creates a LoroTextModel with initial text content.
   */
  static withText(text: string): LoroTextModel {
    return new LoroTextModel({
      deltaList: frozen([{ insert: text }]),
    })
  }

  /**
   * Creates a LoroTextModel with initial delta.
   */
  static withDelta(delta: LoroTextDeltaList): LoroTextModel {
    return new LoroTextModel({
      deltaList: frozen(delta),
    })
  }

  /**
   * Atom that gets changed when the associated Loro text changes.
   */
  loroTextChangedAtom = createAtom("loroTextChangedAtom")

  /**
   * The LoroText object represented by this mobx-keystone node, if bound.
   * Returns undefined when the model is not part of a bound object tree.
   */
  @computed
  get loroText(): LoroText | undefined {
    // Check if we have a binding context first - return undefined if not bound
    const ctx = loroBindingContext.get(this)
    if (ctx?.boundObject == null) {
      return undefined
    }

    try {
      const path = getParentToChildPath(ctx.boundObject, this)
      if (!path) {
        return undefined
      }

      // If this model IS the bound object, the loroObject is the LoroText
      if (path.length === 0) {
        const loroObject = ctx.loroObject
        if (loroObject instanceof LoroText) {
          getOrCreateLoroCollectionAtom(loroObject).reportObserved()
          return loroObject
        }
        return undefined
      }

      // Otherwise resolve the path
      const loroObject = resolveLoroPath(ctx.loroObject, path)

      if (loroObject instanceof LoroText) {
        getOrCreateLoroCollectionAtom(loroObject).reportObserved()
        return loroObject
      }
    } catch {
      // Path resolution failed - return undefined
    }

    return undefined
  }

  /**
   * Gets the plain text content.
   * This always uses the stored delta, which is kept in sync with Loro.
   */
  @computed
  get text(): string {
    this.loroTextChangedAtom.reportObserved()

    // Always compute from delta - it's the source of truth for this model
    // The delta is kept in sync with Loro via patches
    return this.deltaToText(this.deltaList.data)
  }

  /**
   * Gets the current delta (Quill format).
   */
  @computed
  get currentDelta(): LoroTextDeltaList {
    this.loroTextChangedAtom.reportObserved()

    // Try to get from bound LoroText first
    const loroText = this.loroText
    if (loroText) {
      try {
        return loroText.toDelta()
      } catch {
        // fall back to stored delta
      }
    }

    return this.deltaList.data
  }

  /**
   * Converts delta to plain text.
   */
  private deltaToText(delta: LoroTextDeltaList): string {
    let result = ""
    for (const op of delta) {
      if ("insert" in op && typeof op.insert === "string") {
        result += op.insert
      }
    }
    return result
  }

  /**
   * Sets the delta.
   */
  @modelAction
  setDelta(delta: LoroTextDeltaList): void {
    this.deltaList = frozen(delta)
  }

  /**
   * Inserts text at the specified position.
   */
  @modelAction
  insertText(index: number, text: string): void {
    const loroText = this.loroText
    if (loroText) {
      loroText.insert(index, text)
      // The binding will handle syncing back
    } else {
      // Fallback: modify delta directly
      const currentText = this.text
      const newText = currentText.slice(0, index) + text + currentText.slice(index)
      this.deltaList = frozen([{ insert: newText }])
    }
  }

  /**
   * Deletes text at the specified range.
   */
  @modelAction
  deleteText(index: number, length: number): void {
    const loroText = this.loroText
    if (loroText) {
      loroText.delete(index, length)
      // The binding will handle syncing back
    } else {
      // Fallback: modify delta directly
      const currentText = this.text
      const newText = currentText.slice(0, index) + currentText.slice(index + length)
      this.deltaList = frozen([{ insert: newText }])
    }
  }

  /**
   * Internal action to update delta from Loro sync.
   * @internal
   */
  @modelAction
  _updateDeltaFromLoro(delta: LoroTextDeltaList): void {
    this.deltaList = frozen(delta)
  }
}

/**
 * Type for LoroTextModel for use with tProp.
 */
export const loroTextModelType = types.model(LoroTextModel)

/**
 * Checks if a snapshot is a LoroTextModel snapshot.
 */
export function isLoroTextModelSnapshot(value: unknown): value is SnapshotOutOf<LoroTextModel> {
  return getSnapshotModelType(value) === loroTextModelId
}

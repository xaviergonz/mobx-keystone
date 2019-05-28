import { computed } from "mobx"
import { model, Model } from "../model"
import { getRoot, walkTree, WalkTreeMode } from "../parent"
import { failure } from "../utils"

@model("$$Ref")
export class Ref<T extends Model> extends Model {
  private _current?: T

  readonly data: {
    readonly id: string
  } = { id: "" }

  private _resolveCurrent(): T | undefined {
    if (this._current) {
      return this._current
    }

    if (!this.id) {
      return undefined
    }

    const root = getRoot(this)
    if (root === this) {
      return undefined // if the ref is not attached it is unlikely we will find current
    }

    this._current = walkTree(
      root,
      node => {
        if (node instanceof Model && node.modelId === this.id) {
          return node as T
        }
        return undefined
      },
      WalkTreeMode.ParentFirst
    )

    return this._current
  }

  @computed
  get id() {
    return this.data.id
  }

  @computed
  get isValid(): boolean {
    const current = this._resolveCurrent()
    if (!current) return false

    return getRoot(this) === getRoot(current) // maybe it moved
  }

  get current(): T {
    const current = this._resolveCurrent()
    if (!current) {
      throw failure(
        `a model with id '${this.data.id}' could not be found in the same tree as the reference`
      )
    }
    return current
  }
}

export function ref<T extends Model>(current: T): Ref<T> {
  if (!(current instanceof Model)) {
    throw failure("a reference can only point to a model instance")
  }

  const r = new Ref<T>()
  ;(r.data as any).id = current.modelId
  ;(r as any)._current = current
  return r
}

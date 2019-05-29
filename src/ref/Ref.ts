import { computed, when } from "mobx"
import { Writable } from "ts-essentials"
import { model, Model } from "../model"
import { getRootIdCache } from "../parent/core"
import { detach } from "../parent/detach"
import { getRoot } from "../parent/path"
import { failure } from "../utils"

@model("$$Ref")
export class Ref<T extends Model> extends Model {
  readonly data: {
    readonly id: string
    readonly autoDetach?: boolean
  } = { id: "" }

  @computed
  get id() {
    return this.data.id
  }

  @computed
  get maybeCurrent(): T | undefined {
    return getRootIdCache(getRoot(this)).get(this.id) as T | undefined
  }

  @computed
  get isValid(): boolean {
    return !!this.maybeCurrent
  }

  @computed
  get current(): T {
    const current = this.maybeCurrent

    if (!current) {
      throw failure(
        `a model with id '${this.data.id}' could not be found in the same tree as the reference`
      )
    }

    return current
  }

  attachedToRootStore() {
    if (!this.data.autoDetach) {
      return undefined
    }

    const whenDisposer = when(
      () => !this.isValid,
      () => {
        detach(this)
      }
    )

    return whenDisposer
  }
}

export function ref<T extends Model>(current: T, opts?: { autoDetach: boolean }): Ref<T> {
  if (!(current instanceof Model)) {
    throw failure("a reference can only point to a model instance")
  }

  const r = new Ref<T>()
  const data: Writable<typeof r.data> = r.data
  data.id = current.modelId
  if (opts && opts.autoDetach) {
    data.autoDetach = true
  }
  return r
}

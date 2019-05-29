import { computed } from "mobx"
import { model, Model } from "../model"
import { getRoot } from "../parent"
import { getRootIdCache } from "../parent/core"
import { failure } from "../utils"

@model("$$Ref")
export class Ref<T extends Model> extends Model {
  readonly data: {
    readonly id: string
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
}

export function ref<T extends Model>(current: T): Ref<T> {
  if (!(current instanceof Model)) {
    throw failure("a reference can only point to a model instance")
  }

  const r = new Ref<T>()
  ;(r.data as any).id = current.modelId
  return r
}

import { computed, when } from "mobx"
import { Writable } from "ts-essentials"
import { Model } from "../model/Model"
import { model } from "../model/modelDecorator"
import { getRootIdCache } from "../parent/core"
import { detach } from "../parent/detach"
import { getRoot } from "../parent/path"
import { failure } from "../utils"

/**
 * A reference to the unique ID of a given model object.
 * Use `ref` to create an instance of this class.
 *
 * @typeparam T Referenced object type.
 */
@model("$$Ref")
export class Ref<T extends Model> extends Model {
  readonly data: {
    readonly id: string
    readonly autoDetach?: boolean
  } = { id: "" }

  /**
   * Unique model ID this reference points to.
   *
   * @readonly
   */
  @computed
  get id() {
    return this.data.id
  }

  /**
   * Returns the model this reference points to, or undefined if it could not be found in the same tree.
   *
   * @readonly
   */
  @computed
  get maybeCurrent(): T | undefined {
    return getRootIdCache(getRoot(this)).get(this.id) as T | undefined
  }

  /**
   * Returns if the reference is valid, this is, if the referenced model object is not part of the same
   * tree than the reference.
   *
   * @readonly
   */
  @computed
  get isValid(): boolean {
    return !!this.maybeCurrent
  }

  /**
   * Returns the model this reference points to, or throws if it could not be found in the same tree.
   *
   * @readonly
   */
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

  onAttachedToRootStore() {
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

/**
 * Creates a ref to a model object, which in its snapshot form points to the unique ID of the model instance.
 * TODO: explain autoDetach option
 *
 * @typeparam T Referenced object type.
 * @param current Target model instance.
 * @param [opts] Reference options.
 * @returns
 */
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

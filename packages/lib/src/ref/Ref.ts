import { computed, when } from "mobx"
import { AnyModel, BaseModel, ModelCreationData } from "../model/BaseModel"
import { Model } from "../model/Model"
import { model } from "../model/modelDecorator"
import { newModel } from "../model/newModel"
import { resolveModelId } from "../parent/core"
import { detach } from "../parent/detach"
import { getRoot } from "../parent/path"
import { tProp } from "../typeChecking/tProp"
import { types } from "../typeChecking/types"
import { failure } from "../utils"

/**
 * A reference to the unique ID of a given model object.
 * Use `ref` to create an instance of this class.
 *
 * @typeparam T Referenced object type.
 */
@model("$$Ref")
export class Ref<T extends AnyModel> extends Model({
  /**
   * Unique model ID this reference points to.
   *
   * @readonly
   */
  id: tProp(types.string),

  autoDetach: tProp(types.boolean, () => false),
}) {
  /**
   * The model this reference points to, or undefined if it could not be found in the same tree.
   *
   * @readonly
   */
  @computed
  get maybeCurrent(): T | undefined {
    return resolveModelId(getRoot(this), this.id)
  }

  /**
   * If the reference is valid, this is, if the referenced model object is not part of the same
   * tree than the reference.
   *
   * @readonly
   */
  @computed
  get isValid(): boolean {
    return !!this.maybeCurrent
  }

  /**
   * The model this reference points to, or throws if it could not be found in the same tree.
   *
   * @readonly
   */
  @computed
  get current(): T {
    const current = this.maybeCurrent

    if (!current) {
      throw failure(
        `a model with id '${this.id}' could not be found in the same tree as the reference`
      )
    }

    return current
  }

  onAttachedToRootStore() {
    if (!this.autoDetach) {
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
 *
 * The `autoDetach` option, when set to true (default is false), allows the reference to auto-detach itself
 * from its parent (using `detach`) as soon as it becomes invalid while being attached to a root store.
 * Note that for the option to work the root object must be registered as a root store using `registerAsRootStore`.
 *
 * @typeparam T Referenced object type.
 * @param current Target model instance.
 * @param [opts] Reference options.
 * @returns
 */
export function ref<T extends AnyModel>(current: T, opts?: { autoDetach: boolean }): Ref<T> {
  if (!(current instanceof BaseModel)) {
    throw failure("a reference can only point to a model instance")
  }

  const creationData: ModelCreationData<Ref<T>> = {
    id: current.modelId,
  }
  if (opts && opts.autoDetach) {
    creationData.autoDetach = true
  }

  return newModel<Ref<T>>(Ref, creationData)
}

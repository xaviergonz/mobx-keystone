import { computed } from "mobx"
import { ModelClass } from "../model/BaseModel"
import { Model } from "../model/Model"
import { typesString } from "../typeChecking/primitives"
import { tProp } from "../typeChecking/tProp"
import { failure } from "../utils"

/**
 * A reference model base type.
 * Use `customRef` to create a custom ref constructor.
 */
export abstract class Ref<T extends object> extends Model({
  /**
   * Reference id.
   */
  id: tProp(typesString),
}) {
  protected abstract resolve(): T | undefined

  /**
   * The object this reference points to, or undefined if the reference is currently invalid.
   */
  @computed
  get maybeCurrent(): T | undefined {
    return this.resolve()
  }

  /**
   * If the reference is currently valid.
   */
  @computed
  get isValid(): boolean {
    return !!this.maybeCurrent
  }

  /**
   * The object this reference points to, or throws if invalid.
   */
  @computed
  get current(): T {
    const current = this.maybeCurrent

    if (!current) {
      throw failure(
        `a reference of type '${this.$modelType}' could not resolve an object with id '${this.id}'`
      )
    }

    return current
  }
}

export declare const customRefTypeSymbol: unique symbol

/** A ref constructor for custom refs */
export interface RefConstructor<T extends object> {
  (valueOrID: T | string): Ref<T>

  refClass: ModelClass<Ref<T>>

  /** @internal */
  [customRefTypeSymbol]: T // just for typings
}

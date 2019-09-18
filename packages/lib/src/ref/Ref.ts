import { computed } from "mobx"
import { ModelClass } from "../model/BaseModel"
import { Model } from "../model/Model"
import { typesString } from "../typeChecking/primitives"
import { tProp } from "../typeChecking/tProp"
import { failure, inDevMode } from "../utils"

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
   * The object this reference points to, or `undefined` if the reference is currently invalid.
   */
  @computed
  get maybeCurrent(): T | undefined {
    if (inDevMode()) {
      if (this.isDisposed) {
        throw failure("a disposed reference cannot be used")
      }
    }

    return this.resolve()
  }

  /**
   * If the reference is currently valid.
   */
  @computed
  get isValid(): boolean {
    if (inDevMode()) {
      if (this.isDisposed) {
        throw failure("a disposed reference cannot be used")
      }
    }

    return !!this.maybeCurrent
  }

  /**
   * The object this reference points to, or throws if invalid.
   */
  @computed
  get current(): T {
    if (inDevMode()) {
      if (this.isDisposed) {
        throw failure("a disposed reference cannot be used")
      }
    }

    const current = this.maybeCurrent

    if (!current) {
      throw failure(
        `a reference of type '${this.$modelType}' could not resolve an object with id '${this.id}'`
      )
    }

    return current
  }

  /**
   * Checks if the reference has been disposed.
   */
  readonly isDisposed: boolean = false

  /**
   * Disposes of the ref. Will do nothing if already disposed.
   */
  readonly dispose!: () => void
}

export declare const customRefTypeSymbol: unique symbol

/** A ref constructor for custom refs */
export interface RefConstructor<T extends object> {
  (valueOrID: T | string): Ref<T>

  refClass: ModelClass<Ref<T>>

  /** @internal */
  [customRefTypeSymbol]: T // just for typings
}

/**
 * Checks if a ref object is of a given ref type.
 *
 * @typeparam T Referenced object type.
 * @param ref Reference object.
 * @param refType Reference type.
 * @returns `true` if it is of the given type, false otherwise.
 */
export function isRefOfType<T extends object>(
  ref: Ref<object>,
  refType: RefConstructor<T>
): ref is Ref<T> {
  return ref instanceof refType.refClass
}

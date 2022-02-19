import { computed } from "mobx"
import { modelTypeKey } from "../model/metadata"
import { Model } from "../model/Model"
import type { ModelClass } from "../modelShared/BaseModelShared"
import { typesString } from "../types/primitiveBased/primitives"
import { tProp } from "../types/tProp"
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
   * The object this reference points to, or `undefined` if the reference is currently invalid.
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
        `a reference of type '${this[modelTypeKey]}' could not resolve an object with id '${this.id}'`
      )
    }

    return current
  }

  /**
   * Ensures back references for this ref are up to date.
   * This only needs to be called if you need to get the most up to date
   * back references while both still inside an action and while the reference
   * is not a child of the same root than the target.
   */
  abstract forceUpdateBackRefs(): void
}

/**
 * @internal
 */
export declare const customRefTypeSymbol: unique symbol

/** A ref constructor for custom refs */
export interface RefConstructor<T extends object> {
  <TE extends T>(valueOrID: TE | string): Ref<TE>

  refClass: ModelClass<Ref<T>>

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

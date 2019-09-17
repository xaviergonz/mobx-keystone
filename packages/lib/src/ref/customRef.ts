import { action } from "mobx"
import {
  getModelRefId,
  internalCustomRef,
  RefIdResolver,
  RefOnResolvedValueChange,
  RefResolver,
} from "./core"
import { RefConstructor } from "./Ref"

/**
 * Custom reference options.
 */
export interface CustomRefOptions<T extends object> {
  /**
   * Must return the resolution for the given reference object.
   *
   * @param ref Reference object.
   * @returns The resolved object or undefined if it could not be resolved.
   */
  resolve: RefResolver<T>

  /**
   * Must return the ID associated to the given target object, or `undefined` if it has no ID.
   * If not provided it will try to get the reference id from the model `getRefId()` method.
   *
   * @param target Target object.
   */
  getId?: RefIdResolver<T>

  /**
   * What should happen when the resolved value changes.
   *
   * @param ref Reference object.
   * @param newValue New resolved value.
   * @param oldValue Old resolved value.
   */
  onResolvedValueChange?: RefOnResolvedValueChange<T>
}

/**
 * Creates a custom ref to an object, which in its snapshot form has an id.
 *
 * @typeparam T Target object type.
 * @param modelTypeId Unique model type id.
 * @param options Custom reference options.
 * @returns A function that allows you to construct that type of custom reference.
 */
export const customRef = action(
  "customRef",
  <T extends object>(modelTypeId: string, options: CustomRefOptions<T>): RefConstructor<T> => {
    const getId = options.getId || getModelRefId

    return internalCustomRef(
      modelTypeId,
      () => options.resolve,
      getId,
      options.onResolvedValueChange
    )
  }
)

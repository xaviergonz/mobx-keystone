import { action } from "mobx"
import { fastGetRoot } from "../parent/path"
import {
  getModelRefId,
  internalCustomRef,
  RefIdResolver,
  RefOnResolvedValueChange,
  RefResolver,
  resolveId,
} from "./core"
import type { Ref, RefConstructor } from "./Ref"

/**
 * Custom reference options.
 */
export interface RootRefOptions<T extends object> {
  /**
   * Must return the ID associated to the given target object, or `undefined` if it has no ID.
   * If not provided it will try to get the reference id from the model `getRefId()` method.
   *
   * @param target Target object.
   */
  getId?: RefIdResolver

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
 * Creates a root ref to an object, which in its snapshot form has an id.
 * A root ref will only be able to resolve references as long as both the Ref
 * and the referenced object share a common root.
 *
 * @template T Target object type.
 * @param modelTypeId Unique model type id.
 * @param [options] Root reference options.
 * @returns A function that allows you to construct that type of root reference.
 */
export const rootRef: <T extends object>(
  modelTypeId: string,
  options?: RootRefOptions<T>
) => RefConstructor<T> = action(
  "rootRef",
  <T extends object>(modelTypeId: string, options?: RootRefOptions<T>): RefConstructor<T> => {
    const getId = options?.getId ?? getModelRefId
    const onResolvedValueChange = options?.onResolvedValueChange

    const resolverGen = (ref: Ref<T>): RefResolver<T> => {
      let cachedTarget: T | undefined

      return () => {
        const refRoot = fastGetRoot(ref, true)

        if (isRefRootCachedTargetOk(ref, refRoot, cachedTarget, getId)) {
          return cachedTarget
        }

        // Detached refs cannot resolve a rootRef target until they are attached.
        // Skipping resolveId here avoids creating one computed id tree per detached ref.
        if (refRoot === ref) {
          return undefined
        }

        // when not found, everytime a child is added/removed or its id changes we will perform another search
        // this search is only done once for every distinct getId function
        const newTarget = resolveId<T>(refRoot, ref.id, getId)
        if (newTarget) {
          cachedTarget = newTarget
        }
        return newTarget
      }
    }

    return internalCustomRef(modelTypeId, resolverGen, getId, onResolvedValueChange)
  }
)

function isRefRootCachedTargetOk<T extends object>(
  ref: Ref<T>,
  refRoot: object,
  cachedTarget: T | undefined,
  getId: RefIdResolver
): cachedTarget is T {
  if (!cachedTarget) {
    return false
  }
  if (ref.id !== getId(cachedTarget)) {
    return false
  }
  if (refRoot !== fastGetRoot(cachedTarget, true)) {
    return false
  }
  return true
}

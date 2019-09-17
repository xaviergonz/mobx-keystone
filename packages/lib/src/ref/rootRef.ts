import { action } from "mobx"
import { optimizedWalkTreeSearch } from "../parent/optimizedWalkTree"
import { fastGetRoot } from "../parent/path"
import { getSnapshot } from "../snapshot/getSnapshot"
import {
  getModelRefId,
  internalCustomRef,
  RefIdResolver,
  RefOnResolvedValueChange,
  RefResolver,
} from "./core"
import { Ref, RefConstructor } from "./Ref"

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
  getId?: RefIdResolver<unknown>

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
 * @typeparam T Target object type.
 * @param modelTypeId Unique model type id.
 * @param [options] Root reference options.
 * @returns A function that allows you to construct that type of root reference.
 */
export const rootRef = action(
  "rootRef",
  <T extends object>(modelTypeId: string, options?: RootRefOptions<T>): RefConstructor<T> => {
    const getId = (options && options.getId) || getModelRefId
    const onResolvedValueChange = options && options.onResolvedValueChange

    const resolverGen = (): RefResolver<T> => {
      let cachedTarget: T | undefined
      let alreadyVisited: WeakMap<object, T | undefined>
      let lastRefRoot: object

      return ref => {
        const refRoot = fastGetRoot(ref)
        // if the root changes then our list of already visited changes
        if (lastRefRoot !== refRoot) {
          lastRefRoot = refRoot
          alreadyVisited = new WeakMap()
        }

        if (isRefRootCachedTargetOk(ref, refRoot, cachedTarget, getId)) {
          return cachedTarget
        }

        // read root snapshot just to mark it as dependency
        // (when not found, everytime anything in the tree changes we will perform another search)
        getSnapshot(refRoot)
        const newTarget = resolveRefRoot(ref, refRoot, getId, alreadyVisited)
        if (newTarget !== cachedTarget) {
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
  getId: RefIdResolver<T>
): cachedTarget is T {
  if (!cachedTarget) return false
  if (ref.id !== getId(cachedTarget)) return false
  if (refRoot !== fastGetRoot(cachedTarget)) return false
  return true
}

/**
 * @ignore
 */
export const resolveRefRoot = action(
  <T extends object>(
    ref: Ref<T>,
    refRoot: object,
    getId: RefIdResolver<T>,
    alreadyVisited: WeakMap<object, T | undefined>
  ): T | undefined => {
    // this will mark all snapshots that don't have the required id deeply inside as visited
    // that way we only traverse changed parts of the tree when looking for new ids
    const found = optimizedWalkTreeSearch(refRoot, alreadyVisited, child => {
      const id = getId(child as T)
      if (id === ref.id) {
        // found
        return child as T
      } else {
        return undefined
      }
    })

    return found
  }
)

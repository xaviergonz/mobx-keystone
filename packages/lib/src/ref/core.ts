import { action, observable, ObservableSet, reaction, when } from "mobx"
import { isModel } from "../model/utils"
import { model } from "../modelShared/modelDecorator"
import { assertTweakedObject } from "../tweaker/core"
import { assertIsObject, failure } from "../utils"
import { Ref, RefConstructor } from "./Ref"

interface BackRefs<T extends object> {
  all: ObservableSet<Ref<T>>
  byType: WeakMap<RefConstructor<T>, ObservableSet<Ref<T>>>
}

/**
 * Back-references from object to the references that point to it.
 */
const objectBackRefs = new WeakMap<object, BackRefs<object>>()

/**
 * List of all refs currently attached to a root store.
 * Just to be able to properly update back-refs when in the middle of an action.
 */
const allRefs = new Set<Ref<any>>()

/**
 * Reference resolver type.
 */
export type RefResolver<T extends object> = (ref: Ref<T>) => T | undefined

/**
 * Reference ID resolver type.
 */
export type RefIdResolver<T extends object | unknown> = (target: T) => string | undefined

/**
 * Type for the callback called when a reference resolved value changes.
 */
export type RefOnResolvedValueChange<T extends object> = (
  ref: Ref<T>,
  newValue: T | undefined,
  oldValue: T | undefined
) => void

/**
 * @ignore
 * @internal
 */
export function internalCustomRef<T extends object>(
  modelTypeId: string,
  resolverGen: (ref: Ref<T>) => RefResolver<T>,
  getId: RefIdResolver<T>,
  onResolvedValueChange: RefOnResolvedValueChange<T> | undefined
): RefConstructor<T> {
  @model(modelTypeId)
  class CustomRef extends Ref<T> {
    private resolver?: RefResolver<T>

    resolve(): T | undefined {
      if (!this.resolver) {
        this.resolver = resolverGen(this)
      }

      return this.resolver(this)
    }

    onAttachedToRootStore() {
      allRefs.add(this)

      return () => {
        allRefs.delete(this)
      }
    }

    #savedOldTarget: T | undefined

    #internalForceUpdateBackRefs = action("forceUpdateBackRefs", (newTarget: T | undefined) => {
      const oldTarget = this.#savedOldTarget
      // update early in case of thrown exceptions
      this.#savedOldTarget = newTarget

      updateBackRefs(this, fn as any, newTarget, oldTarget)
    })

    forceUpdateBackRefs() {
      this.#internalForceUpdateBackRefs(this.maybeCurrent)
    }

    onInit() {
      // listen to changes

      let savedOldTarget: T | undefined
      let savedFirstTime = true

      // according to mwestrate this won't leak as long as we don't keep the disposer around
      reaction(
        () => this.maybeCurrent,
        (newTarget) => {
          this.#internalForceUpdateBackRefs(newTarget)

          const oldTarget = savedOldTarget
          const firstTime = savedFirstTime
          // update early in case of thrown exceptions
          savedOldTarget = newTarget
          savedFirstTime = false

          if (!firstTime && onResolvedValueChange && newTarget !== oldTarget) {
            onResolvedValueChange(this, newTarget, oldTarget)
          }
        },
        { fireImmediately: true }
      )
    }
  }

  const fn = (target: T) => {
    let id: string | undefined
    if (typeof target === "string") {
      id = target
    } else {
      assertIsObject(target, "target")
      id = getId(target)
    }

    if (typeof id !== "string") {
      throw failure("ref target object must have an id of string type")
    }

    const ref = new CustomRef({
      id,
    })

    return ref
  }
  fn.refClass = CustomRef

  return (fn as any) as RefConstructor<T>
}

/**
 * Uses a model `getRefId()` method whenever possible to get a reference ID.
 * If the model does not have an implementation of that method it returns `undefined`.
 * If the model has an implementation, but that implementation returns anything other than
 * a `string` it will throw.
 *
 * @param target Target object to get the ID from.
 * @returns The string ID or `undefined`.
 */
export function getModelRefId(target: object): string | undefined {
  if (isModel(target) && target.getRefId) {
    const id = target.getRefId()
    if (typeof id !== "string") {
      throw failure("'getRefId()' must return a string when present")
    }
    return id
  }
  return undefined
}

function getBackRefs(target: object, refType?: RefConstructor<object>): ObservableSet<Ref<object>> {
  let backRefs = objectBackRefs.get(target)
  if (!backRefs) {
    backRefs = {
      all: observable.set(undefined, { deep: false }),
      byType: new WeakMap(),
    }
    objectBackRefs.set(target, backRefs)
  }

  if (!refType) {
    return backRefs.all
  } else {
    let byType = backRefs.byType.get(refType)
    if (!byType) {
      byType = observable.set(undefined, { deep: false })
      backRefs.byType.set(refType, byType)
    }
    return byType
  }
}

/**
 * Gets all references that resolve to a given object.
 *
 * @typeparam T Referenced object type.
 * @param target Node the references point to.
 * @param [refType] Pass it to filter by only references of a given type, or do not to get references of any type.
 * @returns An observable set with all reference objects that point to the given object.
 */
export function getRefsResolvingTo<T extends object>(
  target: T,
  refType?: RefConstructor<T>
): ObservableSet<Ref<T>> {
  assertTweakedObject(target, "target")

  const refTypeObject = refType as RefConstructor<object> | undefined

  if (isReactionDelayed()) {
    // in this case the reference update might have been delayed
    // so we will make a best effort to update them
    allRefs.forEach((ref) => ref.forceUpdateBackRefs())
  }

  return getBackRefs(target, refTypeObject) as ObservableSet<Ref<T>>
}

const updateBackRefs = action(
  "updateBackRefs",
  <T extends object>(
    ref: Ref<T>,
    refClass: RefConstructor<T>,
    newTarget: T | undefined,
    oldTarget: T | undefined
  ) => {
    if (newTarget === oldTarget) {
      return
    }

    if (oldTarget) {
      getBackRefs(oldTarget).delete(ref)
      getBackRefs(oldTarget, refClass as RefConstructor<any>).delete(ref)
    }
    if (newTarget) {
      getBackRefs(newTarget).add(ref)
      getBackRefs(newTarget, refClass as RefConstructor<any>).add(ref)
    }
  }
)

function isReactionDelayed() {
  let reactionDelayed = true
  const dispose = when(
    () => true,
    () => {
      reactionDelayed = false
    }
  )
  dispose()
  return reactionDelayed
}

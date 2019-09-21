import { observable, ObservableSet, reaction } from "mobx"
import { model } from "../model/modelDecorator"
import { isModel } from "../model/utils"
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
 * Reference resolver type.
 */
export type RefResolver<T extends object> = (ref: Ref<T>) => T | undefined

/**
 * Reference ID resolver type.
 */
export type RefIdResolver<T extends object | unknown> = (target: T) => string | undefined

/**
 * Reference resolve valude changed hook type.
 */
export type RefOnResolvedValueChange<T extends object> = (
  ref: Ref<T>,
  newValue: T | undefined,
  oldValue: T | undefined
) => void

/**
 * @ignore
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

    // listen to changes

    let savedOldTarget: T | undefined
    let savedFirstTime = true

    // according to mwestrate this won't leak as long as we don't keep the disposer around
    reaction(
      () => ref.maybeCurrent,
      newTarget => {
        const oldTarget = savedOldTarget
        const firstTime = savedFirstTime
        // update early in case of thrown exceptions
        savedOldTarget = newTarget
        savedFirstTime = false

        updateBackRefs(ref, fn as any, newTarget, oldTarget)

        if (!firstTime && onResolvedValueChange && newTarget !== oldTarget) {
          onResolvedValueChange(ref, newTarget, oldTarget)
        }
      },
      { fireImmediately: true }
    )

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
  return getBackRefs(target, refTypeObject) as ObservableSet<Ref<T>>
}

function updateBackRefs<T extends object>(
  ref: Ref<T>,
  refClass: RefConstructor<T>,
  newTarget: T | undefined,
  oldTarget: T | undefined
) {
  if (newTarget === oldTarget) {
    return
  }

  if (oldTarget) {
    getBackRefs(oldTarget).delete(ref)
    getBackRefs(oldTarget, refClass as RefConstructor<object>).delete(ref)
  }
  if (newTarget) {
    getBackRefs(newTarget).add(ref)
    getBackRefs(newTarget, refClass as RefConstructor<object>).add(ref)
  }
}

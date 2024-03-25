import { action, observable, ObservableSet, reaction, when } from "mobx"
import { isModel } from "../model/utils"
import type { ModelClass } from "../modelShared/BaseModelShared"
import { model } from "../modelShared/modelDecorator"
import {
  getDeepObjectChildren,
  registerDeepObjectChildrenExtension,
} from "../parent/coreObjectChildren"
import { fastGetRoot } from "../parent/path"
import { ComputedWalkTreeAggregate, computedWalkTreeAggregate } from "../parent/walkTree"
import { assertTweakedObject } from "../tweaker/core"
import { assertIsObject, failure } from "../utils"
import { getOrCreate } from "../utils/mapUtils"
import { Ref, RefConstructor } from "./Ref"

interface BackRefs<T extends object> {
  all: ObservableSet<Ref<T>>
  byType: WeakMap<RefConstructor<T>, ObservableSet<Ref<T>>>
}

/**
 * Back-references from object to the references that point to it.
 */
const objectBackRefs = new WeakMap<object, BackRefs<any>>()

/**
 * Reference resolver type.
 */
export type RefResolver<T extends object> = (ref: Ref<T>) => T | undefined

/**
 * Reference ID resolver type.
 */
export type RefIdResolver = (target: object) => string | undefined

/**
 * Type for the callback called when a reference resolved value changes.
 */
export type RefOnResolvedValueChange<T extends object> = (
  ref: Ref<T>,
  newValue: T | undefined,
  oldValue: T | undefined
) => void

/**
 * @internal
 */
export function internalCustomRef<T extends object>(
  modelTypeId: string,
  resolverGen: (ref: Ref<T>) => RefResolver<T>,
  getId: RefIdResolver,
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

    private savedOldTarget: T | undefined

    private internalForceUpdateBackRefs(newTarget: T | undefined) {
      const oldTarget = this.savedOldTarget
      // update early in case of thrown exceptions
      this.savedOldTarget = newTarget

      updateBackRefs(this, thisRefConstructor, newTarget, oldTarget)
    }

    @action
    forceUpdateBackRefs() {
      this.internalForceUpdateBackRefs(this.maybeCurrent)
    }

    onInit() {
      // listen to changes

      let savedOldTarget: T | undefined
      let savedFirstTime = true

      // according to mwestrate this won't leak as long as we don't keep the disposer around
      reaction(
        () => this.maybeCurrent,
        (newTarget) => {
          this.internalForceUpdateBackRefs(newTarget)

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

  const thisRefConstructor = fn as any as RefConstructor<T>

  return thisRefConstructor
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
    if (id !== undefined && typeof id !== "string") {
      throw failure("'getRefId()' must return a string or undefined when present")
    }
    return id
  }
  return undefined
}

// one computed id tree per id function
const computedIdTrees = new WeakMap<
  (node: object) => string | undefined,
  ComputedWalkTreeAggregate<string>
>()

/**
 * Resolves a node given its ID.
 *
 * @typeparam T Target object type.
 * @param root Node where to start the search. The search will be done on it and all its children.
 * @param id ID to search for.
 * @param getId Function that will be used to get the ID from an object (`getModelRefId` by default).
 * @returns The node found or `undefined` if none.
 */
export function resolveId<T extends object>(
  root: object,
  id: string,
  getId: RefIdResolver = getModelRefId
): T | undefined {
  // cache/reuse computedIdTrees for same getId function
  const computedIdTree = getOrCreate(computedIdTrees, getId, () =>
    computedWalkTreeAggregate<string>((node) => getId(node))
  )

  const idMap = computedIdTree.walk(root)
  return idMap ? (idMap.get(id) as T | undefined) : undefined
}

function getBackRefs<T extends object>(
  target: T,
  refType?: RefConstructor<T>
): ObservableSet<Ref<T>> {
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
 * @param refType Pass it to filter by only references of a given type, or omit / pass `undefined` to get references of any type.
 * @param options Options.
 * @returns An observable set with all reference objects that point to the given object.
 */
export function getRefsResolvingTo<T extends object>(
  target: T,
  refType?: RefConstructor<T>,
  options?: {
    updateAllRefsIfNeeded?: boolean
  }
): ObservableSet<Ref<T>> {
  assertTweakedObject(target, "target")

  if (options?.updateAllRefsIfNeeded && isReactionDelayed()) {
    // in this case the reference update might have been delayed
    // so we will make a best effort to update them
    const refsChecked = new Set<Ref<object>>()
    const updateRef = (ref: Ref<any>) => {
      if (!refsChecked.has(ref)) {
        if (!refType || ref instanceof refType.refClass) {
          ref.forceUpdateBackRefs()
        }
        refsChecked.add(ref)
      }
    }

    const oldBackRefs = getBackRefs(target, refType)
    oldBackRefs.forEach(updateRef)

    const refsChildrenOfRoot = getDeepChildrenRefs(getDeepObjectChildren(fastGetRoot(target, true)))
    let refs: Set<Ref<object>> | undefined
    if (refType) {
      refs = refsChildrenOfRoot.byType.get(refType.refClass)
    } else {
      refs = refsChildrenOfRoot.all
    }
    refs?.forEach(updateRef)
  }

  return getBackRefs(target, refType)
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

interface DeepChildrenRefs {
  all: Set<Ref<any>>
  byType: WeakMap<ModelClass<Ref<any>>, Set<Ref<any>>>
}

const getDeepChildrenRefs = registerDeepObjectChildrenExtension<DeepChildrenRefs>({
  initData() {
    return {
      all: new Set(),
      byType: new WeakMap(),
    }
  },

  addNode(node, data) {
    if (node instanceof Ref) {
      data.all.add(node)
      const refsByThisType = getOrCreate(data.byType, node.constructor, () => new Set())
      refsByThisType.add(node)
    }
  },
})

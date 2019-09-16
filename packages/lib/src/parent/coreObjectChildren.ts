import { action, createAtom, IAtom, observable, ObservableSet } from "mobx"
import { isModel } from "../model/utils"
import { fastGetParent, fastIsModelDataObject } from "./path"

const defaultObservableSetOptions = { deep: false }

const objectChildren = new WeakMap<
  object,
  {
    shallow: ObservableSet<object>
    deep: ReadonlySet<object>
    deepDirty: boolean
    deepAtom: IAtom
  }
>()

/**
 * @ignore
 */
export function initializeObjectChildren(node: object) {
  if (objectChildren.has(node)) {
    return
  }

  objectChildren.set(node, {
    shallow: observable.set(undefined, defaultObservableSetOptions),
    deep: new Set<object>(),
    deepDirty: true,
    deepAtom: createAtom("deepChildrenAtom"),
  })
}

/**
 * @ignore
 */
export function getObjectChildren(node: object): ReadonlySet<object> {
  return objectChildren.get(node)!.shallow
}

/**
 * @ignore
 */
export function getDeepObjectChildren(node: object): ReadonlySet<object> {
  const obj = objectChildren.get(node)!
  if (obj.deepDirty) {
    updateDeepObjectChildren(node)
  }
  obj.deepAtom.reportObserved()
  return obj.deep
}

const updateDeepObjectChildren = action(
  (node: object): ReadonlySet<object> => {
    const obj = objectChildren.get(node)!
    if (!obj.deepDirty) {
      return obj.deep
    }

    const nodeIsModel = isModel(node)
    const set = new Set<object>()

    const childrenIter = getObjectChildren(node)!.values()
    let ch = childrenIter.next()
    while (!ch.done) {
      if (!nodeIsModel || !fastIsModelDataObject(ch.value)) {
        set.add(ch.value)
      }

      const ret = updateDeepObjectChildren(ch.value)
      const retIter = ret.values()
      let retCur = retIter.next()
      while (!retCur.done) {
        set.add(retCur.value)
        retCur = retIter.next()
      }

      ch = childrenIter.next()
    }

    obj.deep = set
    obj.deepDirty = false
    obj.deepAtom.reportChanged()
    return set
  }
)

/**
 * @ignore
 */
export const addObjectChild = action((node: object, child: object) => {
  const obj = objectChildren.get(node)!
  obj.shallow.add(child)

  invalidateDeepChildren(node)
})

/**
 * @ignore
 */
export const removeObjectChild = action((node: object, child: object) => {
  const obj = objectChildren.get(node)!
  obj.shallow.delete(child)

  invalidateDeepChildren(node)
})

function invalidateDeepChildren(node: object) {
  const obj = objectChildren.get(node)!

  if (!obj.deepDirty) {
    obj.deepDirty = true
    obj.deepAtom.reportChanged()
  }

  const parent = fastGetParent(node)
  if (parent) {
    invalidateDeepChildren(parent)
  }
}

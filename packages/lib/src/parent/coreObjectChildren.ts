import { action, createAtom, IAtom } from "mobx"
import { fastGetParent } from "./path"

interface DeepObjectChildren {
  deep: Set<object>

  extensionsData: WeakMap<object, any>
}

interface ObjectChildrenData extends DeepObjectChildren {
  shallow: Set<object>
  shallowAtom: IAtom

  deepDirty: boolean
  deepAtom: IAtom
}

const objectChildren = new WeakMap<object, ObjectChildrenData>()

function getObjectChildrenObject(node: object) {
  let obj = objectChildren.get(node)

  if (!obj) {
    obj = {
      shallow: new Set(),
      shallowAtom: createAtom("shallowChildrenAtom"),

      deep: new Set(),
      deepDirty: true,
      deepAtom: createAtom("deepChildrenAtom"),

      extensionsData: initExtensionsData(),
    }
    objectChildren.set(node, obj)
  }

  return obj
}

/**
 * @internal
 */
export function getObjectChildren(node: object): ObjectChildrenData["shallow"] {
  const obj = getObjectChildrenObject(node)
  obj.shallowAtom.reportObserved()
  return obj.shallow
}

/**
 * @internal
 */
export function getDeepObjectChildren(node: object): DeepObjectChildren {
  const obj = getObjectChildrenObject(node)

  if (obj.deepDirty) {
    updateDeepObjectChildren(node)
  }

  obj.deepAtom.reportObserved()

  return obj
}

function addNodeToDeepLists(node: any, data: DeepObjectChildren) {
  data.deep.add(node)
  extensions.forEach((extension, dataSymbol) => {
    extension.addNode(node, data.extensionsData.get(dataSymbol))
  })
}

const updateDeepObjectChildren = action((node: object): DeepObjectChildren => {
  const obj = getObjectChildrenObject(node)!
  if (!obj.deepDirty) {
    return obj
  }

  const data: DeepObjectChildren = {
    deep: new Set(),
    extensionsData: initExtensionsData(),
  }

  const childrenIter = obj.shallow.values()
  let ch = childrenIter.next()
  while (!ch.done) {
    addNodeToDeepLists(ch.value, data)

    const ret = updateDeepObjectChildren(ch.value).deep
    const retIter = ret.values()
    let retCur = retIter.next()
    while (!retCur.done) {
      addNodeToDeepLists(retCur.value, data)
      retCur = retIter.next()
    }

    ch = childrenIter.next()
  }

  Object.assign(obj, data)

  obj.deepDirty = false
  obj.deepAtom.reportChanged()

  return obj
})

/**
 * @internal
 */
export const addObjectChild = action((node: object, child: object) => {
  const obj = getObjectChildrenObject(node)
  obj.shallow.add(child)
  obj.shallowAtom.reportChanged()

  invalidateDeepChildren(node)
})

/**
 * @internal
 */
export const removeObjectChild = action((node: object, child: object) => {
  const obj = getObjectChildrenObject(node)
  obj.shallow.delete(child)
  obj.shallowAtom.reportChanged()

  invalidateDeepChildren(node)
})

function invalidateDeepChildren(node: object) {
  const obj = getObjectChildrenObject(node)

  if (!obj.deepDirty) {
    obj.deepDirty = true
    obj.deepAtom.reportChanged()
  }

  const parent = fastGetParent(node)
  if (parent) {
    invalidateDeepChildren(parent)
  }
}

const extensions = new Map<object, DeepObjectChildrenExtension<any>>()

interface DeepObjectChildrenExtension<D> {
  initData(): D
  addNode(node: any, data: D): void
}

/**
 * @internal
 */
export function registerDeepObjectChildrenExtension<D>(extension: DeepObjectChildrenExtension<D>) {
  const dataSymbol = {}
  extensions.set(dataSymbol, extension)

  return (data: DeepObjectChildren): D => {
    return data.extensionsData.get(dataSymbol) as D
  }
}

function initExtensionsData() {
  const extensionsData = new WeakMap<object, any>()

  extensions.forEach((extension, dataSymbol) => {
    extensionsData.set(dataSymbol, extension.initData())
  })

  return extensionsData
}

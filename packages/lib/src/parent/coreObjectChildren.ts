import { action, createAtom, IAtom, observable, ObservableSet } from "mobx"
import { fastGetParent } from "./path"

const defaultObservableSetOptions = { deep: false }

interface DeepObjectChildren {
  deep: Set<object>

  extensionsData: WeakMap<Symbol, any>
}

interface ObjectChildrenData extends DeepObjectChildren {
  shallow: ObservableSet<object>

  deepDirty: boolean
  deepAtom: IAtom
}

const objectChildren = new WeakMap<object, ObjectChildrenData>()

/**
 * @internal
 */
export function initializeObjectChildren(node: object) {
  if (objectChildren.has(node)) {
    return
  }

  objectChildren.set(node, {
    shallow: observable.set(undefined, defaultObservableSetOptions),

    deep: new Set(),
    extensionsData: initExtensionsData(),

    deepDirty: true,
    deepAtom: createAtom("deepChildrenAtom"),
  })
}

/**
 * @internal
 */
export function getObjectChildren(node: object): ObjectChildrenData["shallow"] {
  return objectChildren.get(node)!.shallow
}

/**
 * @internal
 */
export function getDeepObjectChildren(node: object): DeepObjectChildren {
  const obj = objectChildren.get(node)!

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
  const obj = objectChildren.get(node)!
  if (!obj.deepDirty) {
    return obj
  }

  const data: DeepObjectChildren = {
    deep: new Set(),
    extensionsData: initExtensionsData(),
  }

  const childrenIter = getObjectChildren(node)!.values()
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
  const obj = objectChildren.get(node)!
  obj.shallow.add(child)

  invalidateDeepChildren(node)
})

/**
 * @internal
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

const extensions = new Map<Symbol, DeepObjectChildrenExtension<any>>()

interface DeepObjectChildrenExtension<D> {
  initData(): D
  addNode(node: any, data: D): void
}

/**
 * @internal
 */
export function registerDeepObjectChildrenExtension<D>(extension: DeepObjectChildrenExtension<D>) {
  const dataSymbol = Symbol("deepObjectChildrenExtension")
  extensions.set(dataSymbol, extension)

  return (data: DeepObjectChildren): D => {
    return data.extensionsData.get(dataSymbol) as D
  }
}

function initExtensionsData() {
  const extensionsData = new Map<Symbol, any>()

  extensions.forEach((extension, dataSymbol) => {
    extensionsData.set(dataSymbol, extension.initData())
  })

  return extensionsData
}

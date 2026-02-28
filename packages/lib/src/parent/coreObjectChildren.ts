import { action, createAtom, IAtom } from "mobx"
import { fastGetParent } from "./path"

interface DeepObjectChildren {
  deep: Set<object>

  extensionsData: Map<object, unknown>
}

interface ObjectChildrenData extends DeepObjectChildren {
  shallow: Set<object>
  shallowAtom: IAtom | undefined // will be created when first observed

  deepDirty: boolean
  deepAtom: IAtom | undefined // will be created when first observed
}

const objectChildren = new WeakMap<object, ObjectChildrenData>()

function getObjectChildrenObject(node: object) {
  let obj = objectChildren.get(node)

  if (!obj) {
    obj = {
      shallow: new Set(),
      shallowAtom: undefined, // will be created when first observed

      deep: new Set(),
      deepDirty: true,
      deepAtom: undefined, // will be created when first observed

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
  if (!obj.shallowAtom) {
    obj.shallowAtom = createAtom("shallowChildrenAtom")
  }
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

  if (!obj.deepAtom) {
    obj.deepAtom = createAtom("deepChildrenAtom")
  }
  obj.deepAtom.reportObserved()

  return obj
}

function addNodeToDeepLists(node: any, data: DeepObjectChildren) {
  data.deep.add(node)
  data.extensionsData.forEach((extensionData, dataSymbol) => {
    extensions.get(dataSymbol)!.addNode(node, extensionData)
  })
}

const updateDeepObjectChildren = action((node: object): DeepObjectChildren => {
  const obj = getObjectChildrenObject(node)
  if (!obj.deepDirty) {
    return obj
  }

  obj.deep = new Set()
  obj.extensionsData = initExtensionsData(obj.extensionsData)

  const childrenIterator = obj.shallow.values()
  let childrenIteratorResult = childrenIterator.next()
  while (!childrenIteratorResult.done) {
    addNodeToDeepLists(childrenIteratorResult.value, obj)

    const childDeepChildren = updateDeepObjectChildren(childrenIteratorResult.value).deep
    const childDeepChildrenIterator = childDeepChildren.values()
    let childDeepChildrenIteratorResult = childDeepChildrenIterator.next()
    while (!childDeepChildrenIteratorResult.done) {
      addNodeToDeepLists(childDeepChildrenIteratorResult.value, obj)
      childDeepChildrenIteratorResult = childDeepChildrenIterator.next()
    }

    childrenIteratorResult = childrenIterator.next()
  }

  obj.deepDirty = false
  obj.deepAtom?.reportChanged()

  return obj
})

/**
 * @internal
 */
export const addObjectChild = action((node: object, child: object) => {
  const obj = getObjectChildrenObject(node)
  obj.shallow.add(child)
  obj.shallowAtom?.reportChanged()

  invalidateDeepChildren(node, obj)
})

/**
 * @internal
 */
export const removeObjectChild = action((node: object, child: object) => {
  const obj = getObjectChildrenObject(node)
  obj.shallow.delete(child)
  obj.shallowAtom?.reportChanged()

  invalidateDeepChildren(node, obj)
})

function invalidateDeepChildren(node: object, obj: ObjectChildrenData) {
  let currentNode: object | undefined = node
  let currentObj = obj

  while (currentNode) {
    currentObj.deepDirty = true
    currentObj.deepAtom?.reportChanged()

    currentNode = fastGetParent(currentNode, false)
    if (currentNode) {
      currentObj = getObjectChildrenObject(currentNode)
    }
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
    let extensionData = data.extensionsData.get(dataSymbol) as D | undefined
    if (!data.extensionsData.has(dataSymbol)) {
      extensionData = extension.initData()
      data.extensionsData.set(dataSymbol, extensionData)
      data.deep.forEach((node) => {
        extension.addNode(node, extensionData!)
      })
    }
    return extensionData!
  }
}

function initExtensionsData(previousData?: ReadonlyMap<object, unknown>) {
  const extensionsData = new Map<object, unknown>()

  previousData?.forEach((_, dataSymbol) => {
    extensionsData.set(dataSymbol, extensions.get(dataSymbol)!.initData())
  })

  return extensionsData
}

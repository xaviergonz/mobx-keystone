import { action, createAtom, type IAtom } from "mobx"
import { addMutationBatchFinisher, isMutationBatchActive } from "../action/mutationBatch"
import { getOrCreateTreeNodeMetadata } from "../tweaker/treeNodeMetadata"
import { fastGetParent } from "./path"

interface DeepObjectChildren {
  deep: Set<object>

  extensionsData: Map<object, unknown> | undefined
}

/** @internal */
export interface ObjectChildrenData extends DeepObjectChildren {
  shallow: Set<object>
  shallowAtom: IAtom | undefined // will be created when first observed

  deepDirty: boolean
  deepAtom: IAtom | undefined // will be created when first observed
}

interface DeepChildrenInvalidationEntry {
  readonly obj: ObjectChildrenData
  rebuilt: boolean
}

interface DirectChildrenMutationEntry {
  added: Set<object> | undefined
  removed: Set<object> | undefined
  invalidatedNodes: Set<object> | undefined
}

interface DeepChildrenMutationTransaction {
  directMutations: Map<object, DirectChildrenMutationEntry> | undefined
  invalidatedNodes: Map<object, DeepChildrenInvalidationEntry> | undefined
}

let currentDeepChildrenMutationTransaction: DeepChildrenMutationTransaction | undefined

function getCurrentDeepChildrenMutationTransaction(): DeepChildrenMutationTransaction | undefined {
  return currentDeepChildrenMutationTransaction
}

function getOrCreateDeepChildrenMutationTransaction(): DeepChildrenMutationTransaction | undefined {
  if (!isMutationBatchActive()) {
    return undefined
  }

  const currentTransaction = currentDeepChildrenMutationTransaction
  if (currentTransaction) {
    return currentTransaction
  }

  const transaction: DeepChildrenMutationTransaction = {
    directMutations: undefined,
    invalidatedNodes: undefined,
  }
  currentDeepChildrenMutationTransaction = transaction
  addMutationBatchFinisher(() => {
    if (currentDeepChildrenMutationTransaction === transaction) {
      currentDeepChildrenMutationTransaction = undefined
      finishDeepChildrenMutationTransaction(transaction)
    }
  })
  return transaction
}

function getObjectChildrenObject(node: object) {
  const metadata = getOrCreateTreeNodeMetadata(node)
  let obj = metadata.objectChildren

  if (!obj) {
    obj = {
      shallow: new Set(),
      shallowAtom: undefined, // will be created when first observed

      deep: new Set(),
      deepDirty: true,
      deepAtom: undefined, // will be created when first observed

      extensionsData: initExtensionsData(),
    }
    metadata.objectChildren = obj
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
  data.extensionsData?.forEach((extensionData, dataSymbol) => {
    extensions.get(dataSymbol)!.addNode(node, extensionData)
  })
}

const updateDeepObjectChildren = action((node: object): DeepObjectChildren => {
  const obj = getObjectChildrenObject(node)
  if (!obj.deepDirty) {
    return obj
  }

  const transaction = getCurrentDeepChildrenMutationTransaction()
  if (transaction) {
    const invalidatedNodes = (transaction.invalidatedNodes ??= new Map())
    const invalidationEntry = invalidatedNodes.get(node)
    if (invalidationEntry) {
      invalidationEntry.rebuilt = true
    } else {
      // a node without an entry was dirty when first invalidated in this batch
      // (or was dirtied before it); record the rebuild so a later net-zero
      // completion cannot restore this mid-batch state as if the node had been
      // clean since the batch started
      invalidatedNodes.set(node, { obj, rebuilt: true })
    }
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
  const shallow = obj.shallow
  const previousShallowSize = shallow.size
  shallow.add(child)
  if (shallow.size === previousShallowSize) {
    return
  }

  onShallowChildrenChanged(node, obj, child, true)
})

/**
 * @internal
 */
export const removeObjectChild = action((node: object, child: object) => {
  const obj = getObjectChildrenObject(node)
  if (!obj.shallow.delete(child)) {
    return
  }

  onShallowChildrenChanged(node, obj, child, false)
})

function onShallowChildrenChanged(
  node: object,
  obj: ObjectChildrenData,
  child: object,
  added: boolean
) {
  obj.shallowAtom?.reportChanged()

  const transaction =
    currentDeepChildrenMutationTransaction ??
    (obj.deepDirty ? undefined : getOrCreateDeepChildrenMutationTransaction())
  invalidateDeepChildren(
    node,
    obj,
    transaction,
    recordDirectChildrenMutation(transaction, node, child, added)
  )
}

function recordDirectChildrenMutation(
  transaction: DeepChildrenMutationTransaction | undefined,
  node: object,
  child: object,
  added: boolean
): DirectChildrenMutationEntry | undefined {
  if (!transaction) {
    return undefined
  }

  const directMutations = (transaction.directMutations ??= new Map())
  let mutation = directMutations.get(node)
  if (!mutation) {
    mutation = {
      added: undefined,
      removed: undefined,
      invalidatedNodes: undefined,
    }
    directMutations.set(node, mutation)
  }

  if (added) {
    if (!mutation.removed?.delete(child)) {
      ;(mutation.added ??= new Set()).add(child)
    }
  } else if (!mutation.added?.delete(child)) {
    ;(mutation.removed ??= new Set()).add(child)
  }

  return mutation
}

function invalidateDeepChildren(
  node: object,
  obj: ObjectChildrenData,
  transaction: DeepChildrenMutationTransaction | undefined,
  mutation: DirectChildrenMutationEntry | undefined
) {
  let currentNode: object | undefined = node
  let currentObj = obj

  while (currentNode) {
    if (transaction) {
      let entry = transaction.invalidatedNodes?.get(currentNode)
      if (!entry && !currentObj.deepDirty) {
        const invalidatedNodes = (transaction.invalidatedNodes ??= new Map())
        entry = {
          obj: currentObj,
          rebuilt: false,
        }
        invalidatedNodes.set(currentNode, entry)
      }
      if (mutation && entry) {
        ;(mutation.invalidatedNodes ??= new Set()).add(currentNode)
      }
    }

    currentObj.deepDirty = true
    currentObj.deepAtom?.reportChanged()

    currentNode = fastGetParent(currentNode, false)
    if (currentNode) {
      currentObj = getObjectChildrenObject(currentNode)
    }
  }
}

function finishDeepChildrenMutationTransaction(transaction: DeepChildrenMutationTransaction) {
  const invalidatedNodes = transaction.invalidatedNodes
  if (!invalidatedNodes) {
    return
  }

  // when every mutated parent has net membership changes every invalidated
  // node must stay dirty, so there is nothing to restore
  let hasNetZeroMutation = false
  transaction.directMutations?.forEach((mutation) => {
    if ((mutation.added?.size ?? 0) === 0 && (mutation.removed?.size ?? 0) === 0) {
      hasNetZeroMutation = true
    }
  })
  if (!hasNetZeroMutation) {
    return
  }

  let genuinelyChangedNodes: Set<object> | undefined
  transaction.directMutations?.forEach((mutation, node) => {
    if ((mutation.added?.size ?? 0) > 0 || (mutation.removed?.size ?? 0) > 0) {
      const changedNodes = (genuinelyChangedNodes ??= new Set())
      mutation.invalidatedNodes?.forEach((invalidatedNode) => {
        changedNodes.add(invalidatedNode)
      })

      // a genuine membership change also dirties the node's ancestor chain as
      // it stands now, which may differ from the chains recorded at mutation
      // time (e.g. a subtree mutated while detached and then re-attached with
      // a net-zero remove/add pair at its parent)
      let currentNode: object | undefined = node
      while (currentNode) {
        changedNodes.add(currentNode)
        currentNode = fastGetParent(currentNode, false)
      }
    }
  })

  invalidatedNodes.forEach((entry, node) => {
    if (!genuinelyChangedNodes?.has(node) && !entry.rebuilt) {
      entry.obj.deepDirty = false
    }
  })
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
    let extensionsData = data.extensionsData
    let extensionData = extensionsData?.get(dataSymbol) as D | undefined
    if (!extensionsData?.has(dataSymbol)) {
      extensionsData = data.extensionsData ??= new Map()
      extensionData = extension.initData()
      extensionsData.set(dataSymbol, extensionData)
      data.deep.forEach((node) => {
        extension.addNode(node, extensionData!)
      })
    }
    return extensionData!
  }
}

function initExtensionsData(previousData?: ReadonlyMap<object, unknown>) {
  if (previousData === undefined || previousData.size === 0) {
    return undefined
  }

  const extensionsData = new Map<object, unknown>()

  previousData?.forEach((_, dataSymbol) => {
    extensionsData.set(dataSymbol, extensions.get(dataSymbol)!.initData())
  })

  return extensionsData
}

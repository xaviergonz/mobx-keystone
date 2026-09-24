import { action, createAtom, type IAtom, untracked } from "mobx"
import { addMutationBatchFinisher, isMutationBatchActive } from "../action/mutationBatch"
import { getOrCreateTreeNodeMetadata, treeNodeMetadata } from "../tweaker/treeNodeMetadata"
import { fastGetParent } from "./path"

interface DeepObjectChildren {
  deep: Set<object>
}

/** @internal */
export interface ObjectChildrenData extends DeepObjectChildren {
  shallow: Set<object>
  shallowAtom: IAtom | undefined // will be created when first observed

  deepDirty: boolean
  deepAtom: IAtom | undefined // will be created when first observed

  extensions: Map<DeepObjectChildrenExtension<any>, ExtensionState<any>> | undefined

  listeners: Set<ObjectChildrenListener> | undefined
}

/**
 * Told about the nodes that may have been attached to or detached from the
 * children of a node: its direct children, or all of its descendants when
 * `deep`. Called inside the action making the change.
 *
 * @internal
 */
export interface ObjectChildrenListener {
  readonly deep: boolean
  onChildrenChanged(nodes: readonly object[]): void
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

// shared by all nodes whose deep children were never built (it is never mutated,
// but replaced when they are built), so each node does not allocate an empty set
const unbuiltDeepChildren = new Set<object>()

function getObjectChildrenObject(node: object) {
  const metadata = getOrCreateTreeNodeMetadata(node)
  let obj = metadata.objectChildren

  if (!obj) {
    obj = {
      shallow: new Set(),
      shallowAtom: undefined, // will be created when first observed

      deep: unbuiltDeepChildren,
      deepDirty: true,
      deepAtom: undefined, // will be created when first observed

      extensions: undefined,

      listeners: undefined,
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
 * Like `getObjectChildren(node).size > 0`, but without observing or allocating anything.
 * @internal
 */
export function hasObjectChildren(node: object): boolean {
  return (treeNodeMetadata.get(node)?.objectChildren?.shallow.size ?? 0) > 0
}

/**
 * @internal
 */
export function getDeepObjectChildren(node: object): DeepObjectChildren {
  const obj = getObjectChildrenObject(node)

  if (obj.deepDirty) {
    updateDeepObjectChildren(node)
  }

  reportDeepObserved(obj)

  return obj
}

function reportDeepObserved(obj: ObjectChildrenData) {
  if (!obj.deepAtom) {
    obj.deepAtom = createAtom("deepChildrenAtom")
  }
  obj.deepAtom.reportObserved()
}

const updateDeepObjectChildren = action((node: object): DeepObjectChildren => {
  return updateDeepObjectChildrenRecursive(node)
})

function updateDeepObjectChildrenRecursive(node: object): DeepObjectChildren {
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

  const deep = new Set<object>()
  obj.deep = deep

  const childrenIterator = obj.shallow.values()
  let childrenIteratorResult = childrenIterator.next()
  while (!childrenIteratorResult.done) {
    deep.add(childrenIteratorResult.value)

    const childDeepChildren = updateDeepObjectChildrenRecursive(childrenIteratorResult.value).deep
    const childDeepChildrenIterator = childDeepChildren.values()
    let childDeepChildrenIteratorResult = childDeepChildrenIterator.next()
    while (!childDeepChildrenIteratorResult.done) {
      deep.add(childDeepChildrenIteratorResult.value)
      childDeepChildrenIteratorResult = childDeepChildrenIterator.next()
    }

    childrenIteratorResult = childrenIterator.next()
  }

  obj.deepDirty = false
  obj.deepAtom?.reportChanged()

  return obj
}

let lastAttachOrder = 0

/**
 * Must run inside the action-wrapped `setParent`, its only source caller.
 *
 * @internal
 */
export function addObjectChild(node: object, child: object): void {
  const obj = getObjectChildrenObject(node)
  const shallow = obj.shallow
  const previousShallowSize = shallow.size
  shallow.add(child)
  if (shallow.size === previousShallowSize) {
    return
  }
  getOrCreateTreeNodeMetadata(child).attachOrder = ++lastAttachOrder

  onShallowChildrenChanged(node, obj, child, true)
}

/**
 * Must run inside the action-wrapped `setParent`, its only source caller.
 *
 * @internal
 */
export function removeObjectChild(node: object, child: object): void {
  const obj = getObjectChildrenObject(node)
  if (!obj.shallow.delete(child)) {
    return
  }

  onShallowChildrenChanged(node, obj, child, false)
}

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
    recordDirectChildrenMutation(transaction, node, child, added),
    child,
    added
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
  mutation: DirectChildrenMutationEntry | undefined,
  child: object,
  added: boolean
) {
  let currentNode: object | undefined = node
  let currentObj = obj
  let extensionChange: ExtensionChange | undefined
  let subtree: readonly object[] | undefined

  while (currentNode) {
    if (currentObj.extensions) {
      extensionChange ??= new ExtensionChange(
        () => (subtree ??= collectSubtree(child)),
        added,
        false
      )
      extensionChange.applyTo(currentObj.extensions)
    }

    if (currentObj.listeners) {
      for (const listener of currentObj.listeners) {
        if (listener.deep) {
          listener.onChildrenChanged((subtree ??= collectSubtree(child)))
        } else if (currentNode === node) {
          listener.onChildrenChanged([child])
        }
      }
    }

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

/**
 * Derived data kept per node about its deep children (e.g. an index of them).
 * It is built from the deep children the first time it is needed and then kept
 * up to date as descendants are attached and detached.
 *
 * @internal
 */
export interface DeepObjectChildrenExtension<D> {
  initData(): D
  /** Adds a node while building the data from scratch, in deep children order. */
  addNode(node: object, data: D): void
  /**
   * Adds a node attached after the data was built. Returns false when the data
   * must be rebuilt instead. Defaults to `addNode`.
   */
  addNodeIncrementally?(node: object, data: D): boolean
  /** Removes a detached node. Returns false when the data must be rebuilt instead. */
  removeNode(node: object, data: D): boolean
  /** Whether the data must be updated when a descendant model's id changes. */
  dependsOnModelIds?: boolean
}

interface PendingExtensionChange {
  readonly nodes: readonly object[]
  readonly added: boolean
}

interface ExtensionState<D> {
  readonly data: D
  /** Data that could not be updated and must be rebuilt. */
  dirty: boolean
  /** Readers that need the data frozen; changes are queued meanwhile. */
  pins: number
  pending: PendingExtensionChange[] | undefined
}

/**
 * Data of an extension frozen until released; changes made meanwhile are
 * applied on release.
 *
 * @internal
 */
export interface PinnedDeepObjectChildrenExtensionData<D> {
  readonly data: D
  release(): void
}

/**
 * @internal
 */
export interface DeepObjectChildrenExtensionAccessor<D> {
  /**
   * Gets the data. By default any change of the deep children is observed as a
   * change of the data; pass `observeDeepChildren` false when the extension
   * reports its own finer-grained changes.
   */
  get(node: object, observeDeepChildren?: boolean): D
  pin(node: object): PinnedDeepObjectChildrenExtensionData<D>
}

/**
 * @internal
 */
export function registerDeepObjectChildrenExtension<D>(
  extension: DeepObjectChildrenExtension<D>
): DeepObjectChildrenExtensionAccessor<D> {
  const getState = (node: object, observeDeepChildren: boolean): ExtensionState<D> => {
    const obj = getObjectChildrenObject(node)
    let state = obj.extensions?.get(extension) as ExtensionState<D> | undefined
    // changes queued while pinned make the data stale for anybody else
    if (!state || state.dirty || state.pending) {
      // building reads the nodes, which must not become dependencies
      state = untracked(() => buildExtensionState(extension, node))
    }
    if (observeDeepChildren) {
      reportDeepObserved(obj)
    }
    return state
  }

  return {
    get(node, observeDeepChildren = true) {
      return getState(node, observeDeepChildren).data
    },

    pin(node) {
      const state = getState(node, false)
      state.pins++
      let released = false
      return {
        data: state.data,
        release() {
          if (released) return
          released = true
          state.pins--
          if (state.pins === 0 && state.pending) {
            const pending = state.pending
            state.pending = undefined
            for (const change of pending) {
              applyExtensionChange(extension, state, change.nodes, change.added)
            }
          }
        },
      }
    },
  }
}

function buildExtensionState<D>(
  extension: DeepObjectChildrenExtension<D>,
  node: object
): ExtensionState<D> {
  const data = extension.initData()
  getDeepObjectChildren(node).deep.forEach((n) => {
    extension.addNode(n, data)
  })

  const state: ExtensionState<D> = {
    data,
    dirty: false,
    pins: 0,
    pending: undefined,
  }
  const obj = getObjectChildrenObject(node)
  ;(obj.extensions ??= new Map()).set(extension, state)
  return state
}

function applyExtensionChange(
  extension: DeepObjectChildrenExtension<any>,
  state: ExtensionState<any>,
  nodes: readonly object[],
  added: boolean
) {
  if (state.dirty) {
    return
  }
  for (const n of nodes) {
    let ok: boolean
    if (!added) {
      ok = extension.removeNode(n, state.data)
    } else if (extension.addNodeIncrementally) {
      ok = extension.addNodeIncrementally(n, state.data)
    } else {
      extension.addNode(n, state.data)
      ok = true
    }
    if (!ok) {
      state.dirty = true
      return
    }
  }
}

/**
 * A membership change of some deep children, applied to the extension data of
 * each ancestor of the changed parent.
 */
class ExtensionChange {
  private nodes: readonly object[] | undefined
  private readonly getNodes: () => readonly object[]
  private readonly added: boolean
  private readonly onlyModelIdDependent: boolean

  constructor(getNodes: () => readonly object[], added: boolean, onlyModelIdDependent: boolean) {
    this.getNodes = getNodes
    this.added = added
    this.onlyModelIdDependent = onlyModelIdDependent
  }

  applyTo(extensions: NonNullable<ObjectChildrenData["extensions"]>) {
    extensions.forEach((state, extension) => {
      if (state.dirty || (this.onlyModelIdDependent && !extension.dependsOnModelIds)) {
        return
      }
      this.nodes ??= this.getNodes()
      if (state.pins > 0) {
        ;(state.pending ??= []).push({ nodes: this.nodes, added: this.added })
      } else {
        applyExtensionChange(extension, state, this.nodes, this.added)
      }
    })
  }
}

/** The node and its descendants, parents first. */
function collectSubtree(root: object): object[] {
  const nodes: object[] = []
  const stack = [root]
  while (stack.length > 0) {
    const node = stack.pop()!
    nodes.push(node)
    const shallow = treeNodeMetadata.get(node)?.objectChildren?.shallow
    shallow?.forEach((child) => {
      stack.push(child)
    })
  }
  return nodes
}

/**
 * @internal
 */
export function addObjectChildrenListener(node: object, listener: ObjectChildrenListener): void {
  ;(getObjectChildrenObject(node).listeners ??= new Set()).add(listener)
}

/**
 * @internal
 */
export function removeObjectChildrenListener(node: object, listener: ObjectChildrenListener): void {
  const obj = treeNodeMetadata.get(node)?.objectChildren
  if (obj?.listeners?.delete(listener) && obj.listeners.size === 0) {
    obj.listeners = undefined
  }
}

/**
 * Must be called after the id of a model changes.
 *
 * @internal
 */
export function onModelIdChanged(model: object): void {
  const parent = fastGetParent(model, false)
  if (!parent) {
    return
  }
  // re-index the model under its new id
  const nodes = [model]
  const removal = new ExtensionChange(() => nodes, false, true)
  const addition = new ExtensionChange(() => nodes, true, true)
  let currentNode: object | undefined = parent
  while (currentNode) {
    const extensions = treeNodeMetadata.get(currentNode)?.objectChildren?.extensions
    if (extensions) {
      removal.applyTo(extensions)
      addition.applyTo(extensions)
    }
    currentNode = fastGetParent(currentNode, false)
  }
}

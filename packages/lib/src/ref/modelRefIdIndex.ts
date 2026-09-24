import { createAtom, type IAtom } from "mobx"
import { type AnyModel, BaseModel } from "../model/BaseModel"
import { modelIdKey } from "../model/metadata"
import { registerDeepObjectChildrenExtension } from "../parent/coreObjectChildren"
import { NodesById } from "./nodesById"

interface ModelRefIdIndex {
  readonly byId: NodesById<AnyModel>
  /** Id each model is indexed under, since ids can change later. */
  readonly indexedIds: Map<AnyModel, string>
  /** Models with a custom `getRefId`, which cannot be indexed. */
  customRefIdModels: number
  /** Changed when models with a custom `getRefId` appear or disappear. */
  readonly customRefIdAtom: IAtom
  /** Changed when the models with a given id change. Only kept while observed. */
  readonly idAtoms: Map<string, IAtom>
}

function hasCustomRefId(model: AnyModel) {
  return model.getRefId !== BaseModel.prototype.getRefId
}

function reportIdChanged(index: ModelRefIdIndex, id: string) {
  index.idAtoms.get(id)?.reportChanged()
}

const modelRefIdIndex = registerDeepObjectChildrenExtension<ModelRefIdIndex>({
  initData() {
    return {
      byId: new NodesById(),
      indexedIds: new Map(),
      customRefIdModels: 0,
      customRefIdAtom: createAtom("customRefIdModels"),
      idAtoms: new Map(),
    }
  },

  addNode(node, index) {
    if (!(node instanceof BaseModel)) {
      return
    }
    if (hasCustomRefId(node)) {
      index.customRefIdModels++
      if (index.customRefIdModels === 1) {
        index.customRefIdAtom.reportChanged()
      }
      return
    }

    const id = node[modelIdKey]
    if (id === undefined) {
      return
    }
    index.byId.add(id, node)
    index.indexedIds.set(node, id)
    reportIdChanged(index, id)
  },

  removeNode(node, index) {
    if (!(node instanceof BaseModel)) {
      return true
    }
    if (hasCustomRefId(node)) {
      index.customRefIdModels--
      if (index.customRefIdModels === 0) {
        index.customRefIdAtom.reportChanged()
      }
      return true
    }

    const id = index.indexedIds.get(node)
    if (id === undefined) {
      return true
    }
    index.indexedIds.delete(node)
    index.byId.delete(id, node)
    reportIdChanged(index, id)
    return true
  },

  dependsOnModelIds: true,
})

function observeId(index: ModelRefIdIndex, id: string) {
  const existing = index.idAtoms.get(id)
  if (existing) {
    existing.reportObserved()
    return
  }
  const atom = createAtom("modelRefId", undefined, () => {
    if (index.idAtoms.get(id) === atom) {
      index.idAtoms.delete(id)
    }
  })
  // only keep atoms something observes, since nothing else would remove them
  if (atom.reportObserved()) {
    index.idAtoms.set(id, atom)
  }
}

/**
 * Result of `resolveModelRefId` when the tree has models with a custom
 * `getRefId`, which it cannot index.
 *
 * @internal
 */
export const modelRefIdNotIndexed = Symbol("modelRefIdNotIndexed")

/**
 * Resolves a model below the root (excluding it) by its default reference id
 * (`getModelRefId`), reactively, in O(1), or O(models × depth) when several
 * models have that id.
 * Returns `modelRefIdNotIndexed` when the tree has models with a custom
 * `getRefId`.
 *
 * @internal
 */
export function resolveModelRefId(
  root: object,
  id: string
): object | undefined | typeof modelRefIdNotIndexed {
  const index = modelRefIdIndex.get(root, false)

  index.customRefIdAtom.reportObserved()
  if (index.customRefIdModels > 0) {
    return modelRefIdNotIndexed
  }

  observeId(index, id)
  return index.byId.resolve(root, id)
}

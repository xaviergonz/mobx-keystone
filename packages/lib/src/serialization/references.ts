import { rootPathToTargetPathIds } from "../actionMiddlewares/utils"
import type { AnyModel } from "../model/BaseModel"
import { getModelMetadata } from "../model/getModelMetadata"
import { modelTypeKey } from "../model/metadata"
import { isModel } from "../model/utils"
import {
  fastGetRoot,
  fastGetRootPath,
  isPathElement,
  resolvePathCheckingIds,
  skipIdChecking,
} from "../parent/path"
import type { Path, PathElement } from "../parent/pathTypes"
import { getModelRefId, resolveId } from "../ref/core"
import { isTreeNode } from "../tweaker/core"
import { isArray, isPlainObject } from "../utils"
import { badPayloadError, CallError, CallErrorCode } from "./CallError"
import type { ValueSerializer } from "./ValueSerializer"

/**
 * What a reference serializer's `when` option is told about a node.
 */
export interface ReferenceNodeInfo {
  /**
   * Whether the node is a model.
   */
  readonly isModel: boolean
  /**
   * Whether the node is a value-type model (`Model({...}, { valueType: true })`).
   */
  readonly isValueType: boolean
}

/**
 * Options of the built-in reference serializers.
 */
export interface ReferenceSerializerOptions {
  /**
   * Decides, for every node the serializer could reference, whether it does. A node it declines
   * falls through the list like any other value: a model ends up as its snapshot, a tree array
   * or plain object is walked. The call's target ignores it: it is always a reference.
   *
   * Defaults to declining value-type models: `(node, { isValueType }) => !isValueType`.
   */
  when?(node: object, info: ReferenceNodeInfo): boolean
}

/**
 * A path reference, the payload of `{ "$mobxKeystone": "pathRef", "v": ... }`.
 */
export type PathRefJson = {
  /**
   * Path from the root to the node, through data nodes (as in patches).
   */
  path: PathElement[]
  /**
   * Id of the model reached by each step of the path (`null` for non-models).
   * Optional when decoding: without it, ids aren't checked.
   */
  ids?: (string | null)[]
}

/**
 * An id reference, the payload of `{ "$mobxKeystone": "idRef", "v": ... }`.
 */
export type IdRefJson = {
  /**
   * The model type (`$modelType`).
   */
  type: string
  /**
   * The model id.
   */
  id: string
}

const defaultWhen = (_node: object, info: ReferenceNodeInfo) => !info.isValueType

function getNodeInfo(node: object): ReferenceNodeInfo {
  const nodeIsModel = isModel(node)
  return {
    isModel: nodeIsModel,
    isValueType: nodeIsModel && getModelMetadata(node).valueType,
  }
}

/**
 * @internal
 */
export function isNodeOfTree(value: unknown, root: object): value is object {
  return isTreeNode(value) && fastGetRoot(value, false) === root
}

/**
 * @internal
 */
export const pathRefTag = "pathRef"

/**
 * @internal
 *
 * Encodes a node of the tree as a full path reference.
 */
export function encodePathRef(node: object): PathRefJson {
  const rootPath = fastGetRootPath(node, false)
  return {
    path: [...rootPath.path],
    ids: rootPathToTargetPathIds(rootPath),
  }
}

/**
 * @internal
 *
 * Decodes a path reference against a tree.
 */
export function decodePathRef(json: unknown, root: object): object {
  if (!isPlainObject(json) || !isArray(json.path) || !json.path.every(isPathElement)) {
    throw badPayloadError(pathRefTag, json)
  }
  const path = json.path as Path
  const ids = json.ids
  if (
    ids !== undefined &&
    (!isArray(ids) ||
      ids.length !== path.length ||
      !ids.every((id) => id === null || typeof id === "string"))
  ) {
    throw badPayloadError(pathRefTag, json)
  }

  const result = resolvePathCheckingIds(
    root,
    path,
    (ids as (string | null)[] | undefined) ?? path.map(() => skipIdChecking)
  )
  // only tree nodes can be referenced, so anything else is not a valid reference
  if (!result.resolved || !isTreeNode(result.value)) {
    throw new CallError({
      code: CallErrorCode.NotFound,
      message: `object at path ${JSON.stringify(path)}${
        ids === undefined ? "" : ` with ids ${JSON.stringify(ids)}`
      } could not be resolved`,
    })
  }
  return result.value
}

/**
 * References nodes of the tree by their path from the root, checking the ids of the models along
 * it: `{ "$mobxKeystone": "pathRef", "v": { "path": ["cards", 2], "ids": [null, "c1"] } }`.
 * It reaches any node, including tree arrays and plain objects.
 *
 * @param options Options.
 * @returns The reference serializer.
 */
export function pathRefs(
  options?: ReferenceSerializerOptions
): ValueSerializer<object, PathRefJson> {
  const when = options?.when ?? defaultWhen

  return {
    tag: pathRefTag,

    is(value, ctx): value is object {
      return isNodeOfTree(value, ctx.root) && when(value, getNodeInfo(value))
    },

    encode: encodePathRef,

    decode(json, ctx) {
      return decodePathRef(json, ctx.root)
    },

    claimsTarget(value, ctx) {
      return isNodeOfTree(value, ctx.root)
    },
  }
}

function claimsById(value: unknown, root: object): value is AnyModel {
  return isModel(value) && getModelRefId(value) !== undefined && isNodeOfTree(value, root)
}

/**
 * References models of the tree that have an id by their type and id:
 * `{ "$mobxKeystone": "idRef", "v": { "type": "app/Card", "id": "c1" } }`. Ids are read and
 * resolved as `getModelRefId` and `resolveId` do, and the type must match.
 *
 * @param options Options.
 * @returns The reference serializer.
 */
export function idRefs(options?: ReferenceSerializerOptions): ValueSerializer<AnyModel, IdRefJson> {
  const when = options?.when ?? defaultWhen

  return {
    tag: "idRef",

    is(value, ctx): value is AnyModel {
      return claimsById(value, ctx.root) && when(value, getNodeInfo(value))
    },

    encode(value) {
      return { type: value[modelTypeKey], id: getModelRefId(value)! }
    },

    decode(json, ctx) {
      if (!isPlainObject(json) || typeof json.type !== "string" || typeof json.id !== "string") {
        throw badPayloadError("idRef", json)
      }
      const found = resolveId(ctx.root, json.id)
      if (!isModel(found) || found[modelTypeKey] !== json.type) {
        throw new CallError({
          code: CallErrorCode.NotFound,
          message: `model of type '${json.type}' with id '${json.id}' could not be resolved`,
        })
      }
      return found
    },

    claimsTarget(value, ctx) {
      return claimsById(value, ctx.root)
    },
  }
}

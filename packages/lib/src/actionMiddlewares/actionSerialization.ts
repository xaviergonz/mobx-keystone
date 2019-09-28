import { isObservable, toJS } from "mobx"
import { ActionCall } from "../action/applyAction"
import { isModelSnapshot } from "../model/utils"
import { fastGetRootPath, resolvePathCheckingIds } from "../parent/path"
import { fromSnapshot } from "../snapshot/fromSnapshot"
import { getSnapshot } from "../snapshot/getSnapshot"
import { assertTweakedObject, isTweakedObject } from "../tweaker/core"
import { failure, isPlainObject, isPrimitive } from "../utils"
import { rootPathToTargetPathIds } from "./utils"

const serializedDate = "dateAsTimestamp"
export interface SerializedDate {
  $mobxKeystoneSerialized: typeof serializedDate
  timestamp: number
}

const serializedMap = "mapAsArray"
export interface SerializedMap {
  $mobxKeystoneSerialized: typeof serializedMap
  items: [any, any][]
}

const serializedSet = "setAsArray"
export interface SerializedSet {
  $mobxKeystoneSerialized: typeof serializedSet
  items: any[]
}

const serializedPathRef = "pathRef"
export interface SerializedPathRef {
  $mobxKeystoneSerialized: typeof serializedPathRef
  targetPath: ReadonlyArray<string | number>
  targetPathIds: ReadonlyArray<string | null>
}

/**
 * Transforms an action call argument by returning its serializable equivalent.
 * In more detail, this will transform:
 * - Primitives as is.
 * - Nodes that are under the same root node as the target root (when provided) will be seralized
 *   as a `SerializedPathRef`
 * - Nodes that are not under the same root node as the target root will be serialized as their snapshot.
 * - Observable values as their non observable equivalent.
 * - Dates as a `SerializedDate`.
 * - Maps as a `SerializedMap`
 * - Sets as a `SerializedSet`
 *
 * If the value cannot be serialized it will throw an exception.
 *
 * @param argValue Argument value to be transformed into its serializable form.
 * @param [targetRoot] Target root node of the model where this action is being performed.
 * @returns The serializable form of the passed value.
 */
export function serializeActionCallArgument(argValue: any, targetRoot?: object): any {
  if (isPrimitive(argValue)) {
    return argValue
  }

  if (isTweakedObject(argValue, false)) {
    // try to serialize a ref to its path if possible instead
    const rootPath = fastGetRootPath(argValue)
    if (rootPath.root === targetRoot) {
      const serPathRef: SerializedPathRef = {
        $mobxKeystoneSerialized: serializedPathRef,
        targetPath: rootPath.path,
        targetPathIds: rootPathToTargetPathIds(rootPath),
      }
      return serPathRef
    }

    return getSnapshot(argValue)
  }

  const origValue = argValue

  if (argValue instanceof Date) {
    const serDate: SerializedDate = {
      $mobxKeystoneSerialized: serializedDate,
      timestamp: +argValue,
    }
    return serDate
  }

  if (isObservable(argValue)) {
    argValue = toJS(argValue, { exportMapsAsObjects: false, detectCycles: false })
  }

  const serialize = (v: any) => serializeActionCallArgument(v, targetRoot)

  if (Array.isArray(argValue)) {
    return argValue.map(serialize)
  }

  if (argValue instanceof Map) {
    const serMap: SerializedMap = {
      $mobxKeystoneSerialized: serializedMap,
      items: [],
    }
    const arr = serMap.items

    const iter = argValue.keys()
    let cur = iter.next()
    while (!cur.done) {
      const k = cur.value
      const v = argValue.get(k)
      arr.push([serialize(k), serialize(v)])
      cur = iter.next()
    }

    return serMap
  }

  if (argValue instanceof Set) {
    const serSet: SerializedSet = {
      $mobxKeystoneSerialized: serializedSet,
      items: [],
    }
    const arr = serSet.items

    const iter = argValue.keys()
    let cur = iter.next()
    while (!cur.done) {
      const k = cur.value
      arr.push(serialize(k))
      cur = iter.next()
    }

    return serSet
  }

  if (isPlainObject(argValue)) {
    return mapObjectFields(argValue, serialize)
  }

  throw failure(`serializeActionCallArgument could not serialize the given value: ${origValue}`)
}

/**
 * Ensures that an action call is serializable by mapping the action arguments into its
 * serializable version by using `serializeActionCallArgument`.
 *
 * @param actionCall Action call to convert.
 * @param [targetRoot] Target root node of the model where this action is being performed.
 * @returns The serializable action call.
 */
export function serializeActionCall(actionCall: ActionCall, targetRoot?: object): ActionCall {
  if (targetRoot !== undefined) {
    assertTweakedObject(targetRoot, "targetRoot")
  }

  const serialize = (v: any) => serializeActionCallArgument(v, targetRoot)

  return {
    ...actionCall,
    args: actionCall.args.map(serialize),
  }
}

/**
 * Transforms an action call argument by returning its deserialized equivalent.
 * In more detail, this will transform:
 * - A `SerializedPathRef` will be resolved back to the original node if possible, throwing if not.
 * - The snapshot of models/tree nodes back into models/tree nodes.
 * - `SerializedDate` back to `Date` objects.
 * - `SerializedMap` back to `Map` objects.
 * - `SerializedSet` back to `Set` objects.
 * - Everything else will be kept as is.
 *
 * @param argValue Argument value to be transformed into its deserialized form.
 * @param [targetRoot] Target root node of the model where this action is being performed.
 * @returns The deserialized form of the passed value.
 */
export function deserializeActionCallArgument(argValue: any, targetRoot?: object): any {
  if (isPrimitive(argValue)) {
    return argValue
  }

  if (isModelSnapshot(argValue)) {
    return fromSnapshot(argValue)
  }

  const deserialize = (v: any) => deserializeActionCallArgument(v, targetRoot)

  if (Array.isArray(argValue)) {
    return argValue.map(deserialize)
  }

  if (isPlainObject(argValue)) {
    if (typeof argValue === "object" && typeof argValue.$mobxKeystoneSerialized === "string") {
      const serialized:
        | SerializedDate
        | SerializedMap
        | SerializedSet
        | SerializedPathRef = argValue

      switch (serialized.$mobxKeystoneSerialized) {
        case serializedDate:
          return new Date(serialized.timestamp)

        case serializedMap: {
          const arr = serialized.items
          const map = new Map()

          const len = arr.length
          for (let i = 0; i < len; i++) {
            const k = arr[i][0]
            const v = arr[i][1]
            map.set(deserialize(k), deserialize(v))
          }

          return map
        }

        case serializedSet: {
          const arr = serialized.items
          const set = new Set()

          const len = arr.length
          for (let i = 0; i < len; i++) {
            const k = arr[i]
            set.add(deserialize(k))
          }

          return set
        }

        case serializedPathRef: {
          // try to resolve the node back
          if (targetRoot) {
            const result = resolvePathCheckingIds(
              targetRoot,
              serialized.targetPath,
              serialized.targetPathIds
            )
            if (result.resolved) {
              return result.value
            }
          }

          throw failure(
            `object at path ${JSON.stringify(serialized.targetPath)} with ids ${JSON.stringify(
              serialized.targetPathIds
            )} could not be resolved`
          )
        }

        default:
          throw failure(`unknown serialized type: ${(serialized as any).$mobxKeystoneSerialized}`)
      }
    }

    return mapObjectFields(argValue, deserialize)
  }

  return argValue
}

/**
 * Ensures that an action call is deserialized by mapping the action arguments into its
 * deserialized version by using `deserializeActionCallArgument`.
 *
 * @param actionCall Action call to convert.
 * @param [targetRoot] Target root node of the model where this action is being performed.
 * @returns The deserialized action call.
 */
export function deserializeActionCall(actionCall: ActionCall, targetRoot?: object): ActionCall {
  if (targetRoot !== undefined) {
    assertTweakedObject(targetRoot, "targetRoot")
  }

  const deserialize = (v: any) => deserializeActionCallArgument(v, targetRoot)
  return {
    ...actionCall,
    args: actionCall.args.map(deserialize),
  }
}

function mapObjectFields(originalObj: any, mapFn: (x: any) => any): any {
  const obj: any = {}
  const keys = Object.keys(originalObj)
  const len = keys.length
  for (let i = 0; i < len; i++) {
    const k = keys[i]
    const v = originalObj[k]
    obj[k] = mapFn(v)
  }
  return obj
}

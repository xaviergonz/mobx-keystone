import { assertTweakedObject, isTweakedObject } from "../tweaker/core"
import { toTreeNode } from "../tweaker/tweak"
import { resolveTypeChecker } from "../types/resolveTypeChecker"
import type { AnyType, TypeToData, TypeToSnapshotOut } from "../types/schemas"
import { resolveCodecSupport } from "../types/utility/typesCodec"
import { failure, identityFn, isPrimitive } from "../utils"
import {
  flushInternalSnapshot,
  freezeInternalSnapshot,
  getInternalSnapshot,
  reportInternalSnapshotObserved,
} from "./internal"
import type { SnapshotOutOf } from "./SnapshotOf"

/**
 * Retrieves an immutable snapshot for a data structure.
 * Since returned snapshots are immutable they will respect shallow equality, this is,
 * if no changes are made then the snapshot will be kept the same.
 *
 * @template T Object type.
 * @param nodeOrPrimitive Data structure, including primtives.
 * @returns The snapshot.
 */
export function getSnapshot<T extends AnyType>(
  type: T,
  nodeOrPrimitive: TypeToData<T>
): TypeToSnapshotOut<T>

/**
 * Retrieves an immutable snapshot for a data structure.
 * Since returned snapshots are immutable they will respect shallow equality, this is,
 * if no changes are made then the snapshot will be kept the same.
 *
 * @template T Object type.
 * @param nodeOrPrimitive Data structure, including primtives.
 * @returns The snapshot.
 */
export function getSnapshot<T>(nodeOrPrimitive: T): SnapshotOutOf<T>

export function getSnapshot(...args: [arg1: any] | [arg1: any, arg2: any]): any {
  const [arg1, arg2] = args
  let toSnapshotProcessor: (sn: unknown) => unknown = identityFn
  let nodeOrPrimitive: any

  if (args.length >= 2) {
    const codecSupport = resolveCodecSupport(arg1)
    if (codecSupport.hasCodec) {
      const storedTypeChecker = resolveTypeChecker(codecSupport.storedType)
      const storedValue = codecSupport.adapter.toStored(arg2)

      if (isPrimitive(storedValue)) {
        const processor = storedTypeChecker.getToSnapshotProcessor()
        return processor ? processor(storedValue) : storedValue
      }

      const storedTree = isTweakedObject(storedValue, true)
        ? storedValue
        : toTreeNode(codecSupport.storedType, storedValue)
      const storedSnapshot = getSnapshot(storedTree)
      const processor = storedTypeChecker.getToSnapshotProcessor()
      return processor ? processor(storedSnapshot) : storedSnapshot
    }

    toSnapshotProcessor = resolveTypeChecker(arg1).getToSnapshotProcessor() ?? identityFn
    nodeOrPrimitive = arg2
  } else {
    nodeOrPrimitive = arg1
  }

  if (isPrimitive(nodeOrPrimitive)) {
    return toSnapshotProcessor(nodeOrPrimitive)
  }

  assertTweakedObject(nodeOrPrimitive, "nodeOrPrimitive")

  const snapshot = getInternalSnapshot(nodeOrPrimitive)
  if (!snapshot) {
    throw failure("getSnapshot is not supported for this kind of object")
  }

  flushInternalSnapshot(nodeOrPrimitive, true)
  freezeInternalSnapshot(snapshot.transformed)
  reportInternalSnapshotObserved(snapshot)
  return toSnapshotProcessor(snapshot.transformed)
}

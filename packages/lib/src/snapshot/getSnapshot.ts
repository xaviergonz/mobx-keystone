import { assertTweakedObject } from "../tweaker/core"
import { resolveTypeChecker } from "../types/resolveTypeChecker"
import { AnyType, TypeToData } from "../types/schemas"
import { failure, identityFn, isPrimitive } from "../utils"
import {
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
 * @typeparam T Object type.
 * @param nodeOrPrimitive Data structure, including primtives.
 * @returns The snapshot.
 */
export function getSnapshot<T extends AnyType>(
  type: T,
  nodeOrPrimitive: TypeToData<T>
): SnapshotOutOf<TypeToData<T>>

/**
 * Retrieves an immutable snapshot for a data structure.
 * Since returned snapshots are immutable they will respect shallow equality, this is,
 * if no changes are made then the snapshot will be kept the same.
 *
 * @typeparam T Object type.
 * @param nodeOrPrimitive Data structure, including primtives.
 * @returns The snapshot.
 */
export function getSnapshot<T>(nodeOrPrimitive: T): SnapshotOutOf<T>

export function getSnapshot(arg1: any, arg2?: any): any {
  let toSnapshotProcessor = identityFn as (sn: any) => unknown
  let nodeOrPrimitive: any

  if (arguments.length >= 2) {
    toSnapshotProcessor = resolveTypeChecker(arg1).toSnapshotProcessor
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

  freezeInternalSnapshot(snapshot.transformed)
  reportInternalSnapshotObserved(snapshot)
  return toSnapshotProcessor(snapshot.transformed)
}

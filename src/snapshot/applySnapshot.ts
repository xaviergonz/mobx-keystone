import { SnapshotOf } from "./SnapshotOf"
import { isObject } from "../utils"
import { getSnapshot } from "./getSnapshot"
import * as fsp from "fast-json-patch"
import { applyPatches } from "../patch/applyPatches"

export function applySnapshot<T extends object>(obj: T, snapshot: SnapshotOf<T>): void {
  if (!isObject(obj)) {
    throw fail("applySnapshot target must be an object")
  }

  const currentSnapshot = getSnapshot(obj)
  const patches = fsp.compare(currentSnapshot, snapshot)
  applyPatches(obj, patches as any)
}

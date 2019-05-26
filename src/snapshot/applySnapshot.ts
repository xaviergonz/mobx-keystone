import { SnapshotOutOf } from "./SnapshotOf"
import { getSnapshot } from "./getSnapshot"
import * as fsp from "fast-json-patch"
import { applyPatches } from "../patch/applyPatches"
import { getActionProtection } from "../action/protection"
import { getCurrentActionContext } from "../action/context"
import { assertTweakedObject } from "../tweaker/core"
import { failure } from "../utils"

export function applySnapshot<T extends object>(obj: T, snapshot: SnapshotOutOf<T>): void {
  if (getActionProtection() && !getCurrentActionContext()) {
    throw failure("applySnapshot must be run inside an action")
  }

  assertTweakedObject(obj, "applySnapshot")

  const currentSnapshot = getSnapshot(obj)
  const patches = fsp.compare(currentSnapshot, snapshot)
  applyPatches(obj, patches as any)
}

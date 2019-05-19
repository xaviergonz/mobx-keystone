import { fromSnapshot } from "./fromSnapshot"
import { getSnapshot } from "./getSnapshot"
import { assertTweakedObject } from "../tweaker/core"

export function clone<T extends object>(value: T): T {
  assertTweakedObject(value, "clone")

  const sn = getSnapshot(value)
  return fromSnapshot(sn as any)
}

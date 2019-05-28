import { v4 as uuidV4 } from "uuid"
import { assertTweakedObject } from "../tweaker/core"
import { fromSnapshot } from "./fromSnapshot"
import { getSnapshot } from "./getSnapshot"
import { modelIdKey } from "./metadata"

export function clone<T extends object>(value: T): T {
  assertTweakedObject(value, "clone")

  const sn = getSnapshot(value)
  return fromSnapshot({ ...(sn as any), [modelIdKey]: uuidV4() })
}

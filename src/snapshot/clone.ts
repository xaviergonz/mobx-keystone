import { fromSnapshot } from "./fromSnapshot"
import { getSnapshot } from "./getSnapshot"

export function clone<T>(value: T): T {
  const sn = getSnapshot(value)
  return fromSnapshot(sn as any)
}

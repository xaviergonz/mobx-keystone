import { getSnapshot } from "./getSnapshot"
import { fromSnapshot } from "./fromSnapshot"

export function clone<T>(value: T): T {
  const sn = getSnapshot(value)
  return fromSnapshot(sn as any)
}

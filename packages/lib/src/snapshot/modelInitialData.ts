import { isPrimitive, setProtoProp } from "../utils"

// Only primitive-only initial data can double as a snapshot without tweaking.
const modelInitialDataSnapshots = new WeakMap<object, Record<string, unknown>>()

/**
 * @internal
 */
export function setModelInitialDataSnapshot(data: object, snapshot: Record<string, unknown>): void {
  modelInitialDataSnapshots.set(data, snapshot)
}

/**
 * @internal
 */
export function updateModelInitialDataSnapshot(data: object, key: string, value: unknown): void {
  const initialDataSnapshot = modelInitialDataSnapshots.get(data)
  if (initialDataSnapshot) {
    if (!isPrimitive(value)) {
      modelInitialDataSnapshots.delete(data)
    } else if (key === "__proto__") {
      setProtoProp(initialDataSnapshot, value)
    } else {
      initialDataSnapshot[key] = value
    }
  }
}

/**
 * @internal
 */
export function takeModelInitialDataSnapshot(data: object): Record<string, unknown> | undefined {
  const initialDataSnapshot = modelInitialDataSnapshots.get(data)
  modelInitialDataSnapshots.delete(data)
  return initialDataSnapshot
}

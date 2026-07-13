interface ModelInitialDataSnapshot {
  readonly snapshot: Record<string, unknown>
  readonly allValuesPrimitive: boolean
  reusable: boolean
}

const modelInitialDataSnapshots = new WeakMap<object, ModelInitialDataSnapshot>()

/**
 * @internal
 */
export function setModelInitialDataSnapshot(
  data: object,
  snapshot: Record<string, unknown>,
  allValuesPrimitive: boolean
): void {
  modelInitialDataSnapshots.set(data, {
    snapshot,
    allValuesPrimitive,
    reusable: true,
  })
}

/**
 * @internal
 */
export function invalidateModelInitialDataSnapshot(data: object): void {
  const initialDataSnapshot = modelInitialDataSnapshots.get(data)
  if (initialDataSnapshot) {
    initialDataSnapshot.reusable = false
  }
}

/**
 * @internal
 */
export function takeModelInitialDataSnapshot(data: object): ModelInitialDataSnapshot | undefined {
  const initialDataSnapshot = modelInitialDataSnapshots.get(data)
  modelInitialDataSnapshots.delete(data)
  return initialDataSnapshot
}

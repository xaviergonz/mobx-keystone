import {
  applyPatches,
  applySnapshot,
  fromSnapshot,
  getParent,
  getSnapshot,
  idProp,
  Model,
  ModelAutoTypeCheckingMode,
  modelAction,
  onPatches,
  type Patch,
  prop,
  setGlobalConfig,
  transaction,
} from "../../src"
import { testModel } from "../utils"

@testModel("rollbackOnError/Item")
class Item extends Model({ id: idProp, n: prop(0) }) {}

@testModel("rollbackOnError/Store")
class Store extends Model({
  x: prop(0),
  items: prop<Item[]>(() => []),
  plain: prop<{ v: number }[]>(() => []),
}) {
  @modelAction
  setX(x: number) {
    this.x = x
  }

  @transaction
  @modelAction
  setXAndApply(x: number, sn: any, onError: "rethrow" | "catch" | "catchAndThrow") {
    this.x = x
    try {
      applySnapshot(this, sn)
    } catch (e) {
      if (onError === "rethrow") throw e
      this.x = x + 1
      if (onError === "catchAndThrow") throw new Error("after catching")
    }
  }
}

function createStore() {
  return new Store({
    items: [new Item({ id: "a", n: 1 }), new Item({ id: "b", n: 2 })],
    plain: [{ v: 1 }, { v: 2 }],
  })
}

// items are changed and plain is emptied before the unregistered model fails
function badSnapshot(store: Store) {
  const sn = getSnapshot(store)
  return {
    ...sn,
    x: 100,
    plain: [],
    items: [{ ...sn.items[1], n: 20 }, { $modelType: "rollbackOnError/notRegistered" }],
  }
}

function recordPatches(store: Store) {
  const patches: Patch[] = []
  const dispose = onPatches(store, (p) => {
    patches.push(...p)
  })
  return { patches, dispose }
}

describe.each([ModelAutoTypeCheckingMode.AlwaysOn, ModelAutoTypeCheckingMode.AlwaysOff])(
  "with type checking %s",
  (mode) => {
    beforeEach(() => {
      setGlobalConfig({ modelAutoTypeChecking: mode })
    })

    test("a failed applySnapshot is rolled back, keeping node identities", () => {
      const store = createStore()
      const before = getSnapshot(store)
      const [a, b] = store.items
      const plain0 = store.plain[0]
      const { patches, dispose } = recordPatches(store)

      expect(() => {
        applySnapshot(store, badSnapshot(store))
      }).toThrow("rollbackOnError/notRegistered")
      dispose()

      expect(getSnapshot(store)).toEqual(before)
      expect(store.items[0]).toBe(a)
      expect(store.items[1]).toBe(b)
      expect(getParent(a)).toBe(store.items)
      expect(store.plain[0]).toBe(plain0)

      // the compensating patches bring patch listeners back to the same state
      const copy = fromSnapshot(Store, before)
      applyPatches(copy, patches)
      expect(getSnapshot(copy)).toEqual(before)

      // the restored nodes still track changes
      store.setX(5)
      expect(getSnapshot(store).x).toBe(5)
    })

    test("a failed applyPatches is rolled back", () => {
      const store = createStore()
      const before = getSnapshot(store)

      expect(() => {
        applyPatches(store, [
          { op: "replace", path: ["x"], value: 1 },
          { op: "remove", path: ["items", 0] },
          { op: "add", path: ["plain", 0], value: { v: 0 } },
          { op: "add", path: ["items", 0], value: { $modelType: "rollbackOnError/notRegistered" } },
        ])
      }).toThrow("rollbackOnError/notRegistered")
      expect(getSnapshot(store)).toEqual(before)
    })

    test("errors thrown by listeners do not roll back", () => {
      const store = createStore()
      const dispose = onPatches(store, () => {
        throw new Error("listener failed")
      })
      try {
        expect(() => {
          applySnapshot(store, { ...getSnapshot(store), x: 7 })
        }).toThrow("listener failed")
      } finally {
        dispose()
      }
      expect(store.x).toBe(7)
    })

    test("a failed call nested in a listener only rolls back its own changes", () => {
      const store = createStore()
      const other = createStore()
      const otherBefore = getSnapshot(other)
      let nestedError: unknown
      const dispose = onPatches(store, () => {
        try {
          applySnapshot(other, badSnapshot(other))
        } catch (e) {
          nestedError = e
        }
      })
      try {
        applySnapshot(store, { ...getSnapshot(store), x: 7 })
      } finally {
        dispose()
      }
      expect(String(nestedError)).toContain("rollbackOnError/notRegistered")
      expect(store.x).toBe(7)
      expect(getSnapshot(other)).toEqual(otherBefore)
    })

    describe("inside a transaction", () => {
      test("rethrowing restores the state without rollback failures", () => {
        const store = createStore()
        const before = getSnapshot(store)
        const { patches, dispose } = recordPatches(store)

        let error: unknown
        try {
          store.setXAndApply(1, badSnapshot(store), "rethrow")
        } catch (e) {
          error = e
        }
        dispose()

        // the original error, not an aggregate of rollback failures
        expect(String(error)).toContain("rollbackOnError/notRegistered")
        expect(getSnapshot(store)).toEqual(before)

        const copy = fromSnapshot(Store, before)
        applyPatches(copy, patches)
        expect(getSnapshot(copy)).toEqual(before)
      })

      test("catching the error keeps the other changes of the action", () => {
        const store = createStore()
        const before = getSnapshot(store)
        store.setXAndApply(1, badSnapshot(store), "catch")
        expect(getSnapshot(store)).toEqual({ ...before, x: 2 })
      })

      test("throwing after catching the error restores the state", () => {
        const store = createStore()
        const before = getSnapshot(store)
        expect(() => {
          store.setXAndApply(1, badSnapshot(store), "catchAndThrow")
        }).toThrow("after catching")
        expect(getSnapshot(store)).toEqual(before)
      })
    })
  }
)

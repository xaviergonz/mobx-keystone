import { remove, set } from "mobx"
import {
  fromSnapshot,
  getParentPath,
  getRootPath,
  getSnapshot,
  idProp,
  Model,
  ModelAutoTypeCheckingMode,
  resolveId,
  runUnprotected,
  setGlobalConfig,
  tProp,
  types,
} from "../../src"
import { testModel } from "../utils"

// Random changes to a large tree, checking that everything the library keeps
// up to date incrementally (cached type checks, lazy array indexes, id indexes,
// snapshots) matches what a plain mirror of the data says it should be.

const positive = types.refinement(types.number, (n) => n >= 0)
const meta = types.object(() => ({ a: types.maybe(positive) }))

@testModel("randomTreeInvariants/Item")
class Item extends Model({
  id: idProp,
  code: tProp(types.string, ""),
  n: tProp(positive, 0),
  tags: tProp(types.record(positive), () => ({})),
  metas: tProp(types.array(meta), () => []),
  children: tProp(types.array(types.model<Item>(() => Item)), () => []),
}) {}

@testModel("randomTreeInvariants/Store")
class Store extends Model({
  items: tProp(types.array(types.model<Item>(() => Item)), () => []),
  big: tProp(types.record(types.model<Item>(() => Item)), () => ({})),
  bigMetas: tProp(types.array(meta), () => []),
  bigMetaRecord: tProp(types.record(meta), () => ({})),
}) {}

type Json = any
type Path = (string | number)[]

const getCode = (node: object) => (node instanceof Item && node.code !== "" ? node.code : undefined)

function createRandom(seed: number) {
  return (max: number) => {
    seed = (seed * 16807) % 2147483647
    return seed % max
  }
}

function setAutoTypeChecking(on: boolean) {
  setGlobalConfig({
    modelAutoTypeChecking: on
      ? ModelAutoTypeCheckingMode.AlwaysOn
      : ModelAutoTypeCheckingMode.AlwaysOff,
  })
}

beforeEach(() => {
  setAutoTypeChecking(true)
})

afterEach(() => {
  setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.DevModeOnly })
})

// large enough for lazy array indexes (splices over 1,024 children) and several chunks
test.each([1, 2, 3])(
  "random changes keep derived state consistent (seed %i)",
  (seed) => {
    const random = createRandom(seed)
    let idCounter = 0
    const newItemSnapshot = (children = 0): Json => ({
      id: `x${++idCounter}`,
      code: random(3) === 0 ? `c${random(20)}` : "",
      n: random(5),
      tags: random(2) ? { t0: random(3) } : {},
      metas: random(2) ? [{}] : [],
      children: Array.from({ length: children }, () => newItemSnapshot()),
      $modelType: "randomTreeInvariants/Item",
    })

    const root = fromSnapshot(Store, {
      items: Array.from({ length: 1200 }, () => newItemSnapshot(random(4) === 0 ? 2 : 0)),
      big: Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`k${i}`, newItemSnapshot()])),
      bigMetas: Array.from({ length: 300 }, () => ({})),
      bigMetaRecord: Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`m${i}`, {}])),
      $modelType: "randomTreeInvariants/Store",
    } as Json)
    const mirror: Json = JSON.parse(JSON.stringify(getSnapshot(root)))

    const nodeAt = (from: Json, path: Path) => path.reduce((node, key) => node[key], from)

    const itemPaths = () => {
      const paths: Path[] = []
      const visit = (item: Json, path: Path) => {
        paths.push(path)
        item.children.forEach((c: Json, i: number) => {
          visit(c, [...path, "children", i])
        })
      }
      mirror.items.forEach((item: Json, i: number) => {
        visit(item, ["items", i])
      })
      for (const k of Object.keys(mirror.big)) visit(mirror.big[k], ["big", k])
      return paths
    }
    const pick = <T>(arr: readonly T[]) => arr[random(arr.length)]
    const pickItemArray = (): Path =>
      random(2) === 0 ? ["items"] : [...pick(itemPaths()), "children"]

    // a change, whether it leaves the data valid, and the same change on the mirror
    interface Change {
      valid: boolean
      tree(): void
      mirror(): void
    }

    // an invalid value, where the type check reports it, and the change setting a valid one back
    interface InvalidValue {
      path: Path
      fix: Change
    }

    const setValue = (
      path: Path,
      key: string,
      value: number,
      assign: (node: Json, value: number) => void
    ): Change & { invalid?: InvalidValue } => {
      const change = (v: number): Change => ({
        valid: v >= 0,
        tree: () => assign(nodeAt(root, path), v),
        mirror: () => {
          nodeAt(mirror, path)[key] = v
        },
      })
      return {
        ...change(value),
        invalid: value >= 0 ? undefined : { path: [...path, key], fix: change(0) },
      }
    }

    const changes: (() => (Change & { invalid?: InvalidValue }) | undefined)[] = [
      // splice an array of items (sometimes in bulk)
      () => {
        const path = pickItemArray()
        const arr = nodeAt(mirror, path)
        const bulk = path.length === 1 && random(8) === 0
        const at = random(arr.length + 1)
        const removed = bulk ? random(400) : random(3)
        const added = Array.from({ length: bulk ? random(300) : random(3) }, () =>
          newItemSnapshot(random(3))
        )
        return {
          valid: true,
          tree: () => {
            nodeAt(root, path).splice(at, removed, ...added.map((sn) => fromSnapshot(Item, sn)))
          },
          mirror: () => arr.splice(at, removed, ...added),
        }
      },
      // move an item to another array, not inside itself
      () => {
        const from = pick(itemPaths())
        const to = pickItemArray()
        if (from[0] === "big" || to.join("/").startsWith(from.join("/"))) return undefined
        const fromArr = from.slice(0, -1)
        const fromIndex = from[from.length - 1] as number
        // (within the same array, once the item was taken out)
        const sameArray = to.join("/") === fromArr.join("/")
        const at = random(nodeAt(mirror, to).length + (sameArray ? 0 : 1))
        const move = (base: Json) => {
          // (both arrays are found first, since taking the item out can shift the path of the other)
          const toArr = nodeAt(base, to)
          const [item] = nodeAt(base, fromArr).splice(fromIndex, 1)
          toArr.splice(at, 0, item)
        }
        return { valid: true, tree: () => move(root), mirror: () => move(mirror) }
      },
      // set a number, sometimes to an invalid value
      () => {
        const path = pick(itemPaths())
        return setValue(path, "n", random(4) === 0 ? -1 : random(9), (node, v) => {
          node.n = v
        })
      },
      // add, change or delete a record key
      () => {
        const path = [...pick(itemPaths()), "tags"]
        const key = `t${random(3)}`
        if (random(3) === 0) {
          return {
            valid: true,
            tree: () => remove(nodeAt(root, path), key),
            mirror: () => delete nodeAt(mirror, path)[key],
          }
        }
        return setValue(path, key, random(4) === 0 ? -1 : random(3), (node, v) => {
          set(node, key, v)
        })
      },
      // add or delete a key of the big record
      () => {
        const keys = Object.keys(mirror.big)
        if (random(2) === 0 && keys.length > 0) {
          const key = pick(keys)
          return {
            valid: true,
            tree: () => remove(root.big, key),
            mirror: () => delete mirror.big[key],
          }
        }
        const key = `k${random(400)}`
        const sn = newItemSnapshot()
        return {
          valid: true,
          tree: () => set(root.big, key, fromSnapshot(Item, sn)),
          mirror: () => {
            mirror.big[key] = sn
          },
        }
      },
      // add, change or delete an optional key of a plain object in an array or record
      () => {
        const r = random(3)
        const parentPath =
          r === 0 ? ["bigMetas"] : r === 1 ? ["bigMetaRecord"] : [...pick(itemPaths()), "metas"]
        const keys = Object.keys(nodeAt(mirror, parentPath))
        if (keys.length === 0) return undefined
        const key = pick(keys)
        const path = [...parentPath, r === 1 ? key : Number(key)]
        if (random(3) === 0) {
          return {
            valid: true,
            tree: () => remove(nodeAt(root, path), "a"),
            mirror: () => delete nodeAt(mirror, path).a,
          }
        }
        return setValue(path, "a", random(4) === 0 ? -1 : random(3), (node, v) => {
          set(node, "a", v)
        })
      },
      // splice the big array of plain objects
      () => {
        const at = random(mirror.bigMetas.length + 1)
        const removed = random(3)
        const added = Array.from({ length: random(3) }, () => (random(2) ? {} : { a: 1 }))
        return {
          valid: true,
          tree: () => {
            root.bigMetas.splice(at, removed, ...added.map((a) => ({ ...a })))
          },
          mirror: () => mirror.bigMetas.splice(at, removed, ...added),
        }
      },
      // detach a record, change its keys while detached, and attach it again
      () => {
        const path = pick(itemPaths())
        const key = `t${random(3)}`
        const value = random(2) === 0 ? undefined : random(3)
        const change = (tags: Json) => {
          if (value === undefined) remove(tags, key)
          else set(tags, key, value)
        }
        return {
          valid: true,
          tree: () => {
            const item = nodeAt(root, path)
            const tags = item.tags
            item.tags = {}
            change(tags)
            item.tags = tags
          },
          mirror: () => {
            const tags = nodeAt(mirror, path).tags
            if (value === undefined) delete tags[key]
            else tags[key] = value
          },
        }
      },
      // detach the big array of plain objects, splice it while detached, and attach it again
      () => {
        const at = random(mirror.bigMetas.length + 1)
        const removed = random(3)
        const added = Array.from({ length: random(3) }, () => (random(2) ? {} : { a: 1 }))
        return {
          valid: true,
          tree: () => {
            const arr = root.bigMetas
            root.bigMetas = []
            arr.splice(at, removed, ...added.map((a) => ({ ...a })))
            root.bigMetas = arr
          },
          mirror: () => mirror.bigMetas.splice(at, removed, ...added),
        }
      },
      // change a custom id
      () => {
        const path = pick(itemPaths())
        const code = random(3) === 0 ? "" : `c${random(20)}`
        return {
          valid: true,
          tree: () => {
            nodeAt(root, path).code = code
          },
          mirror: () => {
            nodeAt(mirror, path).code = code
          },
        }
      },
    ]

    function checkTypeCheckCache() {
      // a check from scratch, of a copy nothing was cached for yet (slow, so only done once)
      setAutoTypeChecking(false)
      let copy: Store
      try {
        copy = fromSnapshot(Store, getSnapshot(root))
      } finally {
        setAutoTypeChecking(true)
      }
      const expected = copy.typeCheck()
      expect(root.typeCheck()?.message).toBe(expected?.message)
    }

    function checkDerivedState() {
      expect(getSnapshot(root)).toEqual(mirror)

      const codes = new Map<string, Set<Item>>()
      const checkChild = (parent: object, key: string | number, child: object) => {
        const parentPath = getParentPath(child)
        expect(parentPath?.parent).toBe(parent)
        expect(parentPath?.path).toBe(key)
      }
      const visitItem = (item: Item, path: Path) => {
        expect(getRootPath(item).path).toEqual(path)
        expect(resolveId(root, item.id)).toBe(item)
        if (item.code !== "") {
          if (!codes.has(item.code)) codes.set(item.code, new Set())
          codes.get(item.code)!.add(item)
        }
        item.metas.forEach((m, i) => {
          checkChild(item.metas, i, m)
        })
        item.children.forEach((c, i) => {
          checkChild(item.children, i, c)
          visitItem(c, [...path, "children", i])
        })
      }
      root.items.forEach((item, i) => {
        checkChild(root.items, i, item)
        visitItem(item, ["items", i])
      })
      for (const key of Object.keys(root.big)) {
        checkChild(root.big, key, root.big[key])
        visitItem(root.big[key], ["big", key])
      }
      root.bigMetas.forEach((m, i) => {
        checkChild(root.bigMetas, i, m)
      })
      for (const key of Object.keys(root.bigMetaRecord)) {
        checkChild(root.bigMetaRecord, key, root.bigMetaRecord[key])
      }

      for (let i = 0; i < 20; i++) {
        const code = `c${i}`
        const resolved = resolveId(root, code, getCode)
        if (codes.has(code)) {
          expect(codes.get(code)!.has(resolved as Item)).toBe(true)
        } else {
          expect(resolved).toBeUndefined()
        }
      }
    }

    let checkedTypeCheckCache = false
    for (let step = 0; step < 150; step++) {
      const change = pick(changes)()
      if (!change) continue

      if (change.invalid && random(3) === 0) {
        // let an invalid value in while automatic checks are off, so the cached
        // checks have to notice it later on
        setAutoTypeChecking(false)
        try {
          runUnprotected(change.tree)
        } finally {
          setAutoTypeChecking(true)
        }
        change.mirror()
        expect(root.typeCheck()?.path).toEqual(change.invalid.path)
        if (!checkedTypeCheckCache) {
          checkTypeCheckCache()
          checkedTypeCheckCache = true
        }
        // setting a valid value back is accepted again
        runUnprotected(change.invalid.fix.tree)
        change.invalid.fix.mirror()
      } else {
        let rejected = false
        try {
          runUnprotected(change.tree)
        } catch (e) {
          expect(String(e)).toMatch(/TypeCheckError/)
          rejected = true
        }
        expect(rejected).toBe(!change.valid)
        if (!rejected) change.mirror()
      }

      expect(root.typeCheck()).toBeNull()
      if (step % 15 === 0) {
        checkDerivedState()
      }
    }

    checkDerivedState()
  },
  30000
)

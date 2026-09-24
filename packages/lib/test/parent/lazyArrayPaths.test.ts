import { autorun } from "mobx"
import {
  applyPatches,
  fromSnapshot,
  getParentPath,
  getRootPath,
  getSnapshot,
  idProp,
  Model,
  onPatches,
  type Patch,
  prop,
  runUnprotected,
  toTreeNode,
} from "../../src"
import { autoDispose, testModel } from "../utils"

// large enough for splices near the front to switch the array to lazy indexes
const size = 2000

@testModel("lazyArrayPaths/Item")
class Item extends Model({ id: idProp, value: prop(0) }) {}

@testModel("lazyArrayPaths/Store")
class Store extends Model({ items: prop<Item[]>(() => []) }) {}

function createRandom() {
  let seed = 1
  return (max: number) => {
    seed = (seed * 16807) % 2147483647
    return seed % max
  }
}

function expectIndexes(array: readonly unknown[]) {
  const items = array.slice()
  // collect mismatches and assert once: an expect per item is too slow under CI coverage
  const mismatches: { index: number; path: unknown; sameParent: boolean }[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (typeof item === "object" && item !== null) {
      // compare the parent by identity: deep-equality on large MobX 4 arrays is very slow
      const parentPath = getParentPath(item)
      const sameParent = parentPath?.parent === array
      if (!sameParent || parentPath?.path !== i) {
        mismatches.push({ index: i, path: parentPath?.path, sameParent })
      }
    }
  }
  expect(mismatches).toStrictEqual([])
}

test("indexes follow random splices", () => {
  const store = new Store({ items: Array.from({ length: size }, () => new Item({})) })
  const items = store.items
  const random = createRandom()
  const newItems = (count: number) => Array.from({ length: count }, () => new Item({}))

  for (let i = 0; i < 100; i++) {
    runUnprotected(() => {
      const at = random(items.length + 1)
      const op = random(8)
      if (op === 0) items.unshift(...newItems(1 + random(3)))
      // big enough to split chunks, or to shrink them enough to be merged
      else if (op === 1) items.splice(at, 0, ...newItems(random(300)))
      else if (op === 2) items.splice(at, random(300))
      else if (op === 3) items.splice(at, random(200), ...newItems(random(100)))
      // same count, possibly spanning chunks
      else if (op === 4) {
        const count = random(150)
        items.splice(at, count, ...newItems(count))
      } else if (op === 5 && items.length > 0) items[random(items.length)] = new Item({})
      // move an item within the array
      else if (op === 6 && items.length > 0) {
        const [moved] = items.splice(random(items.length), 1)
        items.splice(random(items.length + 1), 0, moved)
      } else items.shift()
      if (items.length < size / 2) items.push(...newItems(size / 2))
    })
    expectIndexes(items)
  }
  const last = items[items.length - 1]
  expect(getRootPath(last).path).toEqual(["items", items.length - 1])
})

test("indexes of mixed arrays follow splices", () => {
  const array = toTreeNode<unknown[]>(
    Array.from({ length: size }, (_, i) => (i % 3 === 0 ? i : { i }))
  )
  runUnprotected(() => array.unshift({ i: -1 }, 1, [2]))
  expectIndexes(array)
  runUnprotected(() => array.splice(1000, 500, "a", { i: -2 }))
  expectIndexes(array)
  runUnprotected(() => array.splice(0, 1))
  expectIndexes(array)
})

test("observed paths react to index changes, also after chunks are split or merged", () => {
  const store = new Store({ items: Array.from({ length: size }, () => new Item({})) })
  const items = store.items
  const watched = [items[5], items[700], items[1999]]
  const seen = watched.map(() => [] as unknown[])
  watched.forEach((item, i) => {
    autoDispose(autorun(() => seen[i].push(getParentPath(item)?.path)))
  })
  const expectSeen = () => {
    watched.forEach((item, i) => {
      const index = items.indexOf(item)
      expect(seen[i][seen[i].length - 1]).toBe(index === -1 ? undefined : index)
    })
  }

  runUnprotected(() => items.unshift(new Item({})))
  expectSeen()
  // splits the chunk it lands in
  runUnprotected(() => items.splice(3, 0, ...Array.from({ length: 600 }, () => new Item({}))))
  expectSeen()
  // shrinks chunks enough to merge them
  runUnprotected(() => items.splice(0, 600))
  expectSeen()
  runUnprotected(() => items.splice(10, 900))
  expectSeen()
  runUnprotected(() => items.unshift(new Item({})))
  expectSeen()
  expect(seen[2].length).toBeGreaterThan(5)
})

test("observed paths follow items moved to other chunks by same-length splices", () => {
  const store = new Store({ items: Array.from({ length: size }, () => new Item({})) })
  const items = store.items
  // switch to lazy indexes, chunks of 128
  runUnprotected(() => items.unshift(new Item({})))

  // chunks of 129, 128, 128, ... items
  const watchedIndexes = [126, 505, 1500]
  const watched = watchedIndexes.map((i) => items[i])
  const seen = watched.map(() => [] as unknown[])
  watched.forEach((item, i) => {
    autoDispose(autorun(() => seen[i].push(getParentPath(item)?.path)))
  })
  const expectSeen = () => {
    watched.forEach((item, i) => {
      const index = items.indexOf(item)
      expect(seen[i][seen[i].length - 1]).toBe(index === -1 ? undefined : index)
    })
  }

  // no index changes, but the first chunk grows enough to be split past item
  // 126, and the fourth one keeps only 18 items (505 among them), so it is merged
  runUnprotected(() => {
    const count = 367
    items.splice(128, count, ...Array.from({ length: count }, () => new Item({})))
  })
  expectSeen()
  // every index changes now, so observers of dropped chunks would miss it
  runUnprotected(() => items.unshift(new Item({})))
  expectSeen()
})

test("paths handed out are immutable, also once removed", () => {
  const store = new Store({ items: Array.from({ length: size }, () => new Item({})) })
  const items = store.items
  // switch to lazy indexes
  runUnprotected(() => items.unshift(new Item({})))
  const item = items[10]
  const before = getParentPath(item)
  expect(getParentPath(item)).toBe(before)

  runUnprotected(() => items.unshift(new Item({}), new Item({})))
  const after = getParentPath(item)
  expect(before?.path).toBe(10)
  expect(after?.path).toBe(12)
  expect(getParentPath(item)).toBe(after)

  runUnprotected(() => items.splice(12, 1))
  expect(getParentPath(item)).toBeUndefined()
  expect(after?.path).toBe(12)
  expectIndexes(items)
})

test("patches use the lazy indexes", () => {
  const store = new Store({ items: Array.from({ length: size }, () => new Item({})) })
  const copy = fromSnapshot(Store, getSnapshot(store))
  const patches: Patch[] = []
  autoDispose(onPatches(store, (p) => patches.push(...p)))
  const random = createRandom()

  for (let i = 0; i < 50; i++) {
    runUnprotected(() => {
      store.items.splice(random(100), random(3), new Item({}))
      store.items[random(store.items.length)].value = i
    })
  }
  runUnprotected(() => applyPatches(copy, patches))
  expect(getSnapshot(copy)).toStrictEqual(getSnapshot(store))
})

test("a failed insertion leaves indexes intact", () => {
  const store = new Store({ items: Array.from({ length: size }, () => new Item({})) })
  const items = store.items
  runUnprotected(() => items.unshift(new Item({})))

  const other = new Store({ items: [new Item({})] })
  expect(() => runUnprotected(() => items.splice(5, 0, new Item({}), other.items[0]))).toThrow()
  expectIndexes(items)

  runUnprotected(() => items.unshift(new Item({})))
  expectIndexes(items)
})

import { LoroDoc, LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { onReactionError } from "mobx"
import {
  DeepChangeType,
  getSnapshot,
  idProp,
  Model,
  onDeepChange,
  runUnprotected,
  tProp,
  types,
} from "mobx-keystone"
import { bindLoroToMobxKeystone, LoroTextModel, moveWithinArray } from "../../src"
import { convertLoroDataToJson } from "../../src/binding/convertLoroDataToJson"
import { autoDispose, testModel } from "../utils"

@testModel("fuzz-item")
class Item extends Model({
  id: idProp,
  value: tProp(0),
  text: tProp(LoroTextModel, () => LoroTextModel.withText("")),
  tags: tProp(types.array(types.number), () => []),
}) {}

@testModel("fuzz-root")
class Root extends Model({
  items: tProp(types.array(types.or(types.number, Item)), () => []),
  flag: tProp(0),
  count: tProp(0),
}) {}

/** Deterministic so a failure names the exact seed and round to replay. */
function createRandom(seed: number) {
  let state = seed >>> 0
  return (max: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return max === 0 ? 0 : state % max
  }
}

let nextId = 0
const itemType = getSnapshot(new Item({ id: "template" })).$modelType

function editNatively(list: LoroMovableList, random: (max: number) => number) {
  const at = list.length === 0 ? -1 : random(list.length)
  const kind = random(6)
  if (kind === 0 || at < 0) {
    if (random(2) === 0) {
      list.insert(list.length, random(100))
    } else {
      const map = list.pushContainer(new LoroMap())
      map.set("$modelType", itemType)
      map.set("id", `native${nextId++}`)
      map.set("value", random(100))
      map.setContainer("text", new LoroText()).insert(0, "n")
      map.setContainer("tags", new LoroMovableList()).insert(0, random(10))
    }
  } else if (kind === 1) {
    list.delete(at, 1)
  } else if (kind === 2) {
    list.move(at, random(list.length))
  } else {
    const item = list.get(at)
    if (!(item instanceof LoroMap)) list.set(at, random(100))
    else if (kind === 3) item.set("value", random(100))
    else if (kind === 4) (item.get("text") as LoroText).insert(0, "x")
    else (item.get("tags") as LoroMovableList).insert(0, random(10))
  }
}

function editLocally(items: (number | Item)[], random: (max: number) => number) {
  const at = items.length === 0 ? -1 : random(items.length)
  const kind = random(6)
  if (kind === 0 || at < 0) {
    if (random(2) === 0) items.push(random(100))
    else items.push(new Item({ id: `local${nextId++}`, value: random(100) }))
  } else if (kind === 1) {
    items.splice(at, 1)
  } else if (kind === 2 && items.length > 1) {
    moveWithinArray(items, at, random(items.length + 1))
  } else {
    const item = items[at]
    if (!(item instanceof Item)) items[at] = random(100)
    else if (kind === 3) item.value = random(100)
    else if (kind === 4) item.tags.push(random(10))
    else item.text.setDelta([{ insert: `t${random(10)}` }])
  }
}

function bindRoot() {
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  return { root, boundObject: binding.boundObject }
}

test("pending native edits and local edits in one action always converge", () => {
  const errors: unknown[] = []
  autoDispose(onReactionError((error) => errors.push(String(error))))
  for (let seed = 1; seed <= 100; seed++) {
    const random = createRandom(seed * 7919)
    const { root, boundObject } = bindRoot()
    for (let round = 0; round < 12; round++) {
      const list = root.get("items") as LoroMovableList
      for (let i = random(3); i > 0; i--) editNatively(list, random)
      runUnprotected(() => {
        for (let i = random(3); i > 0; i--) editLocally(boundObject.items, random)
        boundObject.count++
      })
      expect({ seed, round, errors }).toEqual({ seed, round, errors: [] })
      expect({ seed, round, snapshot: getSnapshot(boundObject) }).toEqual({
        seed,
        round,
        snapshot: convertLoroDataToJson(root),
      })
    }
  }
})

test("pending native edits and reentrant listener edits always converge", () => {
  const errors: unknown[] = []
  autoDispose(onReactionError((error) => errors.push(String(error))))
  for (let seed = 1; seed <= 100; seed++) {
    const random = createRandom(seed * 104729)
    const { root, boundObject } = bindRoot()
    autoDispose(
      onDeepChange(boundObject, (change) => {
        if (change.type === DeepChangeType.ObjectUpdate && change.key === "flag")
          editLocally(boundObject.items, random)
      })
    )
    for (let round = 0; round < 12; round++) {
      const list = root.get("items") as LoroMovableList
      for (let i = random(3); i > 0; i--) editNatively(list, random)
      runUnprotected(() => {
        boundObject.flag = random(1000)
        boundObject.count++
      })
      expect({ seed, round, errors }).toEqual({ seed, round, errors: [] })
      expect({ seed, round, snapshot: getSnapshot(boundObject) }).toEqual({
        seed,
        round,
        snapshot: convertLoroDataToJson(root),
      })
    }
  }
})

import { getSnapshot, Model, tProp, types } from "mobx-keystone"
import * as Y from "yjs"
import { bindYjsToMobxKeystone, convertJsonToYjsData } from "../../src"
import { autoDispose, testModel } from "../utils"

@testModel("mixed-transaction-root")
class Root extends Model({
  list: tProp(types.array(types.record(types.number))),
  flag: tProp(types.maybe(types.number)),
}) {}

test.each([1, 7, 42, 1234].flatMap((seed) => [false, true].map((typed) => ({ seed, typed }))))(
  "mixed native transactions converge across replicas (seed: $seed, typed: $typed)",
  ({ seed, typed }) => {
    let state = seed
    const random = (limit: number) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return Math.floor((state / 0x100000000) * limit)
    }
    const doc = new Y.Doc()
    const root = doc.getMap("root")
    const list = new Y.Array<Y.Map<number>>()
    root.set("list", list)
    const peer = new Y.Doc()
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(doc))
    const bind = (document: Y.Doc) => {
      const binding = bindYjsToMobxKeystone({
        yjsDoc: document,
        yjsObject: document.getMap("root"),
        mobxKeystoneType: typed ? Root : types.record(types.unchecked<unknown>()),
      })
      autoDispose(binding.dispose)
      return binding.boundObject
    }
    const bound = bind(doc)
    const remote = bind(peer)
    const undoManagers = [doc, peer].map((document) => {
      const undo = new Y.UndoManager(document.getMap("root"), { captureTimeout: 0 })
      autoDispose(() => undo.destroy())
      return undo
    })
    for (let round = 0; round < 100; round++) {
      const replica = random(2)
      const source = [doc, peer][replica]
      const root = source.getMap("root")
      const list = root.get("list") as Y.Array<Y.Map<number>>
      const undo = undoManagers[replica]
      source.transact(() => {
        for (let edit = 0; edit < 4; edit++) {
          switch (random(5)) {
            case 0:
              list.insert(random(list.length + 1), [
                convertJsonToYjsData({ n: random(100) }) as Y.Map<number>,
              ])
              break
            case 1:
              if (list.length > 0) list.delete(random(list.length), 1)
              break
            case 2:
              if (list.length > 0) list.get(random(list.length)).set("n", random(100))
              break
            case 3:
              root.set("flag", random(100))
              break
            case 4:
              root.delete("flag")
              break
          }
        }
      })
      if (random(4) === 0) {
        undo.undo()
        if (random(2)) undo.redo()
      }
      expect(getSnapshot(bound), `local round ${round}`).toEqual(doc.getMap("root").toJSON())
      expect(getSnapshot(remote), `remote round ${round}`).toEqual(peer.getMap("root").toJSON())
      // Leave replicas disconnected between exchanges to exercise concurrent
      // insertions, retained-child edits, and undo against remote history.
      if (round % 3 === 0 || round === 99) {
        Y.applyUpdate(peer, Y.encodeStateAsUpdate(doc, Y.encodeStateVector(peer)))
        Y.applyUpdate(doc, Y.encodeStateAsUpdate(peer, Y.encodeStateVector(doc)))
        expect(getSnapshot(bound), `merged local round ${round}`).toEqual(root.toJSON())
        expect(getSnapshot(remote), `merged remote round ${round}`).toEqual(root.toJSON())
      }
    }
  }
)

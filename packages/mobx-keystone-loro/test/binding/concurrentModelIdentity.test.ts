import { LoroDoc, type LoroMap } from "loro-crdt"
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
import { applyJsonObjectToLoroMap, bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each(["ID", "type"])(
  "startup native edits replace conflicting initialized model %s atomically",
  (kind) => {
    @testModel("startup-concurrent-identity-child")
    class Child extends Model({ key: idProp, count: tProp(0), untouched: tProp(0) }) {}
    @testModel("startup-concurrent-identity-other")
    class Other extends Model({ key: idProp, count: tProp(""), untouched: tProp(0) }) {}
    let initialize: ((value: Root) => void) | undefined
    @testModel("startup-concurrent-identity-root")
    class Root extends Model({ child: tProp(types.or(Child, Other)) }) {
      onInit() {
        initialize?.(this)
      }
    }
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    applyJsonObjectToLoroMap(root, getSnapshot(new Root({ child: new Child({ key: "original" }) })))
    doc.commit()
    const nativeChild = root.get("child") as LoroMap
    initialize = (value) => {
      value.child =
        kind === "type"
          ? new Other({ key: "original", count: "nine", untouched: 9 })
          : new Child({ key: "replacement", count: 9, untouched: 9 })
      nativeChild.set("count", 2)
    }
    const binding = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: Root,
    })
    autoDispose(binding.dispose)
    expect(binding.boundObject.child.key).toBe("original")
    expect(binding.boundObject.child.count).toBe(2)
    expect(binding.boundObject.child.untouched).toBe(0)
    expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
  }
)

test.each([
  ["ID", true],
  ["type", true],
  ["ID", false],
  ["type", false],
] as const)(
  "local edits replace conflicting pending native model %s atomically (reentrant: %s)",
  (kind, reentrant) => {
    @testModel("runtime-concurrent-identity-child")
    class Child extends Model({ key: idProp, count: tProp(0), untouched: tProp(0) }) {}
    @testModel("runtime-concurrent-identity-other")
    class Other extends Model({ key: idProp, count: tProp(""), untouched: tProp(0) }) {}
    @testModel("runtime-concurrent-identity-root")
    class Root extends Model({
      flag: tProp(0),
      child: tProp(types.or(Child, Other), () => new Child({ key: "original" })),
    }) {}
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    const binding = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: Root,
    })
    autoDispose(binding.dispose)
    const nativeChild = root.get("child") as LoroMap
    autoDispose(
      onDeepChange(binding.boundObject, (change) => {
        if (change.type === DeepChangeType.ObjectUpdate && change.key === "flag")
          binding.boundObject.child.count = 2
      })
    )
    const replacement = getSnapshot(
      kind === "type"
        ? new Other({ key: "original", count: "nine", untouched: 9 })
        : new Child({ key: "replacement", count: 9, untouched: 9 })
    )
    for (const [key, value] of Object.entries(replacement)) nativeChild.set(key, value)
    runUnprotected(() => {
      if (reentrant) binding.boundObject.flag = 1
      else binding.boundObject.child.count = 2
    })
    expect(binding.boundObject.child.key).toBe("original")
    expect(binding.boundObject.child.count).toBe(2)
    expect(binding.boundObject.child.untouched).toBe(0)
    expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
  }
)

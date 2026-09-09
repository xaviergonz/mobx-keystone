import { LoroDoc, type LoroMap, type LoroMovableList } from "loro-crdt"
import {
  getGlobalConfig,
  getSnapshot,
  Model,
  ModelAutoTypeCheckingMode,
  prop,
  setGlobalConfig,
  TypeCheckErrorFailure,
  tProp,
  types,
} from "mobx-keystone"
import { applyJsonObjectToLoroMap, bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each(
  [false, true].flatMap((enableAfterBinding) =>
    ["array", "map", "multiple"].map((kind) => ({ enableAfterBinding, kind }))
  )
)(
  "native $kind updates validate through untyped models (enable after binding: $enableAfterBinding)",
  ({ enableAfterBinding, kind }) => {
    const previous = getGlobalConfig().modelAutoTypeChecking
    autoDispose(() => setGlobalConfig({ modelAutoTypeChecking: previous }))
    setGlobalConfig({
      modelAutoTypeChecking: enableAfterBinding
        ? ModelAutoTypeCheckingMode.AlwaysOff
        : ModelAutoTypeCheckingMode.AlwaysOn,
    })
    @testModel("untyped-validation-bridge")
    class Bridge extends Model({
      values: prop<number[]>(() => [1, 2, 3]),
      pair: prop(() => ({ left: 1, right: 3 })),
    }) {}
    @testModel("typed-validation-ancestor")
    class Root extends Model({
      bridge: tProp(
        types.refinement(
          types.unchecked<Bridge>(),
          (bridge) =>
            bridge.values.reduce((sum, value) => sum + value, 0) +
              bridge.pair.left +
              bridge.pair.right ===
            10
        )
      ),
    }) {}
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    applyJsonObjectToLoroMap(root, getSnapshot(new Root({ bridge: new Bridge({}) })))
    doc.commit()
    // Loro catches subscriber exceptions at its WASM boundary; capture them here.
    const errors: unknown[] = []
    const subscribe = doc.subscribe.bind(doc)
    const spy = vi.spyOn(doc, "subscribe").mockImplementation((callback) =>
      subscribe((batch) => {
        try {
          callback(batch)
        } catch (error) {
          errors.push(error)
        }
      })
    )
    autoDispose(() => spy.mockRestore())
    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: Root,
    })
    autoDispose(dispose)
    setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOn })
    const bridge = root.get("bridge") as LoroMap
    const values = bridge.get("values") as LoroMovableList<number>
    const pair = bridge.get("pair") as LoroMap<{ left: number; right: number }>
    const replace = (index: number, value: number) => {
      values.set(index, value)
    }
    const transact = (fn: () => void) => {
      fn()
      doc.commit()
    }
    transact(() => {
      if (kind !== "map") {
        replace(0, 3)
        replace(2, kind === "multiple" ? 2 : 1)
      }
      if (kind !== "array") {
        pair.set("left", kind === "multiple" ? 2 : 3)
        pair.set("right", 1)
      }
    })
    expect(errors).toHaveLength(0)
    expect(getSnapshot(boundObject)).toEqual(root.toJSON())
    const valid = getSnapshot(boundObject)
    const invalid = () =>
      transact(() => {
        if (kind !== "map") replace(0, 9)
        if (kind !== "array") pair.set("left", 9)
      })
    invalid()
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(TypeCheckErrorFailure)
    expect(getSnapshot(boundObject)).toEqual(valid)
  }
)

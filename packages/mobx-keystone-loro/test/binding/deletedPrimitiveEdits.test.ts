import { LoroDoc, type LoroMovableList } from "loro-crdt"
import {
  DeepChangeType,
  getSnapshot,
  Model,
  onDeepChange,
  runUnprotected,
  tProp,
  types,
} from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each([0, 1])(
  "edits restore deleted primitive entries with %s native survivors",
  (retained) => {
    @testModel("deleted-primitive-root")
    class Root extends Model({
      flag: tProp(0),
      values: tProp(types.array(types.number), () => [1, 2, 3]),
    }) {}
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    const binding = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: Root,
    })
    const list = root.get("values") as LoroMovableList
    autoDispose(binding.dispose)
    autoDispose(
      onDeepChange(binding.boundObject, (change) => {
        if (change.type === DeepChangeType.ObjectUpdate && change.key === "flag") {
          if (retained === 0) binding.boundObject.values[1] = 8
          binding.boundObject.values[2] = 9
        }
      })
    )
    list.delete(retained, 3 - retained)
    runUnprotected(() => {
      binding.boundObject.flag = 1
    })
    expect(binding.boundObject.values.slice()).toEqual(retained ? [1, 9] : [8, 9])
    expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
  }
)

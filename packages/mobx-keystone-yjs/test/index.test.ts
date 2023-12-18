import {
  AnyDataModel,
  AnyModel,
  JsonPatch,
  Model,
  ModelClass,
  model,
  tProp,
  types,
} from "mobx-keystone"
import * as Y from "yjs"

@model("yjs-test-model")
class TestModel extends Model({
  primitive: tProp(types.number, 0),
  simpleArray: tProp(types.array(types.number), () => []),
  simpleRecord: tProp(types.record(types.number), () => ({})),
  complexArray: tProp(types.array(types.array(types.number)), () => []),
  complexRecord: tProp(types.record(types.record(types.number)), () => ({})),
}) {}

function convertYjsEventToJsonPatch(event: Y.YEvent<any>): void {
  console.log({
    changes: event.changes,
    currentTarget: event.currentTarget,
    delta: event.delta,
    keys: event.keys,
    path: event.path,
    target: event.target,
  })
}

function bindYjsToMobxKeystone(
  yjsModel: Y.Map<unknown>,
  mobxKeystoneModel: AnyModel | AnyDataModel
) {
  yjsModel.observeDeep((events) => {
    events.forEach((event) => {
      convertYjsEventToJsonPatch(event)
    })
  })
}

test("test", () => {
  const doc = new Y.Doc()
  const yTestModel = doc.getMap("testModel")

  const json = yTestModel.toJSON()
  // this generates patches already to set the defaults? how do we sync those? we might need a wrapper model?
  const model = new TestModel(json)

  // yjs -> mobx-keystone
  bindYjsToMobxKeystone(yTestModel, model)

  // mobx-keystone -> yjs
})

// TODO: test bind only array

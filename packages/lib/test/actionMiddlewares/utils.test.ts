import { idProp, Model, prop, tProp, types } from "../../src"
import { pathToTargetPathIds } from "../../src/actionMiddlewares/utils"
import { testModel } from "../utils"

@testModel("PathIdsCodecItem")
class Item extends Model({ id: idProp, value: prop(1) }) {}

@testModel("PathIdsCodecRoot")
class Root extends Model({ entries: tProp(types.mapFromObject(Item)) }) {}

test("path IDs follow stored data through codec-backed model properties", () => {
  const item = new Item({ id: "item-id" })
  const root = new Root({ entries: new Map([["item", item]]) })
  expect(pathToTargetPathIds(root, ["entries", "item", "value"])).toEqual([null, "item-id", null])
})

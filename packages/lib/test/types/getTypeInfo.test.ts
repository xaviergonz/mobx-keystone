import {
  DataModel,
  getTypeInfo,
  Model,
  type ModelTypeInfo,
  type ObjectTypeInfo,
  tProp,
  types,
} from "../../src"
import type { DataModelDataTypeInfo } from "../../src/types/objectBased/typesDataModelData"
import { testModel } from "../utils"

@testModel("SpecialPropertyModelInfo")
class Item extends Model({ ["__proto__"]: tProp(types.number) }) {}

@testModel("SpecialPropertyDataModelInfo")
class DataItem extends DataModel({ ["__proto__"]: tProp(types.number) }) {}

test.each([
  types.object(() => ({ ["__proto__"]: types.number })),
  types.model(Item),
  types.dataModelData(DataItem),
])("type information preserves an own __proto__ property", (type) => {
  const info = getTypeInfo(type) as ObjectTypeInfo | ModelTypeInfo | DataModelDataTypeInfo
  expect(Object.hasOwn(info.props, "__proto__")).toBe(true)
  expect(Object.getPrototypeOf(info.props)).toBe(Object.prototype)
  expect(Reflect.get(info.props, "__proto__").typeInfo).toBe(getTypeInfo(types.number))
})

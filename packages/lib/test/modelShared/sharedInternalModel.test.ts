import { DataModel, Model, TypeCheckErrorFailure, tProp, types } from "../../src"
import { getMobxVersion } from "../../src/utils"
import { testModel } from "../utils"

@testModel("ProtoTypedModel")
class Item extends Model({ ["__proto__"]: tProp(types.number) }) {}

@testModel("ProtoTypedDataModel")
class DataItem extends DataModel({ ["__proto__"]: tProp(types.number) }) {}

test.skipIf(getMobxVersion() === 4).each([Item, DataItem])(
  "%s schemas validate __proto__ properties",
  (ModelClass) => {
    const invalid = { ["__proto__"]: "wrong" } as unknown as { __proto__: number }
    expect(() => new ModelClass(invalid)).toThrow(TypeCheckErrorFailure)
    expect(new ModelClass({ ["__proto__"]: 123 }).typeCheck()).toBeNull()
  }
)

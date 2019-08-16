import { assert, _ } from "spec.ts"
import {
  model,
  Model,
  modelAction,
  modelTypeKey,
  prop,
  SnapshotInOf,
  SnapshotOutOf,
} from "../../src"
import "../commonSetup"

test("factory pattern", () => {
  function createModelClass<TX, TY>(modelName: string, initialX: TX, initialY: TY) {
    @model(`myApp/${modelName}`)
    class MyModel extends Model({
      x: prop<TX>(() => initialX),
      y: prop<TY>(() => initialY),
    }) {
      @modelAction
      setXY(x: TX, y: TY) {
        this.x = x
        this.y = y
      }
    }

    return MyModel
  }

  const NumberMyModel = createModelClass("NumberMyModel", 10, 20)
  type NumberMyModel = InstanceType<typeof NumberMyModel>

  const numberMyModelInstance = new NumberMyModel({}) // this will be of type NumberMyModel
  expect(numberMyModelInstance.$modelType).toBe("myApp/NumberMyModel")
  expect(numberMyModelInstance.x).toBe(10)
  expect(numberMyModelInstance.y).toBe(20)
  numberMyModelInstance.setXY(50, 60)
  expect(numberMyModelInstance.x).toBe(50)
  expect(numberMyModelInstance.y).toBe(60)

  const StringMyModel = createModelClass("StringMyModel", "10", "20")
  type StringMyModel = InstanceType<typeof StringMyModel>

  type SInStr = SnapshotInOf<StringMyModel>
  assert(
    _ as SInStr,
    _ as {
      x?: string
      y?: string
    } & {
      [modelTypeKey]: string
    }
  )

  type SOutStr = SnapshotOutOf<StringMyModel>
  assert(
    _ as SOutStr,
    _ as {
      x: string
      y: string
    } & {
      [modelTypeKey]: string
    }
  )

  const stringMyModelInstance = new StringMyModel({}) // this will be of type StringMyModel
  expect(stringMyModelInstance.$modelType).toBe("myApp/StringMyModel")
  expect(stringMyModelInstance.x).toBe("10")
  expect(stringMyModelInstance.y).toBe("20")
  stringMyModelInstance.setXY("50", "60")
  expect(stringMyModelInstance.x).toBe("50")
  expect(stringMyModelInstance.y).toBe("60")

  type SInNum = SnapshotInOf<NumberMyModel>
  assert(
    _ as SInNum,
    _ as {
      x?: number
      y?: number
    } & {
      [modelTypeKey]: string
    }
  )

  type SOutNum = SnapshotOutOf<NumberMyModel>
  assert(
    _ as SOutNum,
    _ as {
      x: number
      y: number
    } & {
      [modelTypeKey]: string
    }
  )
})

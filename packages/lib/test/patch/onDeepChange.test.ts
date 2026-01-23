import {
  DataModel,
  DeepChange,
  DeepChangeType,
  fromSnapshot,
  Model,
  onDeepChange,
  onGlobalDeepChange,
  prop,
  runUnprotected,
  tProp,
  types,
} from "../../src"
import { autoDispose, testModel } from "../utils"

@testModel("DeepChangeTestModel")
class TestModel extends Model({
  value: prop<number>(0),
  nested: prop<{ key: string } | undefined>(() => ({ key: "initial" })),
  arr: prop<number[]>(() => [1, 2, 3]),
}) {}

describe("onDeepChange", () => {
  test("various change types", () => {
    const model = new TestModel({})
    const changes: DeepChange[] = []

    autoDispose(
      onDeepChange(model, (change) => {
        changes.push(change)
      })
    )

    // Object property update
    runUnprotected(() => {
      model.value = 42
    })
    expect(changes).toStrictEqual([
      {
        type: DeepChangeType.ObjectUpdate,
        target: model.$,
        path: [],
        key: "value",
        newValue: 42,
        oldValue: 0,
        isInit: false,
      },
    ])
    changes.length = 0

    // Nested object property update
    runUnprotected(() => {
      model.nested!.key = "updated"
    })
    expect(changes).toStrictEqual([
      {
        type: DeepChangeType.ObjectUpdate,
        target: model.nested,
        path: ["nested"],
        key: "key",
        newValue: "updated",
        oldValue: "initial",
        isInit: false,
      },
    ])
    changes.length = 0

    // Array splice - push
    runUnprotected(() => {
      model.arr.push(4)
    })
    expect(changes).toStrictEqual([
      {
        type: DeepChangeType.ArraySplice,
        target: model.arr,
        path: ["arr"],
        index: 3,
        addedValues: [4],
        removedValues: [],
        isInit: false,
      },
    ])
    changes.length = 0

    // Array splice - delete from middle
    runUnprotected(() => {
      model.arr.splice(1, 1) // arr is now [1, 3, 4]
    })
    expect(changes).toStrictEqual([
      {
        type: DeepChangeType.ArraySplice,
        target: model.arr,
        path: ["arr"],
        index: 1,
        addedValues: [],
        removedValues: [2],
        isInit: false,
      },
    ])
    changes.length = 0

    // Array splice - insert in middle
    runUnprotected(() => {
      model.arr.splice(1, 0, 10) // arr is now [1, 10, 3, 4]
    })
    expect(changes).toStrictEqual([
      {
        type: DeepChangeType.ArraySplice,
        target: model.arr,
        path: ["arr"],
        index: 1,
        addedValues: [10],
        removedValues: [],
        isInit: false,
      },
    ])
    changes.length = 0

    // Array splice - replace in middle
    runUnprotected(() => {
      model.arr.splice(1, 1, 20) // arr is now [1, 20, 3, 4]
    })
    expect(changes).toStrictEqual([
      {
        type: DeepChangeType.ArraySplice,
        target: model.arr,
        path: ["arr"],
        index: 1,
        addedValues: [20],
        removedValues: [10],
        isInit: false,
      },
    ])
    changes.length = 0

    // Array update (direct index assignment)
    runUnprotected(() => {
      model.arr[0] = 100 // arr is now [100, 20, 3, 4]
    })
    expect(changes).toStrictEqual([
      {
        type: DeepChangeType.ArrayUpdate,
        target: model.arr,
        path: ["arr"],
        index: 0,
        newValue: 100,
        oldValue: 1,
        isInit: false,
      },
    ])
    changes.length = 0
  })

  test("replacing object property", () => {
    const model = new TestModel({})
    const changes: DeepChange[] = []
    const oldNested = model.nested

    autoDispose(
      onDeepChange(model, (change) => {
        changes.push(change)
      })
    )

    runUnprotected(() => {
      model.nested = { key: "new" }
    })

    expect(changes).toStrictEqual([
      {
        type: DeepChangeType.ObjectUpdate,
        target: model.$,
        path: [],
        key: "nested",
        newValue: model.nested,
        oldValue: oldNested,
        isInit: false,
      },
    ])
  })

  test("disposer stops listening", () => {
    const model = new TestModel({})
    const changes: DeepChange[] = []

    const dispose = onDeepChange(model, (change) => {
      changes.push(change)
    })

    runUnprotected(() => {
      model.value = 42
    })
    expect(changes.length).toBe(1)

    dispose()

    runUnprotected(() => {
      model.value = 100
    })
    expect(changes.length).toBe(1) // Still 1, no new changes after dispose
  })
})

describe("onDeepChange with DataModel", () => {
  @testModel("DeepChangeDataModel")
  class TestDataModel extends DataModel({
    value: tProp(types.number, 0),
    arr: tProp(types.array(types.number), () => [1, 2, 3]),
  }) {}

  test("works with data models", () => {
    const model = new TestDataModel({})
    const changes: DeepChange[] = []

    // DataModels need to listen on model.$ (the tree node)
    autoDispose(
      onDeepChange(model.$, (change) => {
        changes.push(change)
      })
    )

    runUnprotected(() => {
      model.value = 42
    })
    expect(changes).toStrictEqual([
      {
        type: DeepChangeType.ObjectUpdate,
        target: model.$,
        path: [],
        key: "value",
        newValue: 42,
        oldValue: 0,
        isInit: false,
      },
    ])
    changes.length = 0

    runUnprotected(() => {
      model.arr.push(4)
    })
    expect(changes).toStrictEqual([
      {
        type: DeepChangeType.ArraySplice,
        target: model.arr,
        path: ["arr"],
        index: 3,
        addedValues: [4],
        removedValues: [],
        isInit: false,
      },
    ])
  })
})

describe("onDeepChange with nested Model", () => {
  @testModel("NestedChildModel")
  class ChildModel extends Model({
    value: prop<number>(0),
  }) {}

  @testModel("NestedParentModel")
  class ParentModel extends Model({
    child: prop<ChildModel>(() => new ChildModel({})),
  }) {}

  test("path does not include $ for nested models", () => {
    const parent = new ParentModel({})
    const changes: DeepChange[] = []

    autoDispose(
      onDeepChange(parent, (change) => {
        changes.push(change)
      })
    )

    runUnprotected(() => {
      parent.child.value = 42
    })

    // Path should be ["child"] not ["child", "$"]
    expect(changes).toStrictEqual([
      {
        type: DeepChangeType.ObjectUpdate,
        target: parent.child.$,
        path: ["child"],
        key: "value",
        newValue: 42,
        oldValue: 0,
        isInit: false,
      },
    ])
  })
})

describe("onDeepChange init changes", () => {
  @testModel("InitInnerModel")
  class InitInnerModel extends Model({
    value: prop<string>(),
    defaultValue: prop<string>(() => "default-inner"),
  }) {
    onInit() {
      // Mutate during init
      this.$.value = this.$.value + "-modified"
    }
  }

  @testModel("InitRootModel")
  class InitRootModel extends Model({
    name: prop<string>(),
    defaultName: prop<string>(() => "default-root"),
    items: prop<InitInnerModel[]>(() => []),
  }) {}

  @testModel("InitInnerModelNoMutation")
  class InitInnerModelNoMutation extends Model({
    value: prop<string>(),
    defaultValue: prop<string>(() => "default-inner"),
  }) {}

  @testModel("InitRootModelNoMutation")
  class InitRootModelNoMutation extends Model({
    name: prop<string>(),
    defaultName: prop<string>(() => "default-root"),
    items: prop<InitInnerModelNoMutation[]>(() => []),
  }) {}

  test("init changes are fired for nested objects in arrays when onInit mutates", () => {
    const initChanges: DeepChange[] = []

    // Listen globally to capture init changes
    const dispose = onGlobalDeepChange((_target, change) => {
      if (change.isInit) {
        initChanges.push(change)
      }
    })

    // Create model with nested items that have onInit mutations
    new InitRootModel({
      name: "test",
      items: [new InitInnerModel({ value: "item1" }), new InitInnerModel({ value: "item2" })],
    })

    dispose()

    // Should have init changes from the onInit mutations in InitInnerModel
    const valueChanges = initChanges.filter(
      (c) => c.type === DeepChangeType.ObjectUpdate && c.key === "value"
    )
    expect(valueChanges.length).toBe(2)
  })

  test("no init changes for nested objects in arrays when onInit does not mutate", () => {
    const initChanges: DeepChange[] = []

    const dispose = onGlobalDeepChange((_target, change) => {
      if (change.isInit) {
        initChanges.push(change)
      }
    })

    // Create model with nested items that do NOT have onInit mutations
    new InitRootModelNoMutation({
      name: "test",
      items: [
        new InitInnerModelNoMutation({ value: "item1" }),
        new InitInnerModelNoMutation({ value: "item2" }),
      ],
    })

    dispose()

    // Should have no init changes since there are no onInit mutations
    // (defaults are applied during construction via new Model(), not fromSnapshot)
    expect(initChanges.length).toBe(0)
  })

  test("fromSnapshot emits init changes for defaults applied", () => {
    @testModel("FromSnapshotDefaultsModel")
    class FromSnapshotDefaultsModel extends Model({
      value: prop<number>(),
      name: prop<string>(() => "default-name"),
      items: prop<number[]>(() => [1, 2, 3]),
    }) {}

    const initChanges: DeepChange[] = []

    const dispose = onGlobalDeepChange((_target, change) => {
      if (change.isInit) {
        initChanges.push(change)
      }
    })

    // Create model from snapshot that is missing some keys (will have defaults applied)
    fromSnapshot(FromSnapshotDefaultsModel, {
      value: 42,
      // name and items are missing, will be filled with defaults
    } as any)

    dispose()

    // Should have init changes for the defaults that were applied
    expect(initChanges.length).toBe(2)

    const nameChange = initChanges.find(
      (c) => c.type === DeepChangeType.ObjectAdd && c.key === "name"
    )
    expect(nameChange).toBeDefined()

    const itemsChange = initChanges.find(
      (c) => c.type === DeepChangeType.ObjectAdd && c.key === "items"
    )
    expect(itemsChange).toBeDefined()
  })

  test("fromSnapshot does not emit init changes when snapshot has all values", () => {
    @testModel("FromSnapshotCompleteModel")
    class FromSnapshotCompleteModel extends Model({
      value: prop<number>(),
      name: prop<string>(() => "default-name"),
    }) {}

    const initChanges: DeepChange[] = []

    const dispose = onGlobalDeepChange((_target, change) => {
      if (change.isInit) {
        initChanges.push(change)
      }
    })

    // Create model from snapshot that has all values (no defaults needed)
    fromSnapshot(FromSnapshotCompleteModel, {
      value: 42,
      name: "provided-name",
    } as any)

    dispose()

    // Should have no init changes since no defaults were applied
    expect(initChanges.length).toBe(0)
  })
})

describe("onGlobalDeepChange", () => {
  @testModel("GlobalDeepChangeTestModel")
  class GlobalTestModel extends Model({
    value: prop<number>(0),
  }) {}

  test("receives changes from any model", () => {
    const model1 = new GlobalTestModel({})
    const model2 = new GlobalTestModel({})
    const changes: { target: object; change: DeepChange }[] = []

    autoDispose(
      onGlobalDeepChange((target, change) => {
        changes.push({ target, change })
      })
    )

    runUnprotected(() => {
      model1.value = 1
    })
    expect(changes.length).toBe(1)

    runUnprotected(() => {
      model2.value = 2
    })
    expect(changes.length).toBe(2)
  })
})

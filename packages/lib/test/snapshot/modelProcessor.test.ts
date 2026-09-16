import { expectTypeOf } from "expect-type"
import { computed, toJS } from "mobx"
import {
  applyPatches,
  applySnapshot,
  type FromSnapshotDefaultType,
  fromSnapshot,
  getSnapshot,
  idProp,
  Model,
  modelAction,
  modelSnapshotInWithMetadata,
  modelSnapshotOutWithMetadata,
  modelTypeKey,
  prop,
  type SnapshotInOf,
  type SnapshotOutOf,
} from "../../src"
import { testModel } from "../utils"

test("input snapshot processor", () => {
  @testModel("customInputSnapshot")
  class P3 extends Model(
    {
      arr: prop<number[]>(() => []),
    },
    {
      fromSnapshotProcessor(sn: { y: string }) {
        return {
          arr: sn.y.split(",").map((x) => +x),
        }
      },
    }
  ) {}

  expectTypeOf<SnapshotInOf<P3>>().toEqualTypeOf<
    {
      y: string
    } & {
      [modelTypeKey]?: string
    }
  >()

  expectTypeOf<SnapshotOutOf<P3>>().toEqualTypeOf<
    {
      arr: number[]
    } & {
      [modelTypeKey]?: string
    }
  >()

  const p = fromSnapshot<P3>(
    modelSnapshotInWithMetadata(P3, {
      y: "30,40,50",
    })
  )

  expect(toJS(p.arr)).toEqual([30, 40, 50])

  applyPatches(p, [
    {
      path: ["arr"],
      op: "replace",
      value: [10, 20],
    },
  ])

  expect(toJS(p.arr)).toEqual([10, 20])

  applySnapshot(
    p,
    modelSnapshotInWithMetadata(P3, {
      y: "100,200",
    })
  )

  expect(toJS(p.arr)).toEqual([100, 200])

  applySnapshot(p.arr, [300, 400])

  expect(toJS(p.arr)).toEqual([300, 400])
})

test("input snapshot processor with original type", () => {
  const props = {
    arr: prop<number[]>(() => []),
  }

  @testModel("customInputSnapshotWithOriginalType")
  class P3 extends Model(props, {
    fromSnapshotProcessor(sn: FromSnapshotDefaultType<typeof props> | { arr: string[] }) {
      return {
        arr: sn.arr?.map((x) => +x),
      }
    },
  }) {}

  expectTypeOf<SnapshotInOf<P3>>().toEqualTypeOf<
    (
      | {
          arr?: number[] | null | undefined
        }
      | {
          arr: string[]
        }
    ) & {
      [modelTypeKey]?: string
    }
  >()

  expectTypeOf<SnapshotOutOf<P3>>().toEqualTypeOf<
    {
      arr: number[]
    } & {
      [modelTypeKey]?: string
    }
  >()

  const p = fromSnapshot<P3>(
    modelSnapshotInWithMetadata(P3, {
      arr: ["30", "40", "50"],
    })
  )

  expect(toJS(p.arr)).toEqual([30, 40, 50])

  applyPatches(p, [
    {
      path: ["arr"],
      op: "replace",
      value: [10, 20],
    },
  ])

  expect(toJS(p.arr)).toEqual([10, 20])

  applySnapshot(
    p,
    modelSnapshotInWithMetadata(P3, {
      arr: ["100", "200"],
    })
  )

  expect(toJS(p.arr)).toEqual([100, 200])

  applySnapshot(p.arr, [300, 400])

  expect(toJS(p.arr)).toEqual([300, 400])
})

test("output snapshot processor", () => {
  @testModel("innerCustomOutputSnapshot")
  class IP4 extends Model(
    {
      arr: prop<number[]>(() => []),
    },
    {
      toSnapshotProcessor(sn, instance) {
        expect(instance instanceof IP4).toBe(true)
        return {
          y: sn.arr.map((x) => String(x)).join(","),
        }
      },
    }
  ) {
    @modelAction
    pop() {
      this.arr.pop()
    }
  }

  @testModel("customOutputSnapshot")
  class P4 extends Model(
    {
      arr: prop<number[]>(() => []),
      child: prop<IP4 | undefined>(),
    },
    {
      toSnapshotProcessor(sn, instance) {
        expect(instance instanceof P4).toBe(true)
        return {
          y: sn.arr.map((x) => String(x)).join(","),
          child: sn.child,
        }
      },
    }
  ) {
    @modelAction
    pop() {
      this.arr.pop()
    }
  }

  expectTypeOf<SnapshotInOf<P4>>().toEqualTypeOf<
    {
      arr?: number[] | null
      child?: SnapshotInOf<IP4>
    } & {
      [modelTypeKey]?: string
    }
  >()

  expectTypeOf<SnapshotOutOf<P4>>().toEqualTypeOf<
    {
      y: string
      child: SnapshotOutOf<IP4> | undefined
    } & {
      [modelTypeKey]?: string
    }
  >()

  const p = new P4({
    arr: [30, 40, 50],
    child: new IP4({
      arr: [1, 2, 3],
    }),
  })

  expect(getSnapshot(p)).toEqual(
    modelSnapshotOutWithMetadata(P4, {
      y: "30,40,50",
      child: modelSnapshotOutWithMetadata(IP4, {
        y: "1,2,3",
      }),
    })
  )

  p.pop()
  p.child!.pop()

  expect(getSnapshot(p)).toEqual(
    modelSnapshotOutWithMetadata(P4, {
      y: "30,40",
      child: modelSnapshotOutWithMetadata(IP4, {
        y: "1,2",
      }),
    })
  )

  applyPatches(p, [
    {
      path: ["arr", 0],
      op: "replace",
      value: 10,
    },
  ])

  expect(getSnapshot(p)).toEqual(
    modelSnapshotOutWithMetadata(P4, {
      y: "10,40",
      child: modelSnapshotOutWithMetadata(IP4, {
        y: "1,2",
      }),
    })
  )

  applySnapshot(p, {
    [modelTypeKey]: "output snapshot processor/customOutputSnapshot",
    arr: [100, 200],
    child: {
      [modelTypeKey]: "output snapshot processor/innerCustomOutputSnapshot",
      arr: [300, 400],
    },
  })

  expect(getSnapshot(p)).toEqual(
    modelSnapshotOutWithMetadata(P4, {
      y: "100,200",
      child: modelSnapshotOutWithMetadata(IP4, {
        y: "300,400",
      }),
    })
  )
})

test("output snapshot processor can access model instance data during creation", () => {
  const toSnapshotProcessorCalls: Array<{ sn: any; modelInstance: any }> = []

  @testModel("outputSnapshotProcessorCanAccessDataDuringCreation")
  class Todo extends Model(
    {
      id: idProp,
      text: prop(""),
    },
    {
      toSnapshotProcessor(sn, modelInstance) {
        toSnapshotProcessorCalls.push({ sn, modelInstance })
        return {
          ...sn,
          idAndText: modelInstance.idAndText,
        }
      },
    }
  ) {
    @computed
    get idAndText() {
      return `${this.id} - ${this.text}`
    }

    @modelAction
    setText(text: string) {
      this.text = text
    }
  }

  const todo = new Todo({
    text: "Hello",
  })

  expect(toSnapshotProcessorCalls).toHaveLength(1)
  expect(toSnapshotProcessorCalls[0].modelInstance).toBe(todo)
  expect(toSnapshotProcessorCalls[0].sn).toEqual({
    [modelTypeKey]: todo[modelTypeKey],
    id: todo.id,
    text: "Hello",
  })

  expect(getSnapshot(todo)).toEqual(
    modelSnapshotOutWithMetadata(Todo, {
      id: todo.id,
      text: "Hello",
      idAndText: `${todo.id} - Hello`,
    })
  )

  // verify snapshot updates after mutation
  todo.setText("World")
  expect(getSnapshot(todo)).toEqual(
    modelSnapshotOutWithMetadata(Todo, {
      id: todo.id,
      text: "World",
      idAndText: `${todo.id} - World`,
    })
  )
})

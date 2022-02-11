import { computed, isComputedProp } from "mobx"
import { assert, _ } from "spec.ts"
import {
  decoratedModel,
  ExtendedModel,
  getSnapshot,
  idProp,
  isModelAction,
  model,
  Model,
  modelAction,
  modelIdKey,
  modelTypeKey,
  prop,
  SnapshotInOf,
  SnapshotOutOf,
} from "../../src"

test("model decorator preserves static properties", () => {
  @model("BarSimple")
  class Bar extends Model({}) {
    static foo = "foo"
  }

  expect(Bar.foo).toBe("foo")
})

test("model decorator preserves static property getters", () => {
  @model("BarWithGetter")
  class Bar extends Model({}) {
    static sideEffectCount = 0
    static get foo() {
      return Bar.sideEffectCount++
    }
  }

  expect(Bar.foo).toBe(0)
  expect(Bar.foo).toBe(1)
})

test("model decorator works with static proxy gymnastics", () => {
  class Bar extends Model({}) {}

  // @ts-ignore
  Bar = new Proxy(Bar, {
    get: (target, key: keyof typeof Bar | "foo") => {
      if (key === "foo") return "oof"
      return target[key]
    },
  })

  // @ts-ignore
  Bar = model("BarWithProxyStuff")(Bar)

  // @ts-ignore
  expect(Bar.foo).toBe("oof")
})

test("model decorator sets model type static prop and toString methods", () => {
  class MyModel extends Model({
    name: prop(() => "hello"),
  }) {
    x: number = 1 // not-stored-properties not rendered
  }

  expect((MyModel as any)[modelTypeKey]).toBeUndefined()

  const type = "com/myModel"
  const MyModel2 = model(type)(MyModel)

  expect((MyModel as any)[modelTypeKey]).toBe(type)
  expect((MyModel2 as any)[modelTypeKey]).toBe(type)

  expect(`${MyModel}`).toBe(`class MyModel#${type}`)
  expect(`${MyModel2}`).toBe(`class MyModel#${type}`)

  const inst = new MyModel2({}) as MyModel
  expect(`${inst}`).toBe(`[MyModel#${type} ${JSON.stringify(getSnapshot(inst))}]`)
  expect(`${inst.toString({ withData: false })}`).toBe(`[MyModel#${type}]`)
})

test("decoratedModel", () => {
  let initCalls = 0

  class _Point<N> extends Model({
    [modelIdKey]: idProp,
    x: prop<number>(5),
    y: prop<number>(),
  }) {
    setX(x: number) {
      this.x = x
    }

    setY = (y: number) => {
      this.y = y
    }

    setXY(x: number, y: number) {
      this.setX(x)
      this.setY(y)
    }

    get length() {
      return this.x + this.y
    }

    volatile = "volatile"
    volatile2!: N

    onInit() {
      initCalls++
    }
  }

  const Point = decoratedModel("decoratedModel/Point", _Point, {
    setX: modelAction,
    setY: modelAction,
    setXY: [modelAction],
    length: computed,
  })
  // eslint-disable-next-line @typescript-eslint/no-redeclare
  type Point<N> = _Point<N>

  {
    expect(isModelAction(Point.prototype.setX)).toBeTruthy()
    expect(Point.prototype.setY).toBeUndefined()
    expect(isModelAction(Point.prototype.setXY)).toBeTruthy()

    expect(initCalls).toBe(0)
    const p: Point<number> = new Point<number>({ x: 10, y: 20 })
    expect(initCalls).toBe(1)
    expect(isModelAction(p.setX)).toBeTruthy()
    expect(isModelAction(p.setY)).toBeTruthy()
    expect(isModelAction(p.setXY)).toBeTruthy()
    expect(isComputedProp(p, "length"))

    expect(p.x).toBe(10)
    expect(p.y).toBe(20)
    expect(p.length).toBe(30)
    expect(p.volatile).toBe("volatile")
    assert(p.volatile2, _ as number)

    p.setXY(20, 30)
    expect(p.x).toBe(20)
    expect(p.y).toBe(30)
    expect(p.length).toBe(50)

    type SIPn = SnapshotInOf<Point<number>>
    assert(
      _ as SIPn,
      _ as {
        $modelId?: string | undefined
        x?: number | null | undefined
        y: number
      } & {
        [modelTypeKey]?: string
      }
    )

    type SOPn = SnapshotOutOf<Point<number>>
    assert(
      _ as SOPn,
      _ as {
        $modelId: string
        x: number
        y: number
      } & {
        [modelTypeKey]?: string
      }
    )
  }

  // extension

  class _Point3d extends ExtendedModel(Point, {
    z: prop<number>(),
  }) {
    setZ(z: number) {
      this.z = z
    }

    setXYZ(x: number, y: number, z: number) {
      super.setXY(x, y)
      this.setZ(z)
    }

    // we rename the prop since mobx6 does not support computed prop override
    get length3d() {
      return this.x + this.y + this.z
    }
  }

  const Point3d = decoratedModel("decoratedModel/Point3d", _Point3d, {
    setZ: modelAction,
    setXYZ: modelAction,
    length3d: computed,
  })
  // eslint-disable-next-line @typescript-eslint/no-redeclare
  type Point3d = _Point3d

  {
    expect(isModelAction(Point3d.prototype.setX)).toBeTruthy()
    expect(Point3d.prototype.setY).toBeUndefined()
    expect(isModelAction(Point3d.prototype.setXY)).toBeTruthy()
    expect(isModelAction(Point3d.prototype.setZ)).toBeTruthy()
    expect(isModelAction(Point3d.prototype.setXYZ)).toBeTruthy()

    const p2: Point3d = new Point3d({ x: 10, y: 20, z: 30 })
    expect(isModelAction(p2.setX)).toBeTruthy()
    expect(isModelAction(p2.setY)).toBeTruthy()
    expect(isModelAction(p2.setXY)).toBeTruthy()
    expect(isModelAction(p2.setZ)).toBeTruthy()
    expect(isModelAction(p2.setXYZ)).toBeTruthy()
    expect(isComputedProp(p2, "length3d")).toBeTruthy()

    expect(p2.x).toBe(10)
    expect(p2.y).toBe(20)
    expect(p2.z).toBe(30)
    expect(p2.length3d).toBe(60)
    expect(p2.volatile).toBe("volatile")
    assert(p2.volatile2, _ as unknown) // known issue, no way to specify generic for base class

    p2.setXYZ(20, 30, 40)
    expect(p2.x).toBe(20)
    expect(p2.y).toBe(30)
    expect(p2.z).toBe(40)
    expect(p2.length3d).toBe(90)

    type SIP3d = SnapshotInOf<Point3d>
    assert(
      _ as SIP3d,
      _ as {
        $modelId?: string | undefined
        x?: number | null | undefined
        y: number
        z: number
      } & {
        [modelTypeKey]?: string
      }
    )

    type SOP3d = SnapshotOutOf<Point3d>
    assert(
      _ as SOP3d,
      _ as {
        $modelId: string
        x: number
        y: number
        z: number
      } & {
        [modelTypeKey]?: string
      }
    )
  }
})

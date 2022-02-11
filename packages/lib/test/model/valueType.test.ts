import { Model, model, modelAction, prop } from "../../src"

test("value type", () => {
  @model("P")
  class P extends Model(
    {
      x: prop(1),
      y: prop(2),
    },
    { valueType: true }
  ) {
    @modelAction
    setXY(x: number, y: number) {
      this.x = x
      this.y = y
    }
  }

  @model("R")
  class R extends Model({
    p_prop: prop<P | undefined>(),
    p_arr: prop<P[]>(() => []),
    p_obj: prop<{ p?: P }>(() => ({})),
  }) {
    @modelAction
    setProp(p: P | undefined) {
      this.p_prop = p
      return this.p_prop
    }

    @modelAction
    arrPush(p: P) {
      this.p_arr.push(p)
      return this.p_arr[this.p_arr.length - 1]
    }

    @modelAction
    arrPop() {
      return this.p_arr.pop()
    }

    @modelAction
    objSet(p: P | undefined) {
      this.p_obj.p = p
      return this.p_obj.p
    }
  }

  const r = new R({})

  const p1 = new P({})

  expect(p1.x).toBe(1)
  expect(p1.y).toBe(2)

  p1.setXY(10, 20)
  expect(p1.x).toBe(10)
  expect(p1.y).toBe(20)

  const expectClonedValueType = (pOther: P, where: () => P) => {
    expect(pOther).not.toBe(p1)
    expect(pOther).toBe(where())
    expect(pOther.x).toBe(10)
    expect(pOther.y).toBe(20)
    return pOther
  }

  expectClonedValueType(r.setProp(p1)!, () => r.p_prop!)

  const p3 = expectClonedValueType(r.arrPush(p1)!, () => r.p_arr[r.p_arr.length - 1])

  const p3_2 = r.arrPop()
  expect(p3_2).toBe(p3)

  expectClonedValueType(r.objSet(p1)!, () => r.p_obj.p!)
})

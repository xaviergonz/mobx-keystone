import { computed } from "mobx"
import { Model, modelAction, prop, resolvePath } from "../../src"
import { resolvePathCheckingIds } from "../../src/parent/path"
import { testModel } from "../utils"

test("ID-checked array paths distinguish absent properties from undefined elements", () => {
  const array = [undefined]
  for (const key of [-1, 0.5, Number.NaN, "missing"]) {
    expect(resolvePathCheckingIds(array, [key], [null])).toEqual({ resolved: false })
  }
  expect(resolvePathCheckingIds(array, [0], [null])).toEqual({ resolved: true, value: undefined })
})

test("ID-checked array paths only resolve indexes", () => {
  const root = { items: [1, 2] }
  for (const key of ["length", "map", "-0", "01", "1.0"]) {
    expect(resolvePathCheckingIds(root, ["items", key], [null, null])).toEqual({
      resolved: false,
    })
  }
  expect(resolvePathCheckingIds(root, ["items", "1"], [null, null])).toEqual({
    resolved: true,
    value: 2,
  })
})

test("missing properties do not resolve as present undefined values", () => {
  const node = { child: { present: undefined } }
  expect(resolvePath(node, ["child", "missing"])).toEqual({ resolved: false })
  expect(resolvePath(node, ["child", "present"])).toEqual({ resolved: true, value: undefined })
})

test("resolvePath only resolves own data, array indexes and model getters", () => {
  @testModel("ResolvePathHardening")
  class M extends Model({ items: prop<number[]>(() => [1, 2]), obj: prop(() => ({ a: 1 })) }) {
    field = "f"

    @computed
    get double() {
      return this.items.length * 2
    }

    @modelAction
    act() {}

    method() {}
  }

  const m = new M({})

  for (const path of [
    ["items", "length"],
    ["items", "map"],
    ["obj", "constructor"],
    ["obj", "__proto__"],
    ["obj", "toString"],
    ["constructor"],
    ["__proto__"],
    ["toString"],
    ["act"],
    ["method"],
  ]) {
    expect(resolvePath(m, path)).toEqual({ resolved: false })
  }

  expect(resolvePath(m, ["items", 1])).toEqual({ resolved: true, value: 2 })
  expect(resolvePath(m, ["obj", "a"])).toEqual({ resolved: true, value: 1 })
  expect(resolvePath(m, ["items"])).toEqual({ resolved: true, value: m.items })
  expect(resolvePath(m, ["field"])).toEqual({ resolved: true, value: "f" })
  expect(resolvePath(m, ["double"])).toEqual({ resolved: true, value: 4 })
})

import { resolvePath } from "../../src"
import { resolvePathCheckingIds } from "../../src/parent/path"

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

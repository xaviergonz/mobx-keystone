import { set } from "mobx"
import { arrayActions, fnModel } from "../../src/standardActions"
import "../commonSetup"

const _customArrayActions = fnModel<unknown[]>("mobx-keystone/customArrayActions").actions({
  set(index: number, value: any): void {
    set(this, index, value)
  },
  swap(indexA, indexB: number): void {
    if (indexA < 0 || indexB < 0 || indexA > this.length - 1 || indexB > this.length - 1) {
      return
    }
    var tmp1 = this[indexA]
    var tmp2 = this[indexB]
    set(this, indexA, null)
    set(this, indexB, null)
    set(this, indexA, tmp2)
    set(this, indexB, tmp1)
  },
})

export const customArrayActions = {
  swap: _customArrayActions.swap as <T>(array: T[], indexA: number, indexB: number) => void,
}

test("customArrayActions.swap", () => {
  const arr = arrayActions.create([1, 2, 3])
  expect(arr[0]).toBe(1)
  expect(arr.length).toBe(3)

  customArrayActions.swap(arr, 0, 1)
  expect(arr).toStrictEqual([2, 1, 3])
})

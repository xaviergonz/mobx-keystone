import { computed, isObservableArray, reaction } from "mobx"
import { getChildrenObjects, Model, prop, runUnprotected } from "../../src"
import { autoDispose, testModel } from "../utils"

@testModel("C")
class C extends Model({ id: prop<string>(), children: prop<C[] | undefined>(undefined) }) {}

const deep = true

test(`getChildrenObjects {deep: ${deep}}`, () => {
  const getChildren = (n: object) => getChildrenObjects(n, { deep })

  const c = new C({
    id: "1",
    children: [
      new C({
        id: "1-1",
        children: [new C({ id: "1-1-1" }), new C({ id: "1-1-2" })],
      }),
      new C({
        id: "1-2",
        children: [new C({ id: "1-2-1" }), new C({ id: "1-2-2" })],
      }),
      new C({
        id: "1-3",
        children: [new C({ id: "1-3-1" }), new C({ id: "1-3-2" })],
      }),
    ],
  })

  const getChildrenIds = (n: any) =>
    [...getChildren(n).values()].map((n2: any) => (isObservableArray(n2) ? "array" : n2.id))

  const initialChildren = getChildren(c)
  const initialChildren1 = getChildren(c.children![0])
  const initialChildren3 = getChildren(c.children![2])

  let childrenChanges = 0
  let children1Changes = 0
  let children3Changes = 0

  autoDispose(
    reaction(
      () => getChildren(c),
      () => {
        childrenChanges++
      }
    )
  )
  autoDispose(
    reaction(
      () => getChildren(c.children![0]),
      () => {
        children1Changes++
      }
    )
  )
  const children3 = c.children![2]
  const computedChildren3 = computed(() => getChildren(children3))
  autoDispose(
    reaction(
      () => computedChildren3.get(),
      () => {
        children3Changes++
      }
    )
  )

  const expectChildrenChanges = (c: number, c1: number, c3: number) => {
    expect(childrenChanges).toBe(c)
    expect(children1Changes).toBe(c1)
    expect(children3Changes).toBe(c3)
    childrenChanges = 0
    children1Changes = 0
    children3Changes = 0
  }

  // should always return the same set when unchanged
  expect(getChildren(c)).toBe(initialChildren)
  expect(getChildren(c)).toBe(initialChildren)
  expect(getChildren(c.children![0])).toBe(initialChildren1)
  expect(getChildren(c.children![0])).toBe(initialChildren1)
  expect(getChildren(c.children![2])).toBe(initialChildren3)
  expect(getChildren(c.children![2])).toBe(initialChildren3)

  expect(getChildrenIds(c)).toMatchSnapshot("initial")
  expectChildrenChanges(0, 0, 0)

  // delete some
  let deleted!: C
  runUnprotected(() => {
    deleted = c.children!.pop()!
  })

  expect(getChildrenIds(c)).toMatchSnapshot("after delete")
  expectChildrenChanges(1, 0, 0)

  // add them back
  runUnprotected(() => {
    c.children!.push(deleted)
  })

  expect(getChildrenIds(c)).toMatchSnapshot("after re-add")
  expectChildrenChanges(1, 0, 0)
})

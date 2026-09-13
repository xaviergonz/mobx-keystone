import { observable, runInAction } from "mobx"
import { customRef, getRefsResolvingTo, toTreeNode } from "../../src"

test("reference callbacks receive the previous resolved target", () => {
  const first = toTreeNode({ id: "first" })
  const second = toTreeNode({ id: "second" })
  const selected = observable.box(first, { deep: false })
  const changed = vi.fn()
  const makeRef = customRef<{ id: string }>("PreviousResolvedTarget", {
    resolve: () => selected.get(),
    getId: (target) => (target as { id: string }).id,
    onResolvedValueChange: changed,
  })
  const ref = makeRef(first)
  runInAction(() => selected.set(second))
  expect(changed.mock.calls[0][0] === ref).toBe(true)
  expect(changed.mock.calls[0][1] === second).toBe(true)
  expect(changed.mock.calls[0][2] === first).toBe(true)
  runInAction(() => selected.set(first))
  expect(changed.mock.calls[1][0] === ref).toBe(true)
  expect(changed.mock.calls[1][1] === first).toBe(true)
  expect(changed.mock.calls[1][2] === second).toBe(true)
})

test("back references use the target from the first deferred tracking run", () => {
  const first = toTreeNode({ id: "first" })
  const second = toTreeNode({ id: "second" })
  const selected = observable.box(first, { deep: false })
  const changed = vi.fn()
  const makeRef = customRef<{ id: string }>("DeferredBackRefs", {
    resolve: () => selected.get(),
    getId: (target) => (target as { id: string }).id,
    onResolvedValueChange: changed,
  })
  const ref = runInAction(() => {
    const ref = makeRef(first)
    selected.set(second)
    return ref
  })

  expect(ref.current).toBe(second)
  expect(getRefsResolvingTo(first).has(ref)).toBe(false)
  expect(getRefsResolvingTo(second).has(ref)).toBe(true)
  expect(changed).not.toHaveBeenCalled()

  runInAction(() => selected.set(first))
  expect(getRefsResolvingTo(second).has(ref)).toBe(false)
  expect(getRefsResolvingTo(first).has(ref)).toBe(true)
  expect(changed).toHaveBeenCalledWith(ref, first, second)
})

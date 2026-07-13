import {
  addMutationBatchFinisher,
  finishMutationBatch,
  isMutationBatchActive,
  startMutationBatch,
} from "../../src/action/mutationBatch"

test("nested mutation boundaries share one batch and finish in reverse order", () => {
  expect(startMutationBatch()).toBe(true)
  expect(startMutationBatch()).toBe(false)

  const events: number[] = []
  addMutationBatchFinisher(() => events.push(1))
  addMutationBatchFinisher(() => events.push(2))

  finishMutationBatch()

  expect(events).toEqual([2, 1])
  expect(isMutationBatchActive()).toBe(false)
})

test("a throwing finisher cannot leak mutation batch state", () => {
  expect(startMutationBatch()).toBe(true)
  addMutationBatchFinisher(() => {
    throw new Error("expected")
  })

  expect(() => finishMutationBatch()).toThrow("expected")
  expect(isMutationBatchActive()).toBe(false)

  expect(startMutationBatch()).toBe(true)
  finishMutationBatch()
})

test("a throwing finisher does not prevent the remaining finishers from running", () => {
  expect(startMutationBatch()).toBe(true)

  const events: number[] = []
  addMutationBatchFinisher(() => events.push(1))
  addMutationBatchFinisher(() => {
    events.push(2)
    throw new Error("expected")
  })

  // finishers run in reverse registration order, so the throwing one runs first
  expect(() => finishMutationBatch()).toThrow("expected")

  expect(events).toEqual([2, 1])
  expect(isMutationBatchActive()).toBe(false)
})

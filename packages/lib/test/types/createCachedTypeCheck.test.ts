import { isObservableArray } from "mobx"
import { runUnprotected, TypeCheckError, toTreeNode, typeCheck, types } from "../../src"

test.each(["array", "object", "record"] as const)(
  "cached %s checks retain custom model trails after invalidation",
  (kind) => {
    const itemType = types.refinement(types.number, (value) =>
      value >= 0
        ? null
        : new TypeCheckError({
            path: [],
            expectedTypeName: "positive",
            actualValue: value,
            modelTrail: ["Custom"],
          })
    )
    const type =
      kind === "array"
        ? types.array(itemType)
        : kind === "record"
          ? types.record(itemType)
          : types.object(() => ({ value: itemType }))
    const value = kind === "array" ? toTreeNode([-1]) : toTreeNode({ value: -1 })
    expect(typeCheck(type, value)?.modelTrail).toEqual(["Custom"])
    runUnprotected(() => {
      if (Array.isArray(value) || isObservableArray(value)) value[0] = -2
      else value.value = -2
    })
    expect(typeCheck(type, value)?.modelTrail).toEqual(["Custom"])
  }
)

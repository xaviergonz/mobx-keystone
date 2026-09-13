import { TypeCheckError, typeCheck, types } from "../../../src"

test.each([false, true])(
  "custom refinement errors retain their model trail (nested: %s)",
  (nested) => {
    const refined = types.refinement(
      types.number,
      (value) =>
        new TypeCheckError({
          path: [],
          expectedTypeName: "positive",
          actualValue: value,
          modelTrail: ["CustomModel"],
        })
    )
    const error = nested ? typeCheck(types.array(refined), [-1]) : typeCheck(refined, -1)
    expect(error?.modelTrail).toEqual(["CustomModel"])
    expect(error?.path).toEqual(nested ? [0] : [])
  }
)

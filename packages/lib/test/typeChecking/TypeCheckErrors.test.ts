import dedent from "dedent"
import {
  createTypeCheckError,
  getTypeCheckErrorMessage,
  isTypeCheckErrorExpression,
  mergeTypeCheckErrors,
  transformTypeCheckErrors,
  TypeCheckErrors,
} from "../../src"
import { ReadonlyNonEmptyArray } from "../../src/utils/types"

test("createTypeCheckError", () => {
  expect(createTypeCheckError(["x"], "number", "1")).toEqual({
    path: ["x"],
    expectedTypeName: "number",
    actualValue: "1",
  })
})

test("isTypeCheckErrorExpression", () => {
  expect(
    isTypeCheckErrorExpression(
      mergeTypeCheckErrors("and", [
        createTypeCheckError(["x"], "number", "1"),
        createTypeCheckError(["y"], "number", "1"),
      ])
    )
  ).toBeTruthy()

  expect(isTypeCheckErrorExpression(createTypeCheckError(["x"], "number", "1"))).toBeFalsy()
})

describe("mergeTypeCheckErrors", () => {
  test("one argument", () => {
    const error = createTypeCheckError([], "number", "abc")
    expect(mergeTypeCheckErrors("and", [error])).toEqual(error)
  })

  test("two arguments (not same operator)", () => {
    const errors: ReadonlyNonEmptyArray<TypeCheckErrors> = [
      createTypeCheckError(["x"], "number", "x"),
      mergeTypeCheckErrors("or", [
        createTypeCheckError(["y"], "number", "y"),
        createTypeCheckError(["y"], "undefined", "y"),
      ]),
    ]
    expect(mergeTypeCheckErrors("and", errors)).toEqual({ op: "and", args: errors })
  })

  test("two arguments (same operator)", () => {
    expect(
      mergeTypeCheckErrors("and", [
        createTypeCheckError(["x"], "number", "x"),
        mergeTypeCheckErrors("and", [
          createTypeCheckError(["y", "a"], "number", "a"),
          createTypeCheckError(["y", "b"], "number", "b"),
        ]),
      ])
    ).toEqual(
      mergeTypeCheckErrors("and", [
        createTypeCheckError(["x"], "number", "x"),
        createTypeCheckError(["y", "a"], "number", "a"),
        createTypeCheckError(["y", "b"], "number", "b"),
      ])
    )
  })
})

test("transformTypeCheckErrors", () => {
  expect(
    transformTypeCheckErrors(
      mergeTypeCheckErrors("and", [
        createTypeCheckError(["x"], "number", "1"),
        createTypeCheckError(["y"], "number", "2"),
      ]),
      // Filter errors with path `["x"]`.
      (error) => (error.path[0] === "x" ? error : null)
    )
  ).toEqual(createTypeCheckError(["x"], "number", "1"))
})

describe("getTypeCheckErrorMessage", () => {
  test("single error", () => {
    expect(getTypeCheckErrorMessage(createTypeCheckError([], "number", "abc"), "abc")).toBe(
      "[/] Expected: number"
    )
  })

  test("error expression - simple", () => {
    expect(
      getTypeCheckErrorMessage(
        mergeTypeCheckErrors("and", [
          createTypeCheckError(["x"], "number", "x"),
          createTypeCheckError(["y"], "number", "y"),
        ]),
        {
          x: "x",
          y: "y",
        }
      )
    ).toBe(
      dedent`
      AND
      ├─ [/x] Expected: number
      └─ [/y] Expected: number
      `
    )
  })

  test("error expression - complex", () => {
    expect(
      getTypeCheckErrorMessage(
        mergeTypeCheckErrors("or", [
          mergeTypeCheckErrors("and", [
            createTypeCheckError(["kind"], `"float"`, `"boolean"`),
            createTypeCheckError(["value"], "number", true),
          ]),
          mergeTypeCheckErrors("and", [
            createTypeCheckError(["kind"], `"int"`, `"boolean"`),
            createTypeCheckError(["value"], "integer<number>", true),
          ]),
        ]),
        {
          kind: "boolean",
          value: true,
        }
      )
    ).toBe(
      dedent`
      OR
      ├─ AND
      │  ├─ [/kind] Expected: "float"
      │  └─ [/value] Expected: number
      └─ AND
         ├─ [/kind] Expected: "int"
         └─ [/value] Expected: integer<number>
      `
    )
  })
})

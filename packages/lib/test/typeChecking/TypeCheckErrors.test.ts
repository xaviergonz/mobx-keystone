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
    const error: TypeCheckErrors = {
      path: [],
      expectedTypeName: "number",
      actualValue: "abc",
    }
    expect(mergeTypeCheckErrors("and", [error])).toStrictEqual(error)
  })

  test("two arguments (not same operator)", () => {
    const errors: ReadonlyNonEmptyArray<TypeCheckErrors> = [
      {
        path: ["x"],
        expectedTypeName: "number",
        actualValue: "x",
      },
      {
        op: "or",
        args: [
          {
            path: ["y"],
            expectedTypeName: "number",
            actualValue: "y",
          },
          {
            path: ["y"],
            expectedTypeName: "undefined",
            actualValue: "y",
          },
        ],
      },
    ]
    expect(mergeTypeCheckErrors("and", errors)).toStrictEqual({ op: "and", args: errors })
  })

  test("two arguments (same operator)", () => {
    expect(
      mergeTypeCheckErrors("and", [
        {
          path: ["x"],
          expectedTypeName: "number",
          actualValue: "x",
        },
        {
          op: "and",
          args: [
            {
              path: ["y", "a"],
              expectedTypeName: "number",
              actualValue: "a",
            },
            {
              path: ["y", "b"],
              expectedTypeName: "number",
              actualValue: "b",
            },
          ],
        },
      ])
    ).toStrictEqual({
      op: "and",
      args: [
        {
          path: ["x"],
          expectedTypeName: "number",
          actualValue: "x",
        },
        {
          path: ["y", "a"],
          expectedTypeName: "number",
          actualValue: "a",
        },
        {
          path: ["y", "b"],
          expectedTypeName: "number",
          actualValue: "b",
        },
      ],
    })
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
    expect(
      getTypeCheckErrorMessage(
        {
          path: [],
          expectedTypeName: "number",
          actualValue: "abc",
        },
        "abc"
      )
    ).toBe("[/] Expected: number")
  })

  test("error expression - simple", () => {
    expect(
      getTypeCheckErrorMessage(
        {
          op: "and",
          args: [
            {
              path: ["x"],
              expectedTypeName: "number",
              actualValue: "x",
            },
            {
              path: ["y"],
              expectedTypeName: "number",
              actualValue: "y",
            },
          ],
        },
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
        {
          op: "or",
          args: [
            {
              op: "and",
              args: [
                {
                  path: ["kind"],
                  expectedTypeName: '"float"',
                  actualValue: '"boolean"',
                },
                {
                  path: ["value"],
                  expectedTypeName: "number",
                  actualValue: true,
                },
              ],
            },
            {
              op: "and",
              args: [
                {
                  path: ["kind"],
                  expectedTypeName: '"int"',
                  actualValue: '"boolean"',
                },
                {
                  path: ["value"],
                  expectedTypeName: "integer<number>",
                  actualValue: true,
                },
              ],
            },
          ],
        },
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

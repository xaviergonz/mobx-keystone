import { types } from "../../../src"
import { resolveTypeChecker } from "../../../src/types/resolveTypeChecker"
import { TypeChecker, TypeCheckerBaseType } from "../../../src/types/TypeChecker"

const processedType = new TypeChecker(
  TypeCheckerBaseType.Any,
  () => null,
  () => "processed",
  () => undefined as never,
  () => processedType,
  (value) => ({ value }),
  (value) => value.value
)

test.each([
  types.record(processedType as never),
  types.object(() => ({ ["__proto__"]: processedType as never })),
])("snapshot processors preserve own __proto__ properties", (type) => {
  const checker = resolveTypeChecker(type)
  const input = { ["__proto__"]: 123 }
  const processed = checker.fromSnapshotProcessor(input) as Record<string, unknown>
  expect(Object.getPrototypeOf(processed)).toBe(Object.prototype)
  expect(Object.keys(processed)).toEqual(["__proto__"])
  expect(Object.getOwnPropertyDescriptor(processed, "__proto__")?.value).toEqual({ value: 123 })
  const output = checker.toSnapshotProcessor(processed)
  expect(Object.getPrototypeOf(output)).toBe(Object.prototype)
  expect(output).toEqual(input)
})

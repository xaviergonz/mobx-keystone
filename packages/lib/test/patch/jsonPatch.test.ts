import { jsonPatchToPatch, jsonPointerToPath, patchToJsonPatch, pathToJsonPointer } from "../../src"

test("JSON path conversion", () => {
  expect(pathToJsonPointer([])).toEqual("")
  expect(jsonPointerToPath("")).toEqual([])

  expect(pathToJsonPointer([""])).toEqual("/")
  expect(jsonPointerToPath("/")).toEqual([""])

  expect(pathToJsonPointer(["abc"])).toEqual("/abc")
  expect(jsonPointerToPath("/abc")).toEqual(["abc"])

  expect(pathToJsonPointer(["abc", "def"])).toEqual("/abc/def")
  expect(jsonPointerToPath("/abc/def")).toEqual(["abc", "def"])

  expect(pathToJsonPointer([123, 456])).toEqual("/123/456")
  expect(jsonPointerToPath("/123/456")).toEqual(["123", "456"])

  expect(pathToJsonPointer(["/a"])).toEqual("/~1a")
  expect(jsonPointerToPath("/~1a")).toEqual(["/a"])

  expect(pathToJsonPointer(["~a"])).toEqual("/~0a")
  expect(jsonPointerToPath("/~0a")).toEqual(["~a"])
})

test("JSON patch conversion", () => {
  expect(jsonPatchToPatch({ path: "/abc", op: "remove" })).toEqual({
    path: ["abc"],
    op: "remove",
  })

  expect(
    patchToJsonPatch({
      path: ["abc"],
      op: "remove",
    })
  ).toEqual({ path: "/abc", op: "remove" })
})

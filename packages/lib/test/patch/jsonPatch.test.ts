import { jsonPatchToPatch, jsonPathToPath, patchToJsonPatch, pathToJsonPath } from "../../src"
import "../commonSetup"

test("JSON path conversion", () => {
  expect(pathToJsonPath([])).toEqual("")
  expect(jsonPathToPath("")).toEqual([])

  expect(pathToJsonPath([""])).toEqual("/")
  expect(jsonPathToPath("/")).toEqual([""])

  expect(pathToJsonPath(["abc"])).toEqual("/abc")
  expect(jsonPathToPath("/abc")).toEqual(["abc"])

  expect(pathToJsonPath(["abc", "def"])).toEqual("/abc/def")
  expect(jsonPathToPath("/abc/def")).toEqual(["abc", "def"])

  expect(pathToJsonPath([123, 456])).toEqual("/123/456")
  expect(jsonPathToPath("/123/456")).toEqual(["123", "456"])

  expect(pathToJsonPath(["/a"])).toEqual("/~1a")
  expect(jsonPathToPath("/~1a")).toEqual(["/a"])

  expect(pathToJsonPath(["~a"])).toEqual("/~0a")
  expect(jsonPathToPath("/~0a")).toEqual(["~a"])
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

import { Path } from "../parent/pathTypes"
import { failure } from "../utils"
import { Patch } from "./Patch"

export type JsonPatch =
  | JsonPatchAddOperation<any>
  | JsonPatchRemoveOperation
  | JsonPatchReplaceOperation<any>

export interface JsonPatchBaseOperation {
  path: string
}

export interface JsonPatchAddOperation<T> extends JsonPatchBaseOperation {
  op: "add"
  value: T
}

export interface JsonPatchRemoveOperation extends JsonPatchBaseOperation {
  op: "remove"
}

export interface JsonPatchReplaceOperation<T> extends JsonPatchBaseOperation {
  op: "replace"
  value: T
}

/**
 * Escapes a json pointer path.
 *
 * @param path The raw pointer
 * @return the Escaped path
 */
function escapePathComponent(path: string | number): string {
  if (typeof path === "number") {
    return "" + path
  }
  if (path.indexOf("/") === -1 && path.indexOf("~") === -1) {
    return path
  }
  return path.replace(/~/g, "~0").replace(/\//g, "~1")
}

/**
 * Unescapes a json pointer path.
 *
 * @param path The escaped pointer
 * @return The unescaped path
 */
function unescapePathComponent(path: string): string {
  return path.replace(/~1/g, "/").replace(/~0/g, "~")
}

/**
 * Converts a path into a JSON path.
 *
 * @param path Path to convert.
 * @returns Converted path.
 */
export function pathToJsonPath(path: Path): string {
  if (path.length <= 0) {
    return ""
  }
  return "/" + path.map(escapePathComponent).join("/")
}

/**
 * Converts a JSON path into a path.
 *
 * @param jsonPath Path to convert.
 * @returns Converted path.
 */
export function jsonPathToPath(jsonPath: string): Path {
  if (jsonPath === "") {
    return []
  }
  if (!jsonPath.startsWith("/")) {
    throw failure("a JSON path must start with '/' or be empty")
  }
  jsonPath = jsonPath.slice(1)
  return jsonPath.split("/").map(unescapePathComponent)
}

/**
 * Convert a patch into a JSON patch.
 *
 * @param patch A patch.
 * @returns A JSON patch.
 */
export function patchToJsonPatch(patch: Patch): JsonPatch {
  return {
    ...patch,
    path: pathToJsonPath(patch.path),
  }
}

/**
 * Converts a JSON patch into a patch.
 *
 * @param jsonPatch A JSON patch.
 * @returns A patch.
 */
export function jsonPatchToPatch(jsonPatch: JsonPatch): Patch {
  return {
    ...jsonPatch,
    path: jsonPathToPath(jsonPatch.path),
  }
}

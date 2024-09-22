import type { Path } from "../parent/pathTypes"
import { failure } from "../utils"
import type { Patch } from "./Patch"

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
    return String(path)
  }
  if (!(path.includes("/") || path.includes("~"))) {
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
 * Converts a path into a JSON pointer.
 *
 * @param path Path to convert.
 * @returns Converted JSON pointer.
 */
export function pathToJsonPointer(path: Path): string {
  if (path.length <= 0) {
    return ""
  }
  return "/" + path.map(escapePathComponent).join("/")
}

/**
 * Converts a JSON pointer into a path.
 *
 * @param jsonPointer JSON pointer to convert.
 * @returns Converted path.
 */
export function jsonPointerToPath(jsonPointer: string): Path {
  if (jsonPointer === "") {
    return []
  }
  if (!jsonPointer.startsWith("/")) {
    throw failure("a JSON pointer must start with '/' or be empty")
  }
  jsonPointer = jsonPointer.slice(1)
  return jsonPointer.split("/").map(unescapePathComponent)
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
    path: pathToJsonPointer(patch.path),
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
    path: jsonPointerToPath(jsonPatch.path),
  }
}

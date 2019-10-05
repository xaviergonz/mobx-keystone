import { Path } from "../parent/pathTypes"

export interface Patch {
  readonly op: "replace" | "remove" | "add"
  readonly path: Path
  readonly value?: any
}

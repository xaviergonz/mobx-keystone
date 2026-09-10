import { jsonEquals } from "@mobx-keystone/crdt-binding-common"
import * as Y from "yjs"

/**
 * The append-only delta history kept by a `YjsTextModel`, either as live
 * `Frozen` instances or as their frozen snapshots.
 * @internal
 */
export type TextDeltaHistory = readonly { readonly data: readonly unknown[] }[]

/**
 * Replay a delta history in a scratch document and read back the result.
 */
function replayHistory<T>(deltaList: TextDeltaHistory, read: (text: Y.Text) => T): T {
  const doc = new Y.Doc()
  try {
    const text = doc.getText()
    doc.transact(() => {
      for (const delta of deltaList) text.applyDelta(delta.data as unknown[])
    })
    return read(text)
  } finally {
    doc.destroy()
  }
}

/**
 * Replay history once to obtain its current content and formatting.
 * @internal
 */
export function textDeltaFromHistory(deltaList: TextDeltaHistory): unknown[] {
  return replayHistory(deltaList, (text) => text.toDelta())
}

/**
 * Replay history once to obtain its current plain text.
 * @internal
 */
export function textFromHistory(deltaList: TextDeltaHistory): string {
  return replayHistory(deltaList, (text) => text.toString())
}

/**
 * Replace a Y.Text with the content produced by a delta history, leaving it
 * untouched when it already matches.
 * @internal
 */
export function replaceYjsText(text: Y.Text, deltaList: TextDeltaHistory): void {
  const delta = textDeltaFromHistory(deltaList)
  if (jsonEquals(text.toDelta(), delta)) {
    return
  }
  if (text.length > 0) {
    text.delete(0, text.length)
  }
  text.applyDelta(delta)
}

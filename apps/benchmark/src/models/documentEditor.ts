import { autorun } from "mobx"
import {
  fromSnapshot,
  getSnapshot,
  idProp,
  Model,
  model,
  modelAction,
  modelSnapshotInWithMetadata,
  onSnapshot,
  prop,
  type Ref,
  registerRootStore,
  rootRef,
  type SnapshotInOf,
  tProp,
  types,
  undoMiddleware,
  unregisterRootStore,
} from "mobx-keystone"

@model("benchmark/EditorItem")
export class EditorItem extends Model({
  id: idProp,
  title: tProp(types.string, "Untitled"),
  x: tProp(types.number, 0),
  y: tProp(types.number, 0),
  visible: tProp(types.boolean, true),
}) {
  attached = false

  @modelAction
  moveOne() {
    this.x = this.x === 0 ? 1 : 0
    this.y = this.x
  }

  onAttachedToRootStore() {
    this.attached = true
    return () => {
      this.attached = false
    }
  }
}

export const editorItemRef = rootRef<EditorItem>("benchmark/EditorItemRef")

@model("benchmark/EditorLayer")
export class EditorLayer extends Model({
  id: idProp,
  items: prop<EditorItem[]>(() => []),
  layers: prop<EditorLayer[]>(() => []),
}) {}

@model("benchmark/EditorDocument")
export class EditorDocument extends Model({
  layer: prop<EditorLayer>(),
  selection: prop<Ref<EditorItem>[]>(() => []),
}) {
  @modelAction
  moveSelection(count: number) {
    for (let i = 0; i < count; i++) {
      const item = this.selection[i].current
      item.x = item.x === 0 ? 1 : 0
      item.y = item.x
    }
  }

  @modelAction
  rotate(layer: EditorLayer) {
    layer.items.push(layer.items.shift()!)
  }
}

export type EditorShape = "wide" | "nested"
export type EditorFeatures = "bare" | "full"

/** Size counts content models; layers, document and 100 selection refs are additional. */
export function makeEditorSnapshot(size: number, shape: EditorShape) {
  let layer: SnapshotInOf<EditorLayer> = modelSnapshotInWithMetadata(EditorLayer, {
    id: "content",
    items: Array.from({ length: size }, (_, i) =>
      modelSnapshotInWithMetadata(EditorItem, { id: `item-${i}`, title: `Object ${i}` })
    ),
  })
  for (let depth = 0; depth < (shape === "nested" ? 8 : 0); depth++) {
    layer = modelSnapshotInWithMetadata(EditorLayer, {
      id: `layer-${depth}`,
      layers: [layer],
    })
  }
  return modelSnapshotInWithMetadata(EditorDocument, {
    layer,
    selection: Array.from({ length: 100 }, (_, i) =>
      modelSnapshotInWithMetadata(editorItemRef.refClass, {
        id: `item-${Math.floor((i * size) / 100)}`,
      })
    ),
  })
}

export function openEditor(snapshot: SnapshotInOf<EditorDocument>, features: EditorFeatures) {
  const document = registerRootStore(fromSnapshot(EditorDocument, snapshot))
  let content = document.layer
  while (content.layers.length > 0) content = content.layers[0]
  const stats = { renders: 0, snapshots: 0, selectionSum: 0 }
  // Simulate a selected-object inspector, observing refs and the edited properties.
  const stopRender = autorun(() => {
    stats.selectionSum = document.selection.reduce((sum, ref) => sum + ref.current.x, 0)
    stats.renders++
  })
  // Autosave scheduling only: materialize the snapshot, without JSON or storage I/O.
  let latestSnapshot = features === "full" ? getSnapshot(document) : undefined
  const stopSnapshot =
    features === "full"
      ? onSnapshot(document, (snapshot) => {
          latestSnapshot = snapshot
          stats.snapshots++
        })
      : undefined
  const undo =
    features === "full"
      ? undoMiddleware(document, undefined, { maxUndoLevels: 20, maxRedoLevels: 20 })
      : undefined

  return {
    document,
    content,
    stats,
    undo,
    get latestSnapshot() {
      return latestSnapshot
    },
    dispose() {
      stopRender()
      stopSnapshot?.()
      undo?.dispose()
      undo?.clearUndo()
      undo?.clearRedo()
      unregisterRootStore(document)
    },
  }
}

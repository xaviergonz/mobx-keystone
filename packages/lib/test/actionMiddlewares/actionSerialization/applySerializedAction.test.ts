import {
  applySerializedActionAndSyncNewModelIds,
  applySerializedActionAndTrackNewModelIds,
  getSnapshot,
  idProp,
  Model,
  modelAction,
  onPatches,
  prop,
  serializeActionCall,
  toTreeNode,
} from "../../../src"
import { BuiltInAction } from "../../../src/action/builtInActions"
import { testModel } from "../../utils"

test("tracking model IDs does not mutate published patch paths", () => {
  @testModel("FrozenPatchPathChild")
  class Child extends Model({ id: idProp, value: prop(1) }) {}
  const root = toTreeNode<{ child: Child | null }>({ child: null })
  const stop = onPatches(root, (patches) => {
    for (const patch of patches) Object.freeze(patch.path)
  })
  try {
    const call = serializeActionCall({
      actionName: BuiltInAction.ApplySet,
      args: ["child", new Child({})],
      targetPath: [],
      targetPathIds: [],
    })
    const result = applySerializedActionAndTrackNewModelIds(root, call)
    expect(result.serializedActionCall.modelIdOverrides).toEqual([
      { op: "replace", path: ["child", "id"], value: root.child!.id },
    ])
  } finally {
    stop()
  }
})

test.each(["remove", "move", "replace"] as const)(
  "ID synchronization handles models that an action later %ss",
  (operation) => {
    @testModel("ChangingPathChild")
    class Child extends Model({ id: idProp }) {}

    @testModel("ChangingPathRoot")
    class Root extends Model({ children: prop<Child[]>(() => []) }) {
      @modelAction
      edit() {
        this.children.push(new Child({}))
        if (operation === "remove") {
          this.children.pop()
        } else if (operation === "move") {
          this.children.unshift(new Child({}))
        } else {
          this.children[0] = new Child({})
        }
      }
    }

    const server = new Root({})
    const client = new Root({})
    const call = serializeActionCall({
      actionName: "edit",
      args: [],
      targetPath: [],
      targetPathIds: [],
    })
    const result = applySerializedActionAndTrackNewModelIds(server, call)
    expect(result.serializedActionCall.modelIdOverrides).toHaveLength(server.children.length)
    applySerializedActionAndSyncNewModelIds(client, result.serializedActionCall)
    expect(getSnapshot(client)).toEqual(getSnapshot(server))
  }
)

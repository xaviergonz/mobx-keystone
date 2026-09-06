import assert from "node:assert/strict"
import {
  applyPatches,
  applySnapshot,
  getSnapshot,
  Model,
  ModelAutoTypeCheckingMode,
  model,
  modelAction,
  type Patch,
  prop,
  setGlobalConfig,
  tProp,
  types,
} from "mobx-keystone"
import { benchKeystone, runBenchSuiteToJson } from "./bench.js"

@model("benchmark/CommonOperationsModel")
class CommonModel extends Model({
  value: tProp(types.number, 0),
  count: tProp(types.number, 0),
  x: tProp(types.number, 0),
  y: tProp(types.number, 0),
  title: tProp(types.string, "title"),
  category: tProp(types.string, "category"),
  description: tProp(types.string, "description"),
  enabled: tProp(types.boolean, true),
}) {
  @modelAction
  writeOne(value: number) {
    this.value = value
  }

  @modelAction
  writeFour(value: number) {
    this.value = value
    this.count = value
    this.x = value
    this.y = value
  }
}

@model("benchmark/CommonOperationsParent")
class CommonParent extends Model({
  child: prop<object>(),
  count: tProp(types.number, 0),
}) {}

const provided = {
  value: 1,
  count: 1,
  x: 1,
  y: 1,
  title: "title",
  category: "category",
  description: "description",
  enabled: true,
}

runBenchSuiteToJson((onCycle) => {
  for (const checking of [false, true]) {
    for (const operation of [
      "create-defaults",
      "create-provided",
      "read-eight",
      "write-one",
      "write-nested-two",
      "write-nested-eight",
      "write-four",
      "snapshot-noop",
      "snapshot-shared",
      "snapshot-one",
      "snapshot-all",
      "patch-one",
      "patch-four",
    ]) {
      benchKeystone(
        `common/${checking ? "checked" : "unchecked"}/${operation}`,
        () => {
          setGlobalConfig({
            modelAutoTypeChecking: checking
              ? ModelAutoTypeCheckingMode.AlwaysOn
              : ModelAutoTypeCheckingMode.AlwaysOff,
          })
          let node = new CommonModel({})
          let root: CommonModel | CommonParent = node
          const depth =
            operation === "write-nested-two" ? 2 : operation === "write-nested-eight" ? 8 : 0
          for (let i = 0; i < depth; i++) root = new CommonParent({ child: root })
          const shared = getSnapshot(node)
          const original = { ...shared }
          const snapshots = [original, { ...original, value: 1 }]
          const fullSnapshots = [
            original,
            {
              ...original,
              value: 1,
              count: 1,
              x: 1,
              y: 1,
              title: "updated",
              category: "updated",
              description: "updated",
              enabled: false,
            },
          ]
          const patches = [0, 1].map((value) =>
            ["value", "count", "x", "y"].map(
              (key): Patch => ({
                op: "replace",
                path: [key],
                value,
              })
            )
          )
          const singlePatches = patches.map((batch) => batch.slice(0, 1))
          let next = 0
          let readSum = 0
          const runs: Record<string, () => void> = {
            "create-defaults": () => {
              node = new CommonModel({})
            },
            "create-provided": () => {
              node = new CommonModel({ ...provided })
            },
            "read-eight": () => {
              readSum +=
                node.value +
                node.count +
                node.x +
                node.y +
                node.title.length +
                node.category.length +
                node.description.length +
                Number(node.enabled)
            },
            "write-one": () => {
              node.writeOne((next = 1 - next))
            },
            "write-nested-two": () => {
              node.writeOne((next = 1 - next))
            },
            "write-nested-eight": () => {
              node.writeOne((next = 1 - next))
            },
            "write-four": () => {
              node.writeFour((next = 1 - next))
            },
            "snapshot-noop": () => {
              applySnapshot(node, original)
            },
            "snapshot-shared": () => {
              applySnapshot(node, shared)
            },
            "snapshot-one": () => {
              applySnapshot(node, snapshots[(next = 1 - next)])
            },
            "snapshot-all": () => {
              applySnapshot(node, fullSnapshots[(next = 1 - next)])
            },
            "patch-one": () => {
              applyPatches(node, singlePatches[(next = 1 - next)])
            },
            "patch-four": () => {
              applyPatches(node, patches[(next = 1 - next)])
            },
          }
          const run = runs[operation]
          return {
            run,
            dispose: () => {
              if (operation === "read-eight") assert(readSum > 0)
              if (
                [
                  "write-one",
                  "write-nested-two",
                  "write-nested-eight",
                  "write-four",
                  "snapshot-one",
                  "snapshot-all",
                  "patch-one",
                  "patch-four",
                ].includes(operation)
              ) {
                assert.equal(node.value, next)
              }
              if (operation === "write-four" || operation === "patch-four") {
                assert.equal(node.count, next)
                assert.equal(node.x, next)
                assert.equal(node.y, next)
              }
              if (
                operation === "snapshot-noop" ||
                operation === "snapshot-shared" ||
                operation === "create-defaults"
              ) {
                assert.deepEqual(getSnapshot(node), original)
              }
              if (operation === "create-provided") assert.equal(node.value, 1)
              if (operation === "snapshot-all")
                assert.deepEqual(getSnapshot(node), fullSnapshots[next])
              assert.equal(node.typeCheck(), null)
              assert.equal(root.typeCheck(), null)
            },
          }
        },
        onCycle
      )
    }
  }
})

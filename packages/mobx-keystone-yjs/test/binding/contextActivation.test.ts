import { reaction } from "mobx"
import { getSnapshot, Model, runUnprotected, tProp, types } from "mobx-keystone"
import * as Y from "yjs"
import { bindYjsToMobxKeystone, YjsTextModel, yjsBindingContext } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each([
  ["array", false],
  ["map", false],
  ["text", false],
  ["array", true],
  ["map", true],
  ["text", true],
] as const)(
  "binding observes native %s edits when context becomes available (open transaction: %s)",
  (kind, openTransaction) => {
    const doc = new Y.Doc()
    const root = doc.getMap("root")
    const value =
      kind === "array" ? new Y.Array<number>() : kind === "map" ? new Y.Map<number>() : new Y.Text()
    root.set("value", value)
    if (value instanceof Y.Array) value.push([1])
    else if (value instanceof Y.Map) value.set("a", 1)
    else value.insert(0, "a")

    const valueType =
      kind === "array"
        ? types.array(types.number)
        : kind === "map"
          ? types.record(types.number)
          : YjsTextModel
    @testModel("context-activation-root")
    class Root extends Model({ value: tProp(valueType) }) {
      onInit() {
        autoDispose(
          reaction(
            () => yjsBindingContext.get(this)?.boundObject,
            (bound) => {
              if (!bound) return
              if (value instanceof Y.Array) value.push([2])
              else if (value instanceof Y.Map) value.set("b", 2)
              else value.insert(1, "b")
            }
          )
        )
      }
    }
    const bind = () =>
      bindYjsToMobxKeystone({
        yjsDoc: doc,
        yjsObject: root,
        mobxKeystoneType: Root,
      })
    let binding: ReturnType<typeof bind> | undefined
    if (openTransaction)
      doc.transact(() => {
        binding = bind()
      })
    else binding = bind()
    const { boundObject, dispose } = binding!
    autoDispose(dispose)
    if (boundObject.value instanceof YjsTextModel) {
      expect(value.toJSON()).toBe("ab")
      dispose()
      expect(boundObject.value.text).toBe("ab")
    } else {
      const expected = kind === "array" ? [1, 2] : { a: 1, b: 2 }
      expect(value.toJSON()).toEqual(expected)
      expect(getSnapshot(boundObject.value)).toEqual(expected)
    }
  }
)

test("models loaded while startup flushes another binding receive the binding context", () => {
  const contexts: unknown[] = []
  @testModel("startup-child")
  class Child extends Model({ value: tProp(1) }) {
    onInit() {
      contexts.push(yjsBindingContext.get(this)?.yjsDoc)
    }
  }
  @testModel("startup-parent")
  class Root extends Model({ children: tProp(types.array(Child), () => []) }) {}
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const bind = () => bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
  const first = bind()
  autoDispose(first.dispose)
  runUnprotected(() => {
    first.boundObject.children.push(new Child({}))
    contexts.length = 0
    const second = bind()
    autoDispose(second.dispose)
    expect(second.boundObject.children).toHaveLength(1)
    expect(contexts).toEqual([doc])
  })
})

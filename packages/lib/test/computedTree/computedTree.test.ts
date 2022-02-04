import { computed, reaction } from "mobx"
import {
  computedTree,
  createContext,
  detach,
  findChildren,
  findParent,
  findParentPath,
  getChildrenObjects,
  getParent,
  getParentPath,
  getParentToChildPath,
  getRefsResolvingTo,
  getRoot,
  getRootPath,
  getSnapshot,
  idProp,
  isArray,
  isChildOfParent,
  isComputedTreeNode,
  isParentOfChild,
  isPlainObject,
  isRoot,
  isTreeNode,
  model,
  Model,
  onChildAttachedTo,
  onPatches,
  prop,
  Ref,
  registerRootStore,
  resolvePath,
  rootRef,
  unregisterRootStore,
  walkTree,
  WalkTreeMode,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

@model("R")
class R extends Model({
  id: idProp,
  m: prop<M | undefined>().withSetter(),
  mRef: prop<Ref<M> | undefined>().withSetter(),
  value: prop<number>(0).withSetter(),
}) {
  @computedTree
  get string() {
    return "abc"
  }

  @computedTree
  get number() {
    return 42
  }

  @computedTree
  get boolean() {
    return true
  }

  @computedTree
  get null() {
    return null
  }

  @computedTree
  get undefined() {
    return undefined
  }

  @computedTree
  get array() {
    return ["abc"]
  }

  @computedTree
  get plainObject() {
    return { key: "value" }
  }

  @computedTree
  get model() {
    return new M({ id: `${this.id}.model`, value: this.value })
  }

  @computedTree
  get ref() {
    return this.m ? createMRef(this.m) : undefined
  }

  @computedTree
  get modelAlreadyAttached() {
    return this.m
  }

  @computedTree
  get modelIsParent() {
    return this
  }
}

@model("M")
class M extends Model({
  id: idProp,
  value: prop<number>(1).withSetter(),
}) {
  isAttachedToRootStore?: boolean

  onAttachedToRootStore() {
    this.isAttachedToRootStore = true
    return () => {
      this.isAttachedToRootStore = false
    }
  }

  @computed
  get backrefs() {
    return getRefsResolvingTo(this)
  }

  @computed
  get isComputedTreeNode() {
    return isComputedTreeNode(this)
  }
}

const createMRef = rootRef<M>("MRef")

test("computed tree decorator cannot decorate a 'get' accessor of a plain class", () => {
  expect(() => {
    // @ts-ignore
    // eslint-disable-next-line
    class X {
      @computedTree
      get value() {
        return null
      }
    }
  }).toThrow("@computedTree can only decorate 'get' accessors of class or data models")
})

test("computed tree decorator cannot decorate a 'set' accessor", () => {
  expect(() => {
    // @ts-ignore
    // eslint-disable-next-line
    class X extends Model({}) {
      @computedTree
      set value(_value: any) {}
    }
  }).toThrow("@computedTree requires a 'get' accessor")
})

test("computed tree supports non-model data", () => {
  const r = new R({})

  expect(r.string).toBe("abc")
  expect(isTreeNode(r.string)).toBeFalsy()

  expect(r.number).toBe(42)
  expect(isTreeNode(r.number)).toBeFalsy()

  expect(r.boolean).toBeTruthy()
  expect(isTreeNode(r.boolean)).toBeFalsy()

  expect(r.null).toBeNull()
  expect(isTreeNode(r.null)).toBeFalsy()

  expect(r.undefined).toBeUndefined()
  expect(isTreeNode(r.undefined)).toBeFalsy()

  expect(r.array).toEqual(["abc"])
  expect(isTreeNode(r.array)).toBeTruthy()

  expect(r.plainObject).toEqual({ key: "value" })
  expect(isTreeNode(r.plainObject)).toBeTruthy()
})

test("computed tree node must not be attached elsewhere", () => {
  const r = new R({ m: new M({}) })

  expect(() => r.modelAlreadyAttached).toThrow(
    "an object cannot be assigned a new parent when it already has one"
  )
})

test("computed tree node must not cause a cycle", () => {
  const r = new R({})

  expect(() => r.modelIsParent).toThrow("Maximum call stack size exceeded")
})

test("computed tree node's onAttachedToRootStore hook is called", () => {
  const r = new R({})

  // cached when observed
  autoDispose(
    reaction(
      () => r.model,
      () => {}
    )
  )

  expect(r.model.isAttachedToRootStore).toBeFalsy()

  registerRootStore(r)
  expect(r.model.isAttachedToRootStore).toBeTruthy()

  unregisterRootStore(r)
  expect(r.model.isAttachedToRootStore).toBeFalsy()
})

describe("tree traversal functions", () => {
  test("computed tree supports getParentPath", () => {
    const r = new R({})

    expect(getParentPath(r.array)).toEqual({ parent: r, path: "array" })
    expect(getParentPath(r.plainObject)).toEqual({ parent: r, path: "plainObject" })
    expect(getParentPath(r.model)).toEqual({ parent: r, path: "model" })
  })

  test("computed tree supports getParent", () => {
    const r = new R({})

    expect(getParent(r.array)).toBe(r)
    expect(getParent(r.plainObject)).toBe(r)
    expect(getParent(r.model)).toBe(r)
  })

  test("computed tree supports getParentToChildPath", () => {
    const r = new R({})

    expect(getParentToChildPath(r, r.array)).toEqual(["array"])
    expect(getParentToChildPath(r, r.plainObject)).toEqual(["plainObject"])
    expect(getParentToChildPath(r, r.model)).toEqual(["model"])
  })

  test("computed tree supports getRootPath", () => {
    const r = new R({})

    expect(getRootPath(r.array).path).toEqual(["array"])
    expect(getRootPath(r.plainObject).path).toEqual(["plainObject"])
    expect(getRootPath(r.model).path).toEqual(["model"])
  })

  test("computed tree supports getRoot", () => {
    const r = new R({})

    expect(getRoot(r.array)).toBe(r)
    expect(getRoot(r.plainObject)).toBe(r)
    expect(getRoot(r.model)).toBe(r)
  })

  test("computed tree supports isRoot", () => {
    const r = new R({})

    expect(isRoot(r.array)).toBeFalsy()
    expect(isRoot(r.plainObject)).toBeFalsy()
    expect(isRoot(r.model)).toBeFalsy()
  })

  test("computed tree supports isChildOfParent", () => {
    const r = new R({})

    expect(isChildOfParent(r.array, r)).toBeTruthy()
    expect(isChildOfParent(r.plainObject, r)).toBeTruthy()
    expect(isChildOfParent(r.model, r)).toBeTruthy()
  })

  test("computed tree supports isParentOfChild", () => {
    const r = new R({})

    expect(isParentOfChild(r, r.array)).toBeTruthy()
    expect(isParentOfChild(r, r.plainObject)).toBeTruthy()
    expect(isParentOfChild(r, r.model)).toBeTruthy()
  })

  test("computed tree supports resolvePath", () => {
    const r = new R({})

    expect(resolvePath(r, ["array"])).toEqual({ resolved: true, value: r.array })
    expect(resolvePath(r, ["plainObject"])).toEqual({ resolved: true, value: r.plainObject })
    expect(resolvePath(r, ["model"])).toEqual({ resolved: true, value: r.model })
  })

  test("computed tree supports findParent", () => {
    const r = new R({})

    const isR = (node: unknown) => node instanceof R

    expect(findParent(r.array, isR)).toBe(r)
    expect(findParent(r.plainObject, isR)).toBe(r)
    expect(findParent(r.model, isR)).toBe(r)
  })

  test("computed tree supports findParentPath", () => {
    const r = new R({})

    const isR = (node: unknown) => node instanceof R

    expect(findParentPath(r.array, isR)).toEqual({ parent: r, path: ["array"] })
    expect(findParentPath(r.plainObject, isR)).toEqual({ parent: r, path: ["plainObject"] })
    expect(findParentPath(r.model, isR)).toEqual({ parent: r, path: ["model"] })
  })

  test("computed tree supports findChildren", () => {
    const r = new R({})

    // cached when observed
    autoDispose(
      reaction(
        () => [r.array, r.plainObject, r.model],
        () => {}
      )
    )

    expect(findChildren(r, (node) => isArray(node)).has(r.array)).toBeTruthy()
    expect(findChildren(r, (node) => isPlainObject(node)).has(r.plainObject)).toBeTruthy()
    expect(findChildren(r, (node) => node instanceof M).has(r.model)).toBeTruthy()
  })

  test.each([false, true])("computed tree supports getChildrenObjects (deep=%j)", (deep) => {
    const r = new R({})

    // no children objects because the computed trees are not observed at this point
    expect(getChildrenObjects(r, { deep }).size).toBe(0)

    // cached when observed
    autoDispose(
      reaction(
        () => [r.array, r.plainObject, r.model],
        () => {}
      )
    )

    const children = getChildrenObjects(r, { deep })
    expect(children.size).toBe(3)
    expect(children.has(r.array)).toBeTruthy()
    expect(children.has(r.plainObject)).toBeTruthy()
    expect(children.has(r.model)).toBeTruthy()
  })

  test.each([WalkTreeMode.ChildrenFirst, WalkTreeMode.ParentFirst])(
    "computed tree supports walkTree (mode=%s)",
    (mode) => {
      const r = new R({})

      // does not traverse computed trees because they are not observed at this point
      expect(walkTree(r, (node) => (isArray(node) ? node : undefined), mode)).toBeUndefined()
      expect(walkTree(r, (node) => (isPlainObject(node) ? node : undefined), mode)).toBeUndefined()
      expect(walkTree(r, (node) => (node instanceof M ? node : undefined), mode)).toBeUndefined()

      // cached when observed
      autoDispose(
        reaction(
          () => [r.array, r.plainObject, r.model],
          () => {}
        )
      )

      expect(walkTree(r, (node) => (isArray(node) ? node : undefined), mode)).toBe(r.array)
      expect(walkTree(r, (node) => (isPlainObject(node) ? node : undefined), mode)).toBe(
        r.plainObject
      )
      expect(walkTree(r, (node) => (node instanceof M ? node : undefined), mode)).toBe(r.model)
    }
  )
})

describe("tree utility functions", () => {
  test("computed tree supports onChildAttachedTo", () => {
    const r = new R({})

    let counter = 0

    const disposer = onChildAttachedTo(
      () => r,
      (child) => {
        if (child instanceof M) {
          counter++
        }
      }
    )
    autoDispose(() => disposer(true))

    expect(counter).toBe(0)

    // no attachment because `r.model` is not observed at this point
    r.setValue(10)
    expect(counter).toBe(0)

    // attachment because `r.model` is now observed
    autoDispose(
      reaction(
        () => r.model,
        () => {}
      )
    )
    expect(counter).toBe(1)

    // re-attachment because `r.model` is observed and `r.value` has changed
    r.setValue(20)
    expect(counter).toBe(2)
  })

  test("computed tree cannot be detached", () => {
    const r = new R({})

    expect(() => detach(r.model)).toThrow("tried to invoke action '$$detach' over a readonly node")
  })
})

test("computed tree is excluded from a snapshot", () => {
  const r = new R({})

  expect(getSnapshot(r)).not.toHaveProperty("model")
})

test("computed tree does not generate patches", () => {
  const r = new R({})

  let counter = 0
  autoDispose(
    onPatches(r, (patches) => {
      counter += patches.filter((patch) => patch.path[0] === "model").length
    })
  )

  r.setValue(10)
  expect(counter).toBe(0)
})

test("computed tree node can check if it is a node in a computed tree", () => {
  const r = new R({})

  expect(isComputedTreeNode(r)).toBeFalsy()
  expect(isComputedTreeNode(r.model)).toBeTruthy()
  expect(r.model.isComputedTreeNode).toBeTruthy()
})

test("computed tree node can access context from a regular parent node", () => {
  const ctx = createContext<string>()
  const r = new R({})
  ctx.set(r, "hello")

  expect(ctx.get(r.model)).toBe("hello")
})

test("computed tree node can be referenced from a regular tree node", () => {
  const r = new R({})

  // cached when observed
  autoDispose(
    reaction(
      () => r.model,
      () => {}
    )
  )

  r.setMRef(createMRef(r.model))

  expect(r.mRef?.maybeCurrent).toBe(r.model)
  expect(r.model.backrefs.size).toBe(1)
  expect(r.model.backrefs.has(r.mRef!)).toBeTruthy()

  r.setMRef(undefined)

  expect(r.mRef?.maybeCurrent).toBeUndefined()
  expect(r.model.backrefs.size).toBe(0)
})

test("computed tree node can reference a regular tree node", () => {
  const r = new R({})

  expect(r.m).toBeUndefined()
  expect(r.ref).toBeUndefined()

  const m = new M({})
  r.setM(m)
  // no back-references yet because `r.ref` has not been accessed yet
  expect(m.backrefs.size).toBe(0)
  expect(r.ref?.maybeCurrent).toBe(m)
  // now `r.ref` has been accessed
  expect(m.backrefs.size).toBe(1)
  expect(m.backrefs.has(r.ref)).toBeTruthy()

  r.setM(undefined)
  expect(r.m).toBeUndefined()
  expect(r.ref).toBeUndefined()
})

test("computed tree is reactive", () => {
  const r = new R({})

  let counter = 0
  autoDispose(
    reaction(
      () => r.model,
      () => {
        counter++
      }
    )
  )

  r.setValue(10)
  expect(counter).toBe(1)

  // no-op action triggers no reaction
  r.setValue(10)
  expect(counter).toBe(1)

  r.setValue(20)
  expect(counter).toBe(2)
})

test("computed tree is readonly", () => {
  const r = new R({})

  expect(() => r.model.setValue(11)).toThrow(
    "tried to invoke action 'setValue' over a readonly node"
  )
})

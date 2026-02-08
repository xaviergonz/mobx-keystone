import { computed } from "mobx"
import {
  _await,
  computedTree,
  isModelAction,
  isModelFlow,
  Model,
  modelAction,
  modelFlow,
  prop,
  registerRootStore,
  standaloneAction,
  standaloneFlow,
  unregisterRootStore,
} from "../../src"
import { testModel } from "../utils"

const decoratorMetadataKey = Symbol("decoratorMetadata")
type ReflectMetadataApi = typeof Reflect & {
  getOwnMetadataKeys?: (target: object) => any[]
  getOwnMetadata?: (metadataKey: any, target: object) => any
  defineMetadata?: (metadataKey: any, metadataValue: any, target: object) => void
}

function withDecoratorMetadata(metadata: string) {
  return (...args: any[]) => {
    if (typeof args[1] === "object") {
      // standard decorators
      const value = args[0]
      if (typeof value === "function") {
        ;(value as any)[decoratorMetadataKey] = metadata
      }
      return value
    } else {
      // non-standard decorators
      const descriptor = args[2] as PropertyDescriptor | undefined
      if (typeof descriptor?.value === "function") {
        ;(descriptor.value as any)[decoratorMetadataKey] = metadata
      }
      if (typeof descriptor?.get === "function") {
        ;(descriptor.get as any)[decoratorMetadataKey] = metadata
      }
      return descriptor
    }
  }
}

function withReflectMetadata(metadata: string) {
  const assignReflectMetadata = (value: unknown) => {
    const reflect = Reflect as ReflectMetadataApi
    if (typeof value === "function" && typeof reflect.defineMetadata === "function") {
      reflect.defineMetadata(decoratorMetadataKey, metadata, value)
    }
  }

  return (...args: any[]) => {
    if (typeof args[1] === "object") {
      assignReflectMetadata(args[0])
      return args[0]
    } else {
      const descriptor = args[2] as PropertyDescriptor | undefined
      assignReflectMetadata(descriptor?.value)
      assignReflectMetadata(descriptor?.get)
      return descriptor
    }
  }
}

@testModel("Issue559")
class Issue559 extends Model({
  x: prop(0),
}) {
  @withDecoratorMetadata("action")
  @modelAction
  setX(n: number) {
    this.x = n
    return this.x
  }

  @withDecoratorMetadata("flow")
  @modelFlow
  *setXFlow(n: number) {
    this.x = n
    yield* _await(Promise.resolve())
    return this.x
  }

  @withDecoratorMetadata("computedTree")
  @computedTree
  get computedX() {
    return { x: this.x }
  }
}

@testModel("Issue559MobxComputed")
class Issue559MobxComputed extends Model({
  x: prop(1),
}) {
  @withDecoratorMetadata("mobx-computed")
  @computed
  get doubledX() {
    return this.x * 2
  }
}

test("issue #559 - third-party method metadata is preserved for modelAction", () => {
  const m = new Issue559({})

  expect((m.setX as any)[decoratorMetadataKey]).toBe("action")
  expect(m.setX(1)).toBe(1)
})

test("issue #559 - third-party method metadata is preserved for modelFlow", async () => {
  const m = new Issue559({})

  expect((m.setXFlow as any)[decoratorMetadataKey]).toBe("flow")
  expect(await (m.setXFlow as any)(2)).toBe(2)
})

test("issue #559 - third-party getter metadata is preserved for computedTree", () => {
  const m = new Issue559({})

  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(m), "computedX")
  expect((descriptor?.get as any)?.[decoratorMetadataKey]).toBe("computedTree")
  expect(m.computedX.x).toBe(0)
})

test("issue #559 - third-party getter metadata is preserved for mobx computed", () => {
  const m = new Issue559MobxComputed({})

  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(m), "doubledX")
  expect((descriptor?.get as any)?.[decoratorMetadataKey]).toBe("mobx-computed")
  expect(m.doubledX).toBe(2)
})

test("issue #559 - reflect metadata is preserved for wrapped actions", () => {
  const reflect = Reflect as ReflectMetadataApi
  const previousMethods = {
    getOwnMetadataKeys: reflect.getOwnMetadataKeys,
    getOwnMetadata: reflect.getOwnMetadata,
    defineMetadata: reflect.defineMetadata,
  }

  const metadataStore = new WeakMap<object, Map<any, any>>()
  reflect.defineMetadata = (metadataKey, metadataValue, target) => {
    let targetMetadata = metadataStore.get(target)
    if (!targetMetadata) {
      targetMetadata = new Map<any, any>()
      metadataStore.set(target, targetMetadata)
    }
    targetMetadata.set(metadataKey, metadataValue)
  }
  reflect.getOwnMetadata = (metadataKey, target) => metadataStore.get(target)?.get(metadataKey)
  reflect.getOwnMetadataKeys = (target) => Array.from(metadataStore.get(target)?.keys() ?? [])

  try {
    @testModel("Issue559Reflect")
    class Issue559Reflect extends Model({}) {
      @modelAction
      @withReflectMetadata("reflect-action")
      doStuff() {}
    }

    const m = new Issue559Reflect({})
    expect(reflect.getOwnMetadata?.(decoratorMetadataKey, m.doStuff as any)).toBe("reflect-action")
  } finally {
    if (previousMethods.getOwnMetadataKeys) {
      reflect.getOwnMetadataKeys = previousMethods.getOwnMetadataKeys
    } else {
      delete reflect.getOwnMetadataKeys
    }

    if (previousMethods.getOwnMetadata) {
      reflect.getOwnMetadata = previousMethods.getOwnMetadata
    } else {
      delete reflect.getOwnMetadata
    }

    if (previousMethods.defineMetadata) {
      reflect.defineMetadata = previousMethods.defineMetadata
    } else {
      delete reflect.defineMetadata
    }
  }
})

test("issue #559 - metadata is preserved for standaloneAction", () => {
  const metaKey = Symbol("standaloneMeta")

  function myFn(target: any, n: number) {
    target.x = n
  }
  ;(myFn as any)[metaKey] = "standalone-meta"

  const wrappedFn = standaloneAction("Issue559/standaloneAction", myFn)

  // the wrapper should carry over our metadata
  expect((wrappedFn as any)[metaKey]).toBe("standalone-meta")
  expect(isModelAction(wrappedFn as any)).toBe(false)
})

test("issue #559 - metadata is preserved for standaloneFlow", () => {
  const metaKey = Symbol("standaloneFlowMeta")

  function* myFlowFn(_target: any) {
    // no-op
  }
  ;(myFlowFn as any)[metaKey] = "standalone-flow-meta"

  const wrappedFn = standaloneFlow("Issue559/standaloneFlow", myFlowFn)

  // the wrapper should carry over our metadata
  expect((wrappedFn as any)[metaKey]).toBe("standalone-flow-meta")
  expect(isModelFlow(wrappedFn as any)).toBe(false)
})

test("issue #559 - metadata is preserved for onInit lifecycle hook", () => {
  const hookMetadataKey = Symbol("hookMeta")

  @testModel("Issue559OnInit")
  class Issue559OnInit extends Model({
    x: prop(0),
  }) {
    onInit() {
      // no-op
    }
  }
  // attach metadata to the prototype method before any instance is created
  ;(Issue559OnInit.prototype as any).onInit[hookMetadataKey] = "onInit-meta"

  const m = new Issue559OnInit({})
  // after construction the wrapped method should still carry the metadata
  expect((m.onInit as any)[hookMetadataKey]).toBe("onInit-meta")
})

test("issue #559 - metadata is preserved for onAttachedToRootStore lifecycle hook", () => {
  const hookMetadataKey = Symbol("hookMeta")
  let disposerCalled = false

  @testModel("Issue559OnAttached")
  class Issue559OnAttached extends Model({}) {
    onAttachedToRootStore() {
      return () => {
        disposerCalled = true
      }
    }
  }
  // attach metadata to the prototype method
  ;(Issue559OnAttached.prototype as any).onAttachedToRootStore[hookMetadataKey] = "attached-meta"

  @testModel("Issue559OnAttachedRoot")
  class Issue559Root extends Model({
    child: prop<Issue559OnAttached>(),
  }) {}

  const child = new Issue559OnAttached({})
  const root = new Issue559Root({ child })
  registerRootStore(root)

  // after root store attachment, the wrapped method should still carry metadata
  expect((child.onAttachedToRootStore as any)[hookMetadataKey]).toBe("attached-meta")

  unregisterRootStore(root)
  expect(disposerCalled).toBe(true)
})

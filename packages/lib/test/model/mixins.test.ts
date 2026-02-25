import { _, assert } from "spec.ts"
import {
  AnyModel,
  ComposedModelClass,
  ComposedModelInstance,
  composeMixins,
  defineModelMixin,
  ExtendedModel,
  getSnapshot,
  Model,
  ModelClass,
  ModelCreationData,
  ModelData,
  modelClass,
  prop,
  req,
  tProp,
  types,
} from "../../src"
import { getInternalModelClassPropsInfo } from "../../src/modelShared/modelPropsInfo"
import { testModel } from "../utils"

test("defineModelMixin + composeMixins type-level composition", () => {
  @testModel("mixins/Entity")
  class Entity extends Model({}) {}

  const countableMixin = defineModelMixin(
    { quantity: tProp(types.number, 0) },
    (Base) =>
      class Countable extends Base {
        incrementBy(delta: number) {
          return this.quantity + delta
        }
      }
  )

  const producerMixin = defineModelMixin(
    { produced: tProp(types.number, 0) },
    req<{ quantity: number }>(),
    (Base) =>
      class Producer extends Base {
        produceTotal() {
          return this.produced + this.quantity
        }
      }
  )

  const ProductBase = composeMixins(Entity, countableMixin, producerMixin)
  type Product = InstanceType<typeof ProductBase>
  type ProductFromUtility = InstanceType<
    ComposedModelClass<typeof Entity, [typeof countableMixin, typeof producerMixin]>
  >
  type ProductInstanceFromUtility = ComposedModelInstance<
    typeof Entity,
    [typeof countableMixin, typeof producerMixin]
  >
  type ProductData = ModelData<Product>
  type ProductCreationData = ModelCreationData<Product>

  assert(_ as Product["quantity"], _ as number)
  assert(_ as Product["produced"], _ as number)
  assert(_ as Product["incrementBy"], _ as (delta: number) => number)
  assert(_ as Product["produceTotal"], _ as () => number)
  assert(_ as ProductData["quantity"], _ as number)
  assert(_ as ProductData["produced"], _ as number)
  assert(_ as ProductCreationData["quantity"], _ as number | null | undefined)
  assert(_ as ProductCreationData["produced"], _ as number | null | undefined)
  assert(_ as ProductFromUtility["quantity"], _ as number)
  assert(_ as ProductFromUtility["produced"], _ as number)
  assert(_ as ProductFromUtility["incrementBy"], _ as (delta: number) => number)
  assert(_ as ProductFromUtility["produceTotal"], _ as () => number)
  assert(_ as ProductInstanceFromUtility["quantity"], _ as number)
  assert(_ as ProductInstanceFromUtility["produced"], _ as number)
  assert(_ as ProductInstanceFromUtility["incrementBy"], _ as (delta: number) => number)
  assert(_ as ProductInstanceFromUtility["produceTotal"], _ as () => number)

  expect(true).toBe(true)
})

test("composeMixins runtime model composition", () => {
  @testModel("mixins/runtime/Entity")
  class Entity extends Model({
    base: tProp(types.number, 1),
  }) {}

  const addQuantity = defineModelMixin({ quantity: tProp(types.number, 2) })

  const addProduced = defineModelMixin(
    { produced: tProp(types.number, 3) },
    req<{ quantity: number }>()
  )

  const afterQuantity = addQuantity(Entity)
  const afterQuantityProps = Object.keys(getInternalModelClassPropsInfo(afterQuantity as ModelClass<AnyModel>))
  expect(afterQuantityProps).toContain("quantity")
  expect(afterQuantityProps).toContain("base")

  const afterProduced = addProduced(afterQuantity)
  const afterProducedProps = Object.keys(getInternalModelClassPropsInfo(afterProduced as ModelClass<AnyModel>))
  expect(afterProducedProps).toContain("produced")
  expect(afterProducedProps).toContain("quantity")
  expect(afterProducedProps).toContain("base")

  const RuntimeBase = composeMixins(Entity, addQuantity, addProduced)
  const runtimeBaseModelProps = Object.keys(getInternalModelClassPropsInfo(RuntimeBase as ModelClass<AnyModel>))
  expect(runtimeBaseModelProps).toContain("base")
  expect(runtimeBaseModelProps).toContain("quantity")
  expect(runtimeBaseModelProps).toContain("produced")

  @testModel("mixins/runtime/Product")
  class Product extends ExtendedModel(RuntimeBase, {}) {}
  const productModelProps = Object.keys(getInternalModelClassPropsInfo(Product as ModelClass<AnyModel>))
  expect(productModelProps).toContain("base")
  expect(productModelProps).toContain("quantity")
  expect(productModelProps).toContain("produced")

  const p = new Product({})
  expect(p.base).toBe(1)
  expect(p.quantity).toBe(2)
  expect(p.produced).toBe(3)

  const p2 = new Product({
    base: 10,
    quantity: 20,
    produced: 30,
  })
  expect(p2.base).toBe(10)
  expect(p2.quantity).toBe(20)
  expect(p2.produced).toBe(30)

  const sn = getSnapshot(p2)
  expect(sn.base).toBe(10)
  expect(sn.quantity).toBe(20)
  expect(sn.produced).toBe(30)
})

test("issue #494 legacy factory pattern with explicit return types", () => {
  @testModel("mixins/legacy494/Entity")
  class Entity extends Model({}) {}

  type Countable<T extends AnyModel> = T & {
    quantity: number
    incrementBy(delta: number): number
  }

  function makeCountable<TBase extends ModelClass<AnyModel>>(
    Base: TBase
  ): ModelClass<Countable<InstanceType<TBase>>> {
    class _Countable extends ExtendedModel(modelClass(Base), {
      quantity: tProp(types.number, 0),
    }) {
      incrementBy(delta: number) {
        return this.quantity + delta
      }
    }

    return _Countable as unknown as ModelClass<Countable<InstanceType<TBase>>>
  }

  type Producer<T extends AnyModel> = T & {
    produced: number
    produceTotal(): number
  }

  function makeProducer<TBase extends ModelClass<Countable<AnyModel>>>(
    Base: TBase
  ): ModelClass<Producer<InstanceType<TBase>>> {
    class _Producer extends ExtendedModel(modelClass(Base), {
      produced: tProp(types.number, 0),
    }) {
      produceTotal() {
        return this.produced + this.quantity
      }
    }

    return _Producer as unknown as ModelClass<Producer<InstanceType<TBase>>>
  }

  type CountableEntityClass = ReturnType<typeof makeCountable<typeof Entity>>
  type CountableEntityInstance = InstanceType<CountableEntityClass>
  assert(_ as CountableEntityInstance["quantity"], _ as number)
  assert(_ as CountableEntityInstance["incrementBy"], _ as (delta: number) => number)

  const makeProducerUsingFactoryType: <TBase extends ModelClass<CountableEntityInstance>>(
    Base: TBase
  ) => ModelClass<Producer<InstanceType<TBase>>> = makeProducer

  const CountableEntity = makeCountable(Entity)
  const ProducerEntity = makeProducerUsingFactoryType(CountableEntity)
  type ProducerEntityInstance = InstanceType<typeof ProducerEntity>
  assert(_ as ProducerEntityInstance["produced"], _ as number)
  assert(_ as ProducerEntityInstance["produceTotal"], _ as () => number)

  expect(true).toBe(true)
})

test("composeMixins enforces requirements", () => {
  @testModel("mixins/Req/Entity")
  class Entity extends Model({}) {}

  const requiresCountable = defineModelMixin(
    { produced: tProp(types.number, 0) },
    req<{ quantity: number }>()
  )

  // @ts-expect-error quantity requirement is missing on Entity
  const Invalid = composeMixins(Entity, requiresCountable)
  void Invalid

  const countableMixin = defineModelMixin({ quantity: tProp(types.number, 0) })

  const Valid = composeMixins(Entity, countableMixin, requiresCountable)
  type ValidInstance = InstanceType<typeof Valid>
  assert(_ as ValidInstance["quantity"], _ as number)
  assert(_ as ValidInstance["produced"], _ as number)
})

test("composeMixins supports 6+ mixins", () => {
  @testModel("mixins/Many/Entity")
  class Entity extends Model({}) {}

  const m1 = defineModelMixin({ p1: tProp(types.number, 1) })
  const m2 = defineModelMixin({ p2: tProp(types.number, 2) })
  const m3 = defineModelMixin({ p3: tProp(types.number, 3) })
  const m4 = defineModelMixin({ p4: tProp(types.number, 4) })
  const m5 = defineModelMixin({ p5: tProp(types.number, 5) })
  const m6 = defineModelMixin({ p6: tProp(types.number, 6) })
  const m7 = defineModelMixin({ p7: tProp(types.number, 7) })

  const ManyBase = composeMixins(Entity, m1, m2, m3, m4, m5, m6, m7)
  type Many = InstanceType<typeof ManyBase>

  assert(_ as Many["p1"], _ as number)
  assert(_ as Many["p2"], _ as number)
  assert(_ as Many["p3"], _ as number)
  assert(_ as Many["p4"], _ as number)
  assert(_ as Many["p5"], _ as number)
  assert(_ as Many["p6"], _ as number)
  assert(_ as Many["p7"], _ as number)
})

test("composeMixins requirement failure in middle of chain", () => {
  @testModel("mixins/ReqMid/Entity")
  class Entity extends Model({}) {}

  const addQuantity = defineModelMixin({ quantity: tProp(types.number, 0) })

  const requiresProduced = defineModelMixin(
    { seen: tProp(types.boolean, true) },
    req<{ produced: number }>()
  )

  const addProduced = defineModelMixin({ produced: tProp(types.number, 0) })

  // @ts-expect-error second mixin requires produced, but produced is only added later
  const Invalid = composeMixins(Entity, addQuantity, requiresProduced, addProduced)
  void Invalid

  const Valid = composeMixins(Entity, addProduced, requiresProduced)
  type ValidInstance = InstanceType<typeof Valid>
  assert(_ as ValidInstance["produced"], _ as number)
  assert(_ as ValidInstance["seen"], _ as boolean)
})

test("composeMixins without a base uses implicit empty base", () => {
  const countableMixin = defineModelMixin(
    { quantity: tProp(types.number, 42) },
    (Base) =>
      class Countable extends Base {
        incrementBy(delta: number): number {
          return this.quantity + delta
        }
      }
  )

  const producerMixin = defineModelMixin(
    { produced: tProp(types.number, 7) },
    req<{ quantity: number }>()
  )

  const ProductBase = composeMixins(countableMixin, producerMixin)
  type ProductInstance = InstanceType<typeof ProductBase>
  type ProductData = ModelData<ProductInstance>
  type ProductCreationData = ModelCreationData<ProductInstance>

  assert(_ as ProductInstance["quantity"], _ as number)
  assert(_ as ProductInstance["produced"], _ as number)
  assert(_ as ProductInstance["incrementBy"], _ as (delta: number) => number)
  assert(_ as ProductData["quantity"], _ as number)
  assert(_ as ProductData["produced"], _ as number)
  assert(_ as ProductCreationData["quantity"], _ as number | null | undefined)
  assert(_ as ProductCreationData["produced"], _ as number | null | undefined)

  @testModel("mixins/NoBase/Product")
  class Product extends ExtendedModel(ProductBase, {}) {}

  const p = new Product({})
  expect(p.quantity).toBe(42)
  expect(p.produced).toBe(7)
  expect(p.incrementBy(8)).toBe(50)

  const p2 = new Product({ quantity: 10, produced: 3 })
  expect(p2.quantity).toBe(10)
  expect(p2.produced).toBe(3)

  const sn = getSnapshot(p2)
  expect(sn.quantity).toBe(10)
  expect(sn.produced).toBe(3)
})

test("defineModelMixin props-first: accurate ModelData and ModelCreationData (type and runtime)", () => {
  @testModel("mixins/PropsFirst/Entity")
  class Entity extends Model({
    base: tProp(types.number, 100),
  }) {}

  // --- props only (no builder) ---

  const countableMixin = defineModelMixin({ quantity: tProp(types.number, 0) })
  const producerMixin = defineModelMixin({ produced: tProp(types.number, 0) })

  const ProductBase = composeMixins(Entity, countableMixin, producerMixin)
  type Product = InstanceType<typeof ProductBase>
  type ProductData = ModelData<Product>
  type ProductCreationData = ModelCreationData<Product>

  assert(_ as Product["quantity"], _ as number)
  assert(_ as Product["produced"], _ as number)
  assert(_ as ProductData["quantity"], _ as number)
  assert(_ as ProductData["produced"], _ as number)
  assert(_ as ProductCreationData["quantity"], _ as number | null | undefined)
  assert(_ as ProductCreationData["produced"], _ as number | null | undefined)

  @testModel("mixins/PropsFirst/Product")
  class ProductModel extends ExtendedModel(ProductBase, {}) {}

  const p = new ProductModel({})
  expect(p.base).toBe(100)
  expect(p.quantity).toBe(0)
  expect(p.produced).toBe(0)

  const p2 = new ProductModel({ base: 1, quantity: 42, produced: 7 })
  expect(p2.base).toBe(1)
  expect(p2.quantity).toBe(42)
  expect(p2.produced).toBe(7)

  const sn = getSnapshot(p2)
  expect(sn.base).toBe(1)
  expect(sn.quantity).toBe(42)
  expect(sn.produced).toBe(7)

  // --- props + builder ---

  const countableWithMethodsMixin = defineModelMixin(
    { quantity: tProp(types.number, 0) },
    (Base) =>
      class Countable extends Base {
        incrementBy(delta: number): number {
          return this.quantity + delta
        }
      }
  )

  const ProductWithMethodsBase = composeMixins(Entity, countableWithMethodsMixin)
  type ProductWithMethods = InstanceType<typeof ProductWithMethodsBase>
  type ProductWithMethodsData = ModelData<ProductWithMethods>
  type ProductWithMethodsCreationData = ModelCreationData<ProductWithMethods>

  assert(_ as ProductWithMethods["quantity"], _ as number)
  assert(_ as ProductWithMethods["incrementBy"], _ as (delta: number) => number)
  assert(_ as ProductWithMethodsData["quantity"], _ as number)
  assert(_ as ProductWithMethodsCreationData["quantity"], _ as number | null | undefined)

  @testModel("mixins/PropsFirstBuilder/Product")
  class ProductWithMethodsModel extends ExtendedModel(ProductWithMethodsBase, {}) {}

  const pm = new ProductWithMethodsModel({})
  expect(pm.quantity).toBe(0)
  expect(pm.incrementBy(5)).toBe(5)

  const pm2 = new ProductWithMethodsModel({ quantity: 10 })
  expect(pm2.quantity).toBe(10)
  expect(pm2.incrementBy(3)).toBe(13)

  const snm = getSnapshot(pm2)
  expect(snm.quantity).toBe(10)
})

test("req<Req> is checked against the transformed instance type, not the snapshot type", () => {
  // countMixin stores count as string in the snapshot but exposes it as number on the instance
  // (via withTransform). The requirement of a consuming mixin must use the *transformed* type.
  const stringToNumberTransform = {
    transform({ originalValue }: { originalValue: string; cachedTransformedValue: number | undefined; setOriginalValue(v: string): void }): number {
      return Number(originalValue)
    },
    untransform({ transformedValue }: { transformedValue: number; cacheTransformedValue(): void }): string {
      return String(transformedValue)
    },
  }

  const countMixin = defineModelMixin({
    // stored as string (snapshot), exposed as number (instance)
    count: prop<string>("0").withTransform(stringToNumberTransform),
  })

  // req uses the *transformed* instance type (number), which is what `this.count` gives
  const doublerMixin = defineModelMixin(
    { doubled: prop<number>(0) },
    req<{ count: number }>(),
    (Base) =>
      class Doubler extends Base {
        computeDoubled(): number {
          return this.count * 2
        }
      }
  )

  // req<{ count: string }> would be wrong because the instance type is number after transform
  const doublerMixinWrong = defineModelMixin(
    { doubled: prop<number>(0) },
    req<{ count: string }>()
  )

  const ProductBase = composeMixins(countMixin, doublerMixin)
  type ProductInstance = InstanceType<typeof ProductBase>
  type ProductData = ModelData<ProductInstance>
  type ProductCreationData = ModelCreationData<ProductInstance>

  // instance type: transformed number
  assert(_ as ProductInstance["count"], _ as number)
  // ModelData: transformed type
  assert(_ as ProductData["count"], _ as number)
  // ModelCreationData: withTransform also changes the creation type to the transformed type
  assert(_ as ProductCreationData["count"], _ as number | null | undefined)

  // applying doublerMixin (requires number) after countMixin (provides number) is valid
  const Valid = composeMixins(countMixin, doublerMixin)
  void Valid

  // applying doublerMixinWrong (requires string) after countMixin (provides number) is a type error
  // @ts-expect-error count is number (transformed), not string, so req<{count:string}> is not satisfied
  const Invalid = composeMixins(countMixin, doublerMixinWrong)
  void Invalid

  @testModel("mixins/Transform/Product")
  class Product extends ExtendedModel(ProductBase, {}) {}

  // runtime: default from prop<string>("0") → transform → 0
  const p = new Product({})
  expect(p.count).toBe(0)
  expect(p.computeDoubled()).toBe(0)

  // runtime: construction uses transformed type (number)
  const p2 = new Product({ count: 42 })
  expect(p2.count).toBe(42)
  expect(p2.computeDoubled()).toBe(84)

  // snapshot stores the *original* (string) type
  const sn = getSnapshot(p2)
  assert(_ as typeof sn["count"], _ as string)
  expect(sn.count).toBe("42")
})

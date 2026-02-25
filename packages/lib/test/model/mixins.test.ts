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
  modelClass,
  tProp,
  types,
} from "../../src"
import { getInternalModelClassPropsInfo } from "../../src/modelShared/modelPropsInfo"
import { testModel } from "../utils"

test("defineModelMixin + composeMixins type-level composition", () => {
  @testModel("mixins/Entity")
  class Entity extends Model({}) {}

  const countableMixin = defineModelMixin<{
    quantity: number
    incrementBy(delta: number): number
  }>(
    (Base) =>
      class Countable extends ExtendedModel(modelClass(Base), {
        quantity: tProp(types.number, 0),
      }) {
        incrementBy(delta: number) {
          return this.quantity + delta
        }
      }
  )

  const producerMixin = defineModelMixin<
    {
      produced: number
      produceTotal(): number
    },
    {
      quantity: number
    }
  >(
    (Base) =>
      class Producer extends ExtendedModel(modelClass(Base), {
        produced: tProp(types.number, 0),
      }) {
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

  assert(_ as Product["quantity"], _ as number)
  assert(_ as Product["produced"], _ as number)
  assert(_ as Product["incrementBy"], _ as (delta: number) => number)
  assert(_ as Product["produceTotal"], _ as () => number)
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

  const addQuantity = defineModelMixin<{ quantity: number }>(
    (Base) =>
      class AddQuantity extends ExtendedModel(modelClass(Base), {
        quantity: tProp(types.number, 2),
      }) {}
  )

  const addProduced = defineModelMixin<
    { produced: number },
    {
      quantity: number
    }
  >(
    (Base) =>
      class AddProduced extends ExtendedModel(modelClass(Base), {
        produced: tProp(types.number, 3),
      }) {}
  )

  const afterQuantity = addQuantity(Entity)
  const afterQuantityProps = Object.keys(getInternalModelClassPropsInfo(afterQuantity as any))
  expect(afterQuantityProps).toContain("quantity")
  expect(afterQuantityProps).toContain("base")

  const afterProduced = addProduced(afterQuantity)
  const afterProducedProps = Object.keys(getInternalModelClassPropsInfo(afterProduced as any))
  expect(afterProducedProps).toContain("produced")
  expect(afterProducedProps).toContain("quantity")
  expect(afterProducedProps).toContain("base")

  const RuntimeBase = composeMixins(Entity, addQuantity, addProduced)
  const runtimeBaseModelProps = Object.keys(getInternalModelClassPropsInfo(RuntimeBase as any))
  expect(runtimeBaseModelProps).toContain("base")
  expect(runtimeBaseModelProps).toContain("quantity")
  expect(runtimeBaseModelProps).toContain("produced")

  @testModel("mixins/runtime/Product")
  class Product extends ExtendedModel(RuntimeBase, {}) {}
  const productModelProps = Object.keys(getInternalModelClassPropsInfo(Product as any))
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
  } as any)
  expect(p2.base).toBe(10)
  expect(p2.quantity).toBe(20)
  expect(p2.produced).toBe(30)

  const sn = getSnapshot(p2) as any
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

  const requiresCountable = defineModelMixin<
    {
      produced: number
    },
    {
      quantity: number
    }
  >(
    (Base) =>
      class Producer extends ExtendedModel(modelClass(Base), {
        produced: tProp(types.number, 0),
      }) {}
  )

  // @ts-expect-error quantity requirement is missing on Entity
  const Invalid = composeMixins(Entity, requiresCountable)
  void Invalid

  const countableMixin = defineModelMixin<{ quantity: number }>(
    (Base) =>
      class Countable extends ExtendedModel(modelClass(Base), {
        quantity: tProp(types.number, 0),
      }) {}
  )

  const Valid = composeMixins(Entity, countableMixin, requiresCountable)
  type ValidInstance = InstanceType<typeof Valid>
  assert(_ as ValidInstance["quantity"], _ as number)
  assert(_ as ValidInstance["produced"], _ as number)
})

test("composeMixins supports 6+ mixins", () => {
  @testModel("mixins/Many/Entity")
  class Entity extends Model({}) {}

  const m1 = defineModelMixin<{ p1: number }>(
    (Base) => class M1 extends ExtendedModel(modelClass(Base), { p1: tProp(types.number, 1) }) {}
  )
  const m2 = defineModelMixin<{ p2: number }>(
    (Base) => class M2 extends ExtendedModel(modelClass(Base), { p2: tProp(types.number, 2) }) {}
  )
  const m3 = defineModelMixin<{ p3: number }>(
    (Base) => class M3 extends ExtendedModel(modelClass(Base), { p3: tProp(types.number, 3) }) {}
  )
  const m4 = defineModelMixin<{ p4: number }>(
    (Base) => class M4 extends ExtendedModel(modelClass(Base), { p4: tProp(types.number, 4) }) {}
  )
  const m5 = defineModelMixin<{ p5: number }>(
    (Base) => class M5 extends ExtendedModel(modelClass(Base), { p5: tProp(types.number, 5) }) {}
  )
  const m6 = defineModelMixin<{ p6: number }>(
    (Base) => class M6 extends ExtendedModel(modelClass(Base), { p6: tProp(types.number, 6) }) {}
  )
  const m7 = defineModelMixin<{ p7: number }>(
    (Base) => class M7 extends ExtendedModel(modelClass(Base), { p7: tProp(types.number, 7) }) {}
  )

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

  const addQuantity = defineModelMixin<{ quantity: number }>(
    (Base) =>
      class AddQuantity extends ExtendedModel(modelClass(Base), {
        quantity: tProp(types.number, 0),
      }) {}
  )

  const requiresProduced = defineModelMixin<{ seen: boolean }, { produced: number }>(
    (Base) =>
      class RequiresProduced extends ExtendedModel(modelClass(Base), {
        seen: tProp(types.boolean, true),
      }) {}
  )

  const addProduced = defineModelMixin<{ produced: number }>(
    (Base) =>
      class AddProduced extends ExtendedModel(modelClass(Base), {
        produced: tProp(types.number, 0),
      }) {}
  )

  // @ts-expect-error second mixin requires produced, but produced is only added later
  const Invalid = composeMixins(Entity, addQuantity, requiresProduced, addProduced)
  void Invalid

  const Valid = composeMixins(Entity, addProduced, requiresProduced)
  type ValidInstance = InstanceType<typeof Valid>
  assert(_ as ValidInstance["produced"], _ as number)
  assert(_ as ValidInstance["seen"], _ as boolean)
})

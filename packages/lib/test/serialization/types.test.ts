import { expectTypeOf } from "expect-type"
import {
  type AnyModel,
  applyCall,
  applyCallAsync,
  defaultSerializer,
  type EncodedCall,
  type IdRefJson,
  idRefs,
  Model,
  model,
  modelAction,
  type PathRefJson,
  pathRefs,
  prop,
  type ResolvedCall,
  type ValueSerializer,
} from "../../src"

@model("serialization/types/Counter")
class Counter extends Model({ count: prop(0) }) {
  @modelAction
  inc() {
    return ++this.count
  }
}

test("public types", () => {
  expectTypeOf(applyCall).returns.toEqualTypeOf<unknown>()
  expectTypeOf(applyCall<number>).returns.toEqualTypeOf<number>()
  expectTypeOf(applyCallAsync<number>).returns.toEqualTypeOf<Promise<number>>()

  const root = new Counter({})
  const encoded = defaultSerializer.encodeCall(root, { target: root, name: "inc", args: [] })
  expectTypeOf(encoded).toEqualTypeOf<EncodedCall>()
  const call = defaultSerializer.decodeCall(root, encoded)
  expectTypeOf(call).toEqualTypeOf<ResolvedCall>()

  expectTypeOf(pathRefs()).toEqualTypeOf<ValueSerializer<object, PathRefJson>>()
  expectTypeOf(idRefs()).toEqualTypeOf<ValueSerializer<AnyModel, IdRefJson>>()
  expectTypeOf<Parameters<ValueSerializer<Date, number>["decode"]>[0]>().toEqualTypeOf<number>()
  expectTypeOf<ReturnType<ValueSerializer<Date, number>["decode"]>>().toEqualTypeOf<Date>()

  // @ts-expect-error a payload must be JSON
  expectTypeOf<ValueSerializer<Date, Date>>()

  expect(() => {
    // @ts-expect-error a resolved call is read-only
    call.args = []
  }).toThrow(TypeError)
})

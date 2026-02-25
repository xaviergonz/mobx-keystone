import type { ModelClass } from "../modelShared/BaseModelShared"
import type { AnyModel } from "./BaseModel"

type ReqObj<Req> = [unknown] extends [Req] ? unknown : Req extends object ? Req : never
type ModelCtorLike = abstract new (...args: any[]) => unknown

/**
 * Mixin function type for model classes.
 *
 * @template Added Shape added by the mixin.
 * @template Req Shape that must exist in the input model instance.
 */
export type ModelMixin<Added extends object, Req = unknown> = <
  B extends ModelClass<AnyModel & ReqObj<Req>>,
>(
  base: B
) => ModelClass<InstanceType<B> & Added>

type MixinAdded<M extends ModelMixin<any, any>> =
  M extends ModelMixin<infer Added, any> ? Added : never
type MixinReq<M extends ModelMixin<any, any>> =
  M extends ModelMixin<any, infer Req> ? ReqObj<Req> : never
type ApplyMixin<B extends ModelClass<AnyModel>, M extends ModelMixin<any, any>> = ModelClass<
  InstanceType<B> & MixinAdded<M>
>

type ApplyMixins<
  B extends ModelClass<AnyModel>,
  M extends readonly ModelMixin<any, any>[],
> = M extends readonly [infer First, ...infer Rest]
  ? First extends ModelMixin<any, any>
    ? ApplyMixins<ApplyMixin<B, First>, Extract<Rest, readonly ModelMixin<any, any>[]>>
    : never
  : B

/**
 * Computes the resulting model class after applying a mixin tuple to a base model class.
 */
export type ComposedModelClass<
  B extends ModelClass<AnyModel>,
  M extends readonly ModelMixin<any, any>[],
> = ApplyMixins<B, M>

/**
 * Computes the resulting model instance type after applying a mixin tuple to a base model class.
 */
export type ComposedModelInstance<
  B extends ModelClass<AnyModel>,
  M extends readonly ModelMixin<any, any>[],
> = InstanceType<ComposedModelClass<B, M>>

type ValidateMixins<
  B extends ModelClass<AnyModel>,
  M extends readonly ModelMixin<any, any>[],
> = M extends readonly [infer First, ...infer Rest]
  ? First extends ModelMixin<any, any>
    ? InstanceType<B> extends AnyModel & MixinReq<First>
      ? readonly [
          First,
          ...ValidateMixins<ApplyMixin<B, First>, Extract<Rest, readonly ModelMixin<any, any>[]>>,
        ]
      : never
    : never
  : readonly []

/**
 * Defines a model mixin with proper class/instance type conversion at the boundary.
 *
 * @template Added Shape added by the mixin.
 * @template Req Shape that must exist in the input model instance.
 * @param build Mixin builder function.
 * @returns A typed model mixin function.
 */
export function defineModelMixin<Added extends object, Req = unknown>(
  build: <B extends ModelClass<AnyModel & ReqObj<Req>>>(base: B) => ModelCtorLike
): ModelMixin<Added, Req> {
  return (<B extends ModelClass<AnyModel & ReqObj<Req>>>(base: B) =>
    build(base) as unknown as ModelClass<InstanceType<B> & Added>) as ModelMixin<Added, Req>
}

/**
 * Composes several model mixins over a base model class.
 *
 * @template B Base model class.
 * @param base Base model class.
 * @param mixins Mixins to apply.
 * @returns A model class with all mixin additions applied.
 */
export function composeMixins<
  B extends ModelClass<AnyModel>,
  M extends readonly ModelMixin<any, any>[],
>(base: B, ...mixins: M & ValidateMixins<B, M>): ComposedModelClass<B, M> {
  let current = base as ModelClass<AnyModel>

  for (const mixin of mixins) {
    current = mixin(current)
  }

  return current as ComposedModelClass<B, M>
}

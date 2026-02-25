import {
  type AbstractModelClass,
  type ModelClass,
  modelClass,
  propsTypeSymbol,
} from "../modelShared/BaseModelShared"
import type { ModelProps, ModelPropsToTransformedData } from "../modelShared/prop"
import type { AnyModel, BaseModelKeys } from "./BaseModel"
import { ExtendedModel } from "./Model"

type ReqObj<Req> = [unknown] extends [Req] ? unknown : Req extends object ? Req : never

const reqMarkerBrand = Symbol("reqMarkerBrand")

/**
 * Typed requirement marker created by `req<Req>()`.
 * Pass it as the second argument to `defineModelMixin` to declare that the base model must already
 * contain the `Req` shape before the mixin is applied.
 */
export type ReqMarker<Req extends object> = { readonly [reqMarkerBrand]: Req }

const reqMarkerSingleton = { [reqMarkerBrand]: undefined } as unknown as ReqMarker<any>

/**
 * Creates a typed requirement marker for `defineModelMixin`.
 *
 * @template Req Shape that must exist on the base model instance.
 *
 * @example
 * const producerMixin = defineModelMixin(
 *   { produced: tProp(types.number, 0) },
 *   req<{ quantity: number }>()
 * )
 */
export function req<Req extends object>(): ReqMarker<Req> {
  return reqMarkerSingleton
}

function isReqMarker(v: unknown): v is ReqMarker<any> {
  return typeof v === "object" && v !== null && (reqMarkerBrand as any) in v
}

/**
 * Mixin function type for model classes.
 *
 * @template Added Shape added by the mixin.
 * @template Req Shape that must exist in the input model instance.
 * @template ExtraProps ModelProps to merge into the class's propsTypeSymbol marker. When using
 *   `defineModelMixin`, this is always set to the real `ModelProps` object so that `ModelData` /
 *   `ModelCreationData` resolve to the exact prop types.
 */
export type ModelMixin<
  Added extends object,
  Req = unknown,
  ExtraProps extends ModelProps = ModelProps,
> = <B extends ModelClass<AnyModel & ReqObj<Req>>>(
  base: B
) => ModelClass<InstanceType<B> & Added & { [propsTypeSymbol]: ExtraProps }>

type MixinAdded<M extends ModelMixin<any, any, any>> =
  M extends ModelMixin<infer Added, any, any> ? Added : never
type MixinReq<M extends ModelMixin<any, any, any>> =
  M extends ModelMixin<any, infer Req, any> ? ReqObj<Req> : never
type MixinExtraProps<M extends ModelMixin<any, any, any>> =
  M extends ModelMixin<any, any, infer P> ? P : never
type ApplyMixin<B extends ModelClass<AnyModel>, M extends ModelMixin<any, any, any>> = ModelClass<
  InstanceType<B> & MixinAdded<M> & { [propsTypeSymbol]: MixinExtraProps<M> }
>

type ApplyMixins<
  B extends ModelClass<AnyModel>,
  M extends readonly ModelMixin<any, any, any>[],
> = M extends readonly [infer First, ...infer Rest]
  ? First extends ModelMixin<any, any, any>
    ? ApplyMixins<ApplyMixin<B, First>, Extract<Rest, readonly ModelMixin<any, any, any>[]>>
    : never
  : B

/**
 * Computes the resulting model class after applying a mixin tuple to a base model class.
 */
export type ComposedModelClass<
  B extends ModelClass<AnyModel>,
  M extends readonly ModelMixin<any, any, any>[],
> = ApplyMixins<B, M>

/**
 * Computes the resulting model instance type after applying a mixin tuple to a base model class.
 */
export type ComposedModelInstance<
  B extends ModelClass<AnyModel>,
  M extends readonly ModelMixin<any, any, any>[],
> = InstanceType<ComposedModelClass<B, M>>

type ValidateMixins<
  B extends ModelClass<AnyModel>,
  M extends readonly ModelMixin<any, any, any>[],
> = M extends readonly [infer First, ...infer Rest]
  ? First extends ModelMixin<any, any, any>
    ? InstanceType<B> extends AnyModel & MixinReq<First>
      ? readonly [
          First,
          ...ValidateMixins<
            ApplyMixin<B, First>,
            Extract<Rest, readonly ModelMixin<any, any, any>[]>
          >,
        ]
      : never
    : never
  : readonly []

/**
 * Defines a model mixin from a `ModelProps` object.
 *
 * `ModelData` / `ModelCreationData` on the composed class resolve to the exact prop types.
 *
 * @template MP Model properties type (inferred from `props`).
 * @param props Model properties object.
 *
 * @example
 * const countableMixin = defineModelMixin({ quantity: tProp(types.number, 0) })
 */
export function defineModelMixin<MP extends ModelProps>(
  props: MP
): ModelMixin<ModelPropsToTransformedData<MP>, unknown, MP>

/**
 * Defines a model mixin from a `ModelProps` object, with a requirement on the base model.
 *
 * Pass `req<Req>()` as the second argument to declare that the base model must already contain the
 * `Req` shape before the mixin is applied.
 *
 * @template Req Shape that must exist on the base model instance (specified via `req<Req>()`).
 * @template MP Model properties type (inferred from `props`).
 * @param props Model properties object.
 * @param requirement Requirement marker created by `req<Req>()`.
 *
 * @example
 * const producerMixin = defineModelMixin(
 *   { produced: tProp(types.number, 0) },
 *   req<{ quantity: number }>()
 * )
 */
export function defineModelMixin<Req extends object, MP extends ModelProps>(
  props: MP,
  requirement: ReqMarker<Req>
): ModelMixin<ModelPropsToTransformedData<MP>, Req, MP>

/**
 * Defines a model mixin from a `ModelProps` object and a builder that can add actions and other
 * methods.
 *
 * The props are applied via `ExtendedModel` first; the resulting pre-extended class is passed to
 * the builder so you can simply `extend Base` without calling `ExtendedModel` yourself.
 * `ModelData` / `ModelCreationData` resolve to the exact prop types from `MP`.
 *
 * @template MP Model properties type (inferred from `props`).
 * @template C Built class type (inferred from `build` return type).
 * @param props Model properties object.
 * @param build Builder receiving the pre-extended base class.
 *
 * @example
 * const countableMixin = defineModelMixin(
 *   { quantity: tProp(types.number, 0) },
 *   (Base) => class Countable extends Base {
 *     increment() { this.quantity++ }
 *   }
 * )
 */
export function defineModelMixin<
  MP extends ModelProps,
  C extends AbstractModelClass<AnyModel & ModelPropsToTransformedData<MP>>,
>(
  props: MP,
  build: (base: AbstractModelClass<AnyModel & ModelPropsToTransformedData<MP>>) => C
): ModelMixin<Omit<InstanceType<C>, BaseModelKeys>, unknown, MP>

/**
 * Defines a model mixin from a `ModelProps` object and a builder, with a requirement on the base
 * model.
 *
 * Pass `req<Req>()` as the second argument to declare that the base model must already contain the
 * `Req` shape. The `Base` class received by the builder includes both the prop types and `Req`.
 *
 * @template Req Shape that must exist on the base model instance (specified via `req<Req>()`).
 * @template MP Model properties type (inferred from `props`).
 * @template C Built class type (inferred from `build` return type).
 * @param props Model properties object.
 * @param requirement Requirement marker created by `req<Req>()`.
 * @param build Builder receiving the pre-extended base class (typed with both props and `Req`).
 *
 * @example
 * const producerMixin = defineModelMixin(
 *   { produced: tProp(types.number, 0) },
 *   req<{ quantity: number }>(),
 *   (Base) => class Producer extends Base {
 *     produceTotal() { return this.produced + this.quantity }
 *   }
 * )
 */
export function defineModelMixin<
  Req extends object,
  MP extends ModelProps,
  C extends AbstractModelClass<AnyModel & ModelPropsToTransformedData<MP>>,
>(
  props: MP,
  requirement: ReqMarker<Req>,
  build: (base: AbstractModelClass<AnyModel & ModelPropsToTransformedData<MP> & Req>) => C
): ModelMixin<Omit<InstanceType<C>, BaseModelKeys>, Req, MP>

// implementation
export function defineModelMixin(...args: any[]): any {
  const props: ModelProps = args[0]
  let build: ((base: AbstractModelClass<AnyModel>) => AbstractModelClass<AnyModel>) | undefined

  if (args.length === 3) {
    // (props, req, build)
    build = args[2]
  } else if (args.length === 2 && !isReqMarker(args[1])) {
    // (props, build)
    build = args[1]
  }
  // else: (props) or (props, req) — build stays undefined

  return (<B extends ModelClass<AnyModel>>(base: B) => {
    const extended = ExtendedModel(modelClass(base) as any, props) as AbstractModelClass<AnyModel>
    return (build ? build(extended) : extended) as unknown as ModelClass<InstanceType<B>>
  }) as ModelMixin<any, any, any>
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
  M extends readonly ModelMixin<any, any, any>[],
>(base: B, ...mixins: M & ValidateMixins<B, M>): ComposedModelClass<B, M> {
  let current = base as ModelClass<AnyModel>

  for (const mixin of mixins) {
    current = mixin(current)
  }

  return current as ComposedModelClass<B, M>
}

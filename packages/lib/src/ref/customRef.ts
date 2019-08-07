import { computed, reaction } from "mobx"
import { ModelClass } from "../model/BaseModel"
import { Model } from "../model/Model"
import { model } from "../model/modelDecorator"
import { newModel } from "../model/newModel"
import { typesString } from "../typeChecking/primitives"
import { tProp } from "../typeChecking/tProp"
import { assertIsObject, failure } from "../utils"

/**
 * A reference model base type.
 * Use `customRef` to create a custom ref constructor.
 */
export abstract class Ref<T extends object> extends Model({
  /**
   * Reference id.
   */
  id: tProp(typesString),
}) {
  protected abstract resolve(): T | undefined

  /**
   * The object this reference points to, or undefined if the reference is currently invalid.
   */
  @computed
  get maybeCurrent(): T | undefined {
    return this.resolve()
  }

  /**
   * If the reference is currently valid.
   */
  @computed
  get isValid(): boolean {
    return !!this.maybeCurrent
  }

  /**
   * The object this reference points to, or throws if invalid.
   */
  @computed
  get current(): T {
    const current = this.maybeCurrent

    if (!current) {
      throw failure(
        `a reference of type '${this.$modelType}' could not resolve an object with id '${this.id}'`
      )
    }

    return current
  }
}

/**
 * Custom reference options.
 */
export interface CustomRefOptions<T extends object> {
  /**
   * Must return the resolution for the given reference object.
   *
   * @param ref Reference object.
   * @returns The resolved object or undefined if it could not be resolved.
   */
  resolve(ref: Ref<T>): T | undefined

  /**
   * Must return the ID associated to the given target object.
   *
   * @param target Target object.
   */
  getId(target: T): string

  /**
   * What should happen when the resolved value changes.
   *
   * @param ref Reference object.
   * @param newValue New resolved value.
   * @param oldValue Old resolved value.
   */
  onResolvedValueChange?(ref: Ref<T>, newValue: T | undefined, oldValue: T | undefined): void
}

export declare const customRefTypeSymbol: unique symbol

/** A ref constructor for custom refs */
export interface RefConstructor<T extends object> {
  (value: T): Ref<T>

  refClass: ModelClass<Ref<T>>

  /** @internal */
  [customRefTypeSymbol]: T // just for typings
}

/**
 * Creates a custom ref to an object, which in its snapshot form has an id.
 *
 * @typeparam T Target object type.
 * @param modelTypeId Unique model type id.
 * @param options Custom reference options.
 * @returns A function that allows you to construct that type of custom reference.
 */
export function customRef<T extends object>(
  modelTypeId: string,
  options: CustomRefOptions<T>
): RefConstructor<T> {
  @model(modelTypeId)
  class CustomRef extends Ref<T> {
    resolve(): T | undefined {
      return options.resolve(this)
    }
  }

  const fn = (target: T) => {
    assertIsObject(target, "target")

    const id = options.getId(target)
    const model = newModel(CustomRef, {
      id,
    })

    // listen to changes
    if (options.onResolvedValueChange) {
      let oldValue = model.maybeCurrent
      // TODO: will not disposing this leak?
      reaction(
        () => model.maybeCurrent,
        newValue => {
          if (newValue !== oldValue) {
            const savedOldValue = oldValue
            oldValue = newValue
            options.onResolvedValueChange!(model, newValue, savedOldValue)
          }
        },
        {
          fireImmediately: true,
        }
      )
    }

    return model
  }
  fn.refClass = CustomRef

  return (fn as any) as RefConstructor<T>
}

import { isModelAutoTypeCheckingEnabled } from "../globalConfig/globalConfig"
import { toTreeNode } from "../tweaker/tweak"
import type { AnyStandardType, TypeToData } from "../typeChecking/schemas"
import { typeCheck } from "../typeChecking/typeCheck"
import { assertIsString } from "../utils"
import { extendFnModelActions, FnModelActions, FnModelActionsDef } from "./actions"

declare const dataTypeSymbol: unique symbol

/**
 * Basic functional model methods.
 */
export interface FnModelBase<Data extends object, Extra> {
  // just to make typing work properly
  [dataTypeSymbol]: Data

  /**
   * Turns data into a tree node and additionally performs a type check
   * if model auto type checking is enabled in the global config
   * and a type was specified.
   *
   * @param data Model data.
   */
  create(data: Data): Data

  /**
   * Returns the type the model is based on, or `null` if none.
   */
  type: AnyStandardType | null

  /**
   * Adds actions to the model.
   *
   * @param actions Actions to add.
   */
  actions<A extends FnModelActionsDef>(
    actions: ThisType<Data> & A
  ): FnModel<Data, Extra & FnModelActions<Data, A>>
}

/**
 * Functional model.
 */
export type FnModel<Data extends object, Extra> = Extra & FnModelBase<Data, Extra>

/**
 * Gets the data type of a functional model.
 */
export type FnModelData<FN extends FnModelBase<any, any>> = FN[typeof dataTypeSymbol]

/**
 * Creates a functional model, which can be later extended with views, actions, etc.
 *
 * @typeparam DataType Data type.
 * @param dataType Data type, which must be of an object kind.
 * @param namespace Namespace for its actions.
 * @returns
 */
export function fnModel<DataType extends AnyStandardType>(
  dataType: DataType,
  namespace: string
): FnModel<TypeToData<DataType>, {}>

/**
 * Creates a functional model, which can be later extended with views, actions, etc.
 *
 * @typeparam Data Data type.
 * @param namespace Namespace for its actions.
 * @returns
 */
export function fnModel<Data extends object>(namespace: string): FnModel<Data, {}>

export function fnModel(arg1: any, arg2?: string): FnModel<any, {}> {
  const actualType: AnyStandardType | null = arguments.length >= 2 ? arg1 : null
  const namespace = arguments.length >= 2 ? (arg2 as string) : (arg1 as string)
  assertIsString(namespace, "namespace")

  const fnModelObj: Partial<FnModelBase<any, {}>> = {
    create: actualType
      ? fnModelCreateWithType.bind(undefined, actualType)
      : fnModelCreateWithoutType,
    type: actualType,
  }

  fnModelObj.actions = extendFnModelActions.bind(undefined, fnModelObj, namespace)

  return fnModelObj as FnModel<any, {}>
}

function fnModelCreateWithoutType<Data extends object>(data: Data): Data {
  return toTreeNode(data)
}

function fnModelCreateWithType<Data extends object>(actualType: AnyStandardType, data: Data): Data {
  if (isModelAutoTypeCheckingEnabled()) {
    const errors = typeCheck(actualType, data)
    if (errors) {
      errors.throw(data)
    }
  }
  return toTreeNode(data)
}

import * as mobx from "mobx"
import { HookAction } from "../action/hookActions"
import { wrapModelMethodInActionIfNeeded } from "../action/wrapInAction"
import {
  addHiddenProp,
  failure,
  getMobxVersion,
  logWarning,
  runLateInitializationFunctions,
} from "../utils"
import { AnyModel, ModelClass, modelInitializedSymbol } from "./BaseModel"
import { modelTypeKey } from "./metadata"
import { modelInfoByClass, modelInfoByName } from "./modelInfo"
import { modelUnwrappedClassSymbol } from "./modelSymbols"
import { assertIsModelClass } from "./utils"

/**
 * Decorator that marks this class (which MUST inherit from the `Model` abstract class)
 * as a model.
 *
 * @param name Unique name for the model type. Note that this name must be unique for your whole
 * application, so it is usually a good idea to use some prefix unique to your application domain.
 */
export const model = (name: string) => <MC extends ModelClass<AnyModel>>(clazz: MC): MC => {
  return internalModel(name)(clazz)
}

const internalModel = (name: string) => <MC extends ModelClass<AnyModel>>(clazz: MC): MC => {
  assertIsModelClass(clazz, "a model class")

  if (modelInfoByName[name]) {
    logWarning(
      "warn",
      `a model with name "${name}" already exists (if you are using hot-reloading you may safely ignore this warning)`,
      `duplicateModelName - ${name}`
    )
  }

  if ((clazz as any)[modelUnwrappedClassSymbol]) {
    throw failure("a class already decorated with `@model` cannot be re-decorated")
  }

  // trick so plain new works
  const newClazz: any = function (
    this: any,
    initialData: any,
    snapshotInitialData: any,
    generateNewIds: any
  ) {
    const instance = new (clazz as any)(
      initialData,
      snapshotInitialData,
      this.constructor,
      generateNewIds
    )

    runLateInitializationFunctions(instance)

    // compatibility with mobx 6
    if (getMobxVersion() >= 6) {
      try {
        ;(mobx as any).makeObservable(instance)
      } catch (err) {
        // sadly we need to use this hack since the PR to do this the proper way
        // was rejected on the mobx side
        if (
          err.message !==
          "[MobX] No annotations were passed to makeObservable, but no decorator members have been found either"
        ) {
          throw err
        }
      }
    }

    // the object is ready
    addHiddenProp(instance, modelInitializedSymbol, true, false)

    if (instance.onInit) {
      wrapModelMethodInActionIfNeeded(instance, "onInit", HookAction.OnInit)

      instance.onInit()
    }

    return instance
  }

  clazz.toString = () => `class ${clazz.name}#${name}`
  ;(clazz as any)[modelTypeKey] = name

  // this also gives access to modelInitializersSymbol, modelPropertiesSymbol, modelDataTypeCheckerSymbol
  Object.setPrototypeOf(newClazz, clazz)
  newClazz.prototype = clazz.prototype

  Object.defineProperty(newClazz, "name", {
    ...Object.getOwnPropertyDescriptor(newClazz, "name"),
    value: clazz.name,
  })
  newClazz[modelUnwrappedClassSymbol] = clazz

  const modelInfo = {
    name,
    class: newClazz,
  }

  modelInfoByName[name] = modelInfo

  modelInfoByClass.set(newClazz, modelInfo)
  modelInfoByClass.set(clazz, modelInfo)

  return newClazz
}

// basically taken from TS
function tsDecorate(decorators: any, target: any, key: any, desc: any) {
  var c = arguments.length,
    r =
      c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc,
    d
  if (typeof Reflect === "object" && typeof (Reflect as any).decorate === "function")
    r = (Reflect as any).decorate(decorators, target, key, desc)
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if ((d = decorators[i])) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r
  // eslint-disable-next-line no-sequences
  return c > 3 && r && Object.defineProperty(target, key, r), r
}

/**
 * Marks a class (which MUST inherit from the `Model` abstract class)
 * as a model and decorates some of its methods/properties.
 *
 * @param name Unique name for the model type. Note that this name must be unique for your whole
 * application, so it is usually a good idea to use some prefix unique to your application domain.
 * If you don't want to assign a name yet (e.g. for a base model) pass `undefined`.
 * @param clazz Model class.
 * @param decorators Decorators.
 */
export function decoratedModel<MC extends ModelClass<AnyModel>>(
  name: string | undefined,
  clazz: MC,
  decorators: {
    [k in keyof InstanceType<MC>]?:
      | ((...args: any[]) => any)
      | ReadonlyArray<(...args: any[]) => any>
  }
): MC {
  // decorate class members
  for (const [k, decorator] of Object.entries(decorators)) {
    const prototypeValueDesc = Object.getOwnPropertyDescriptor(clazz.prototype, k)
    // TS seems to send null for methods in the prototype
    // (which we substitute for the descriptor to avoid a double look-up) and void 0 (undefined) for props
    tsDecorate(
      Array.isArray(decorator) ? decorator : [decorator],
      clazz.prototype,
      k,
      prototypeValueDesc ? prototypeValueDesc : void 0
    )
  }

  return name ? model(name)(clazz) : clazz
}

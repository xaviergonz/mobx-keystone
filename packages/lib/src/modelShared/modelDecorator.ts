import { HookAction } from "../action/hookActions"
import { wrapModelMethodInActionIfNeeded } from "../action/wrapInAction"
import type { AnyDataModel } from "../dataModel/BaseDataModel"
import { isDataModelClass } from "../dataModel/utils"
import { getGlobalConfig } from "../globalConfig"
import type { AnyModel } from "../model/BaseModel"
import { modelTypeKey } from "../model/metadata"
import { isModelClass } from "../model/utils"
import { ModelClass, modelInitializedSymbol } from "../modelShared/BaseModelShared"
import { modelInfoByClass, modelInfoByName } from "../modelShared/modelInfo"
import {
  modelUnwrappedClassSymbol,
  runAfterModelDecoratorSymbol,
} from "../modelShared/modelSymbols"
import {
  addHiddenProp,
  failure,
  getMobxVersion,
  logWarning,
  mobx6,
  runAfterNewSymbol,
  runBeforeOnInitSymbol,
  runLateInitializationFunctions,
} from "../utils"

/**
 * Decorator that marks this class (which MUST inherit from the `Model` or `DataModel` abstract classes)
 * as a model.
 *
 * @param name Unique name for the model type. Note that this name must be unique for your whole
 * application, so it is usually a good idea to use some prefix unique to your application domain.
 */
export const model =
  (name: string) =>
  <MC extends ModelClass<AnyModel | AnyDataModel>>(clazz: MC): MC => {
    return internalModel(name)(clazz)
  }

const internalModel =
  (name: string) =>
  <MC extends ModelClass<AnyModel | AnyDataModel>>(clazz: MC): MC => {
    const type = isModelClass(clazz) ? "class" : isDataModelClass(clazz) ? "data" : undefined
    if (!type) {
      throw failure(`clazz must be a class that extends from Model/DataModel`)
    }

    if (modelInfoByName[name]) {
      if (getGlobalConfig().showDuplicateModelNameWarnings) {
        logWarning(
          "warn",
          `a model with name "${name}" already exists (if you are using hot-reloading you may safely ignore this warning)`,
          `duplicateModelName - ${name}`
        )
      }
    }

    if (modelUnwrappedClassSymbol in clazz) {
      throw failure("a class already decorated with `@model` cannot be re-decorated")
    }

    // trick so plain new works
    const newClazz: any = function (this: any, initialData: any, modelConstructorOptions: any) {
      const instance = new (clazz as any)(initialData, modelConstructorOptions)

      // set or else it points to the undecorated class
      Object.defineProperty(instance, "constructor", {
        configurable: true,
        writable: true,
        enumerable: false,
        value: newClazz,
      })

      runLateInitializationFunctions(instance, runAfterNewSymbol)

      // compatibility with mobx 6
      if (getMobxVersion() >= 6) {
        try {
          mobx6.makeObservable(instance)
        } catch (e) {
          const err = e as Error
          // sadly we need to use this hack since the PR to do this the proper way
          // was rejected on the mobx side
          if (
            err.message !==
              "[MobX] No annotations were passed to makeObservable, but no decorator members have been found either" &&
            err.message !==
              "[MobX] No annotations were passed to makeObservable, but no decorated members have been found either"
          ) {
            throw err
          }
        }
      }

      // the object is ready
      addHiddenProp(instance, modelInitializedSymbol, true, false)

      runLateInitializationFunctions(instance, runBeforeOnInitSymbol)

      if (type === "class" && instance.onInit) {
        wrapModelMethodInActionIfNeeded(instance, "onInit", HookAction.OnInit)

        instance.onInit()
      }

      if (type === "data" && instance.onLazyInit) {
        wrapModelMethodInActionIfNeeded(instance, "onLazyInit", HookAction.OnLazyInit)

        instance.onLazyInit()
      }

      return instance
    }

    clazz.toString = () => `class ${clazz.name}#${name}`
    if (type === "class") {
      ;(clazz as any)[modelTypeKey] = name
    }

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

    runLateInitializationFunctions(clazz, runAfterModelDecoratorSymbol)

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
export function decoratedModel<M, MC extends abstract new (...ags: any) => M>(
  name: string | undefined,
  clazz: MC,
  decorators: {
    [k in keyof M]?: ((...args: any[]) => any) | ReadonlyArray<(...args: any[]) => any>
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

  return (name ? model(name)(clazz as unknown as ModelClass<AnyModel>) : clazz) as MC
}

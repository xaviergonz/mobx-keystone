import { AnyFunction } from "../utils/AnyFunction"
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
  <MC extends ModelClass<AnyModel | AnyDataModel>>(clazz: MC, ...args: any[]): MC => {
    const ctx = typeof args[1] === "object" ? (args[1] as ClassDecoratorContext) : undefined

    return internalModel(name, clazz, ctx?.addInitializer) as any
  }

const afterClassInitializationData = new WeakMap<
  ModelClass<AnyModel | AnyDataModel>,
  {
    needsMakeObservable: boolean | undefined
    type: "class" | "data"
  }
>()

const runAfterClassInitialization = (
  target: ModelClass<AnyModel | AnyDataModel>,
  instance: any
) => {
  runLateInitializationFunctions(instance, runAfterNewSymbol)

  const tag = afterClassInitializationData.get(target)!

  // compatibility with mobx 6
  if (tag.needsMakeObservable) {
    // we know it can be done and shouldn't fail
    mobx6.makeObservable(instance)
  } else if (tag.needsMakeObservable === undefined) {
    if (getMobxVersion() >= 6) {
      try {
        mobx6.makeObservable(instance)
        tag.needsMakeObservable = true
      } catch (e) {
        const err = e as Error
        if (
          err.message !==
            "[MobX] No annotations were passed to makeObservable, but no decorator members have been found either" &&
          err.message !==
            "[MobX] No annotations were passed to makeObservable, but no decorated members have been found either"
        ) {
          throw err
        }

        // sadly we need to use this hack since the PR to do this the proper way
        // was rejected on the mobx side
        tag.needsMakeObservable = false
      }
    } else {
      tag.needsMakeObservable = false
    }
  }

  // the object is ready
  instance[modelInitializedSymbol] = true

  runLateInitializationFunctions(instance, runBeforeOnInitSymbol)

  if (tag.type === "class" && instance.onInit) {
    wrapModelMethodInActionIfNeeded(instance, "onInit", HookAction.OnInit)

    instance.onInit()
  }

  if (tag.type === "data" && instance.onLazyInit) {
    wrapModelMethodInActionIfNeeded(instance, "onLazyInit", HookAction.OnLazyInit)

    instance.onLazyInit()
  }
}

const proxyClassHandler: ProxyHandler<ModelClass<AnyModel | AnyDataModel>> = {
  construct(clazz, args) {
    const instance = new (clazz as any)(...args)

    runAfterClassInitialization(clazz, instance)

    return instance
  },
}

const internalModel = <MC extends ModelClass<AnyModel | AnyDataModel>>(
  name: string,
  clazz: MC,
  addInitializer: ((initializer: (this: any) => void) => void) | undefined
): MC | void => {
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

  if (modelUnwrappedClassSymbol in clazz && clazz[modelUnwrappedClassSymbol] === clazz) {
    throw failure("a class already decorated with `@model` cannot be re-decorated")
  }

  clazz.toString = () => `class ${clazz.name}#${name}`
  if (type === "class") {
    ;(clazz as any)[modelTypeKey] = name
  }

  // track if we fail so we only try it once per class
  afterClassInitializationData.set(clazz, { needsMakeObservable: undefined, type })

  if (addInitializer) {
    // standard decorator API, avoid proxies
    addInitializer(function (this: any) {
      runAfterClassInitialization(clazz, this)
    })

    const modelInfo = {
      name,
      class: clazz,
    }

    modelInfoByName[name] = modelInfo

    modelInfoByClass.set(clazz, modelInfo)

    runLateInitializationFunctions(clazz, runAfterModelDecoratorSymbol)

    return undefined // use same class
  } else {
    // non-standard decorator API, use proxies

    // trick so plain new works
    const proxyClass = new Proxy<MC>(clazz, proxyClassHandler)

    // set or else it points to the undecorated class
    proxyClass.prototype.constructor = proxyClass
    ;(proxyClass as any)[modelUnwrappedClassSymbol] = clazz

    const modelInfo = {
      name,
      class: proxyClass,
    }

    modelInfoByName[name] = modelInfo

    modelInfoByClass.set(proxyClass, modelInfo)
    modelInfoByClass.set(clazz, modelInfo)

    runLateInitializationFunctions(clazz, runAfterModelDecoratorSymbol)

    return proxyClass
  }
}

// basically taken from TS
function tsDecorate(decorators: any, target: any, key: any, desc: any) {
  const c = arguments.length
  let r =
    c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc
  let d: any
  if (typeof Reflect === "object" && typeof (Reflect as any).decorate === "function") {
    r = (Reflect as any).decorate(decorators, target, key, desc)
  } else {
    for (
      // biome-ignore lint: intended
      var i = decorators.length - 1;
      i >= 0;
      i--
    ) {
      if ((d = decorators[i])) {
        r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r
      }
    }
  }
  // biome-ignore lint/complexity/noCommaOperator: copied from ts
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
    [k in keyof M]?: AnyFunction | ReadonlyArray<AnyFunction>
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

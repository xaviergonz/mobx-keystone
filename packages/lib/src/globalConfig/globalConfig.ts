import { nanoid } from "nanoid/non-secure"
import { failure, inDevMode } from "../utils"

/**
 * Model auto type-checking mode.
 */
export enum ModelAutoTypeCheckingMode {
  /**
   * Auto type check models only in dev mode
   */
  DevModeOnly = "devModeOnly",
  /**
   * Auto type check models no matter the current environment
   */
  AlwaysOn = "alwaysOn",
  /**
   * Do not auto type check models no matter the current environment
   */
  AlwaysOff = "alwaysOff",
}

/**
 * Global config object.
 */
export interface GlobalConfig {
  /**
   * Model auto type-checking mode.
   */
  modelAutoTypeChecking: ModelAutoTypeCheckingMode

  /**
   * ID generator function for model ids.
   */
  modelIdGenerator(): string

  /**
   * Allow array elements to be `undefined`.
   */
  allowUndefinedArrayElements: boolean

  /**
   * Enables/disables warnings related to duplicated model names (defaults to `true`).
   * Usually set to false in test environments (e.g. jest).
   */
  showDuplicateModelNameWarnings: boolean
}

let localId = 0
const localBaseId = nanoid()

function defaultModelIdGenerator(): string {
  // we use base 36 for local id since it is short and fast
  const id = localId.toString(36) + "-" + localBaseId
  localId++
  return id
}

// defaults
let globalConfig: GlobalConfig = {
  modelAutoTypeChecking: ModelAutoTypeCheckingMode.DevModeOnly,
  modelIdGenerator: defaultModelIdGenerator,
  allowUndefinedArrayElements: false,
  showDuplicateModelNameWarnings: true,
}

/**
 * Partially sets the current global config.
 *
 * @param config Partial object with the new configurations. Options not included in the object won't be changed.
 */
export function setGlobalConfig(config: Partial<GlobalConfig>) {
  globalConfig = Object.freeze({
    ...globalConfig,
    ...config,
  })
}

/**
 * Returns the current global config object.
 *
 * @returns
 */
export function getGlobalConfig(): Readonly<GlobalConfig> {
  return globalConfig
}

/**
 * @internal
 *
 * Returns if the auto type checking for models is enabled.
 *
 * @returns
 */
export function isModelAutoTypeCheckingEnabled() {
  switch (getGlobalConfig().modelAutoTypeChecking) {
    case ModelAutoTypeCheckingMode.DevModeOnly:
      return inDevMode
    case ModelAutoTypeCheckingMode.AlwaysOff:
      return false
    case ModelAutoTypeCheckingMode.AlwaysOn:
      return true
    default:
      throw failure(
        `invalid 'modelAutoTypeChecking' config value - ${globalConfig.modelAutoTypeChecking}`
      )
  }
}

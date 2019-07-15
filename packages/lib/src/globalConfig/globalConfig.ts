import { failure, inDevMode } from "../utils"

/**
 * Model auto type-checking mode.
 */
export enum ModelAutoTypeCheckingMode {
  DevModeOnly = "devModeOnly",
  AlwaysOn = "alwaysOn",
  AlwaysOff = "alwaysOff",
}

/**
 * Global config object.
 */
export interface GlobalConfig {
  modelAutoTypeChecking: ModelAutoTypeCheckingMode
}

let globalConfig: GlobalConfig = {
  modelAutoTypeChecking: ModelAutoTypeCheckingMode.DevModeOnly,
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
 * @ignore
 *
 * Returns if the auto type checking for models is enabled.
 *
 * @returns
 */
export function isModelAutoTypeCheckingEnabled() {
  switch (getGlobalConfig().modelAutoTypeChecking) {
    case ModelAutoTypeCheckingMode.DevModeOnly:
      return inDevMode()
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

import { v4 as uuidv4 } from "uuid"
import { failure, inDevMode } from "../utils"
import { toBase64 } from "../utils/toBase64"

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
   * Model auto type-checkig mode.
   */
  modelAutoTypeChecking: ModelAutoTypeCheckingMode

  /**
   * ID generator function for $modelId.
   */
  modelIdGenerator(): string
}

let localId = 0
const localBaseId = shortenUuid(uuidv4())

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
 * @internal
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

function shortenUuid(uuid: string): string {
  // remove non-hex chars
  const hex = uuid.split("-").join("")

  // convert to base64
  const hexMatch = hex.match(/\w{2}/g)!
  const str = String.fromCharCode.apply(
    null,
    hexMatch.map(a => parseInt(a, 16))
  )

  return toBase64(str)
}

/**
 * @ignore
 */
export interface Config {
  allowArrayElementUndefined: boolean
}

const config: Config = {
  allowArrayElementUndefined: false,
}

/**
 * @ignore
 */
export function getConfig(): Readonly<Config> {
  return config
}

/**
 * Sets global configuration options.
 *
 * @param options Configuration options.
 */
export function configure(options: Readonly<Partial<Config>>): void {
  if (options.allowArrayElementUndefined !== undefined) {
    config.allowArrayElementUndefined = options.allowArrayElementUndefined
  }
}

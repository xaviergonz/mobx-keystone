import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

const require = createRequire(import.meta.url)
const typescript6Url = pathToFileURL(require.resolve("@typescript/typescript6")).href

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "typescript" && context.parentURL?.includes("/typedoc/")) {
    return {
      url: typescript6Url,
      shortCircuit: true,
    }
  }

  return nextResolve(specifier, context)
}

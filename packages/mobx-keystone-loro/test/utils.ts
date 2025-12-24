import { model } from "mobx-keystone"

type Disposer = () => void

const disposers: Disposer[] = []

afterEach(() => {
  for (const d of disposers) {
    try {
      d()
    } catch {
      // Ignore dispose errors
    }
  }
  disposers.length = 0
})

export function autoDispose(disposer: Disposer) {
  disposers.push(disposer)
}

export async function delay(ms: number) {
  return new Promise<number>((r) =>
    setTimeout(() => {
      r(ms)
    }, ms)
  )
}

export const testModel = (name: string) => {
  const testName = expect.getState().currentTestName
  const modelName = testName ? `${testName}/${name}` : name
  return model(modelName)
}

/**
 * Normalizes a snapshot by removing undefined values.
 */
export function normalizeSnapshot(sn: any): any {
  if (sn === undefined) return undefined
  if (sn === null) return null
  if (Array.isArray(sn)) {
    return sn.map(normalizeSnapshot)
  }
  if (typeof sn === "object") {
    const result: any = {}
    for (const [key, value] of Object.entries(sn)) {
      if (value !== undefined) {
        result[key] = normalizeSnapshot(value)
      }
    }
    return result
  }
  return sn
}

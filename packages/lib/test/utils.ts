import { model } from "../src"

type Disposer = () => void

const disposers: Disposer[] = []

afterEach(() => {
  disposers.forEach((d) => d())
  disposers.length = 0
})

export function autoDispose(disposer: Disposer) {
  disposers.push(disposer)
}

export function emulateProdMode(fn: () => void) {
  const oldEnv = process.env.NODE_ENV
  process.env.NODE_ENV = "production"
  try {
    fn()
  } finally {
    process.env.NODE_ENV = oldEnv
  }
}

export async function delay(x: number) {
  return new Promise<number>((r) => setTimeout(() => r(x), x))
}

export function timeMock() {
  const now = Date.now()

  return {
    async advanceTimeTo(x: number) {
      await delay(now + x - Date.now())
    },
  }
}

export const testModel = (name: string) => {
  const testName = expect.getState().currentTestName
  const modelName = testName ? `${testName}/${name}` : name
  return model(modelName)
}

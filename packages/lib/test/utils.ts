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

type Disposer = () => void

const disposers: Disposer[] = []

afterEach(() => {
  disposers.forEach(d => d())
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

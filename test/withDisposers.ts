type Disposer = () => void

const disposers: Disposer[] = []

afterEach(() => {
  disposers.forEach(d => d())
  disposers.length = 0
})

export function autoDispose(disposer: Disposer) {
  disposers.push(disposer)
}

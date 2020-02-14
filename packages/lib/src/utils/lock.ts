export class Lock {
  private _locked = true

  get isLocked() {
    return this._locked
  }

  unlockedFn<F extends (...args: any[]) => any>(fn: F): F {
    const innerFn: any = (...args: any[]) => {
      const oldLocked = this._locked
      this._locked = false
      try {
        return fn(...args)
      } finally {
        this._locked = oldLocked
      }
    }

    return innerFn
  }

  withUnlock<F extends () => any>(fn: F): ReturnType<F> {
    const oldLocked = this._locked
    this._locked = false
    try {
      return fn()
    } finally {
      this._locked = oldLocked
    }
  }
}

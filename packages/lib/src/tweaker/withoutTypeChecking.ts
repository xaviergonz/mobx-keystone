let typeCheckingAllowed = true

export function withoutTypeChecking(fn: () => void): void {
  let oldTypeCheckingAllowed = typeCheckingAllowed
  typeCheckingAllowed = false

  try {
    fn()
  } finally {
    typeCheckingAllowed = oldTypeCheckingAllowed
  }
}

export function isTypeCheckingAllowed() {
  return typeCheckingAllowed
}

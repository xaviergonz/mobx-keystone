let mutationBatchActive = false
let mutationBatchFinishers: (() => void) | (() => void)[] | undefined

/**
 * Starts a synchronous mutation batch if one is not already active.
 *
 * @returns `true` if this call owns the batch and must finish it.
 * @internal
 */
export function startMutationBatch(): boolean {
  if (mutationBatchActive) {
    return false
  }

  mutationBatchActive = true
  return true
}

/**
 * @internal
 */
export function isMutationBatchActive(): boolean {
  return mutationBatchActive
}

/**
 * Registers a callback to run when the outermost synchronous mutation batch
 * ends. The first callback is stored directly so the common single-finisher
 * case does not allocate an array.
 *
 * @internal
 */
export function addMutationBatchFinisher(finisher: () => void): void {
  const currentFinishers = mutationBatchFinishers
  if (!currentFinishers) {
    mutationBatchFinishers = finisher
  } else if (typeof currentFinishers === "function") {
    mutationBatchFinishers = [currentFinishers, finisher]
  } else {
    currentFinishers.push(finisher)
  }
}

/**
 * Finishes a batch started by `startMutationBatch`. Every finisher runs even
 * if an earlier one throws, so a finisher's cleanup of its own module state
 * cannot be skipped by another consumer's exception.
 *
 * @internal
 */
export function finishMutationBatch(): void {
  mutationBatchActive = false

  const finishers = mutationBatchFinishers
  mutationBatchFinishers = undefined

  if (typeof finishers === "function") {
    finishers()
  } else if (finishers) {
    let lastError: { value: unknown } | undefined
    for (let i = finishers.length - 1; i >= 0; i--) {
      try {
        finishers[i]()
      } catch (value) {
        lastError = { value }
      }
    }
    if (lastError) {
      throw lastError.value
    }
  }
}

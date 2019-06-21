import { Patch } from "immer"
import { onPatches } from "./emitPatch"

/**
 * Patch recorder interface.
 */
export interface PatchRecorder {
  /**
   * Target object.
   */
  readonly target: object

  /**
   * Gets/sets if the patch recorder is currently recording.
   */
  recording: boolean

  /**
   * Patches.
   */
  readonly patches: Patch[]

  /**
   * Inverse patches.
   */
  readonly inversePatches: Patch[]

  /**
   * Dispose of the patch recorder.
   */
  dispose(): void
}

/**
 * Creates a patch recorder.
 *
 * @param target
 * @param [opts]
 * @returns The patch recorder.
 */
export function patchRecorder(
  target: object,
  opts?: { recording?: boolean; filter?(patches: Patch[], inversePatches: Patch[]): boolean }
): PatchRecorder {
  let { recording, filter } = {
    recording: true,
    filter: alwaysAcceptFilter,
    ...opts,
  }

  const patches: Patch[] = []
  const invPatches: Patch[] = []

  const onPatchesDisposer = onPatches(target, (p, invP) => {
    if (recording && filter(p, invP)) {
      patches.push(...p)
      // inversed since inverse patches have to be applied in inverse order
      invPatches.unshift(...invP)
    }
  })

  return {
    get target() {
      return target
    },
    get recording() {
      return recording
    },
    set recording(enabled: boolean) {
      recording = enabled
    },
    get patches() {
      return patches
    },
    get inversePatches() {
      return invPatches
    },
    dispose() {
      onPatchesDisposer()
    },
  }
}

const alwaysAcceptFilter = () => true

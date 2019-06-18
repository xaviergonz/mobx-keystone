import { Patch } from "immer"
import { onPatches } from "./emitPatch"

/**
 * Patch recorder interface.
 */
export interface PatchRecorder {
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
 * @param recording
 * @returns The patch recorder.
 */
export function patchRecorder(target: object, opts?: { recording?: boolean }): PatchRecorder {
  const realOpts = {
    recording: true,
    ...opts,
  }

  let recording = realOpts.recording

  const patches: Patch[] = []
  const invPatches: Patch[] = []

  const onPatchesDisposer = onPatches(target, (p, invP) => {
    if (recording) {
      patches.push(...p)
      // inversed since inverse patches have to be applied in inverse order
      invPatches.unshift(...invP)
    }
  })

  return {
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

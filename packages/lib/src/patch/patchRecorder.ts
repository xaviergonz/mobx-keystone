import { onGlobalPatches, onPatches, OnPatchesDisposer } from "./emitPatch"
import { Patch } from "./Patch"

/**
 * Patch recorder event.
 */
export interface PatchRecorderEvent {
  /**
   * Target object.
   */
  readonly target: object
  /**
   * Recorded patches.
   */
  readonly patches: Patch[]
  /**
   * Recorded inverse patches.
   */
  readonly inversePatches: Patch[]
}

/**
 * Patch recorder interface.
 */
export interface PatchRecorder {
  /**
   * Gets/sets if the patch recorder is currently recording.
   */
  recording: boolean

  /**
   * Patching events.
   */
  readonly events: PatchRecorderEvent[]

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
  return internalPatchRecorder(target, opts)
}

/**
 * @ignore
 *
 * Creates a global or local patch recorder.
 *
 * @param target
 * @param [opts]
 * @returns The patch recorder.
 */
export function internalPatchRecorder(
  target: object | undefined,
  opts?: { recording?: boolean; filter?(patches: Patch[], inversePatches: Patch[]): boolean }
): PatchRecorder {
  let { recording, filter } = {
    recording: true,
    filter: alwaysAcceptFilter,
    ...opts,
  }

  const events: PatchRecorderEvent[] = []

  let onPatchesDisposer: OnPatchesDisposer

  if (target) {
    onPatchesDisposer = onPatches(target, (p, invP) => {
      if (recording && filter(p, invP)) {
        events.push({
          target,
          patches: p,
          inversePatches: invP,
        })
      }
    })
  } else {
    onPatchesDisposer = onGlobalPatches((target, p, invP) => {
      if (recording && filter(p, invP)) {
        events.push({
          target,
          patches: p,
          inversePatches: invP,
        })
      }
    })
  }

  return {
    get recording() {
      return recording
    },
    set recording(enabled: boolean) {
      recording = enabled
    },
    get events() {
      return events
    },
    dispose() {
      onPatchesDisposer()
    },
  }
}

const alwaysAcceptFilter = () => true

import { Patch } from "immer"
import { onGlobalPatches } from "./emitPatch"

/**
 * @internal
 *
 * Global patch recorder interface.
 */
export interface GlobalPatchRecorder {
  /**
   * Gets/sets if the patch recorder is currently recording.
   */
  recording: boolean

  /**
   * Patching events.
   */
  readonly events: {
    target: object
    patches: Patch[]
    inversePatches: Patch[]
  }[]

  /**
   * Dispose of the patch recorder.
   */
  dispose(): void
}

/**
 * @internal
 *
 * Creates a global patch recorder.
 *
 * @param [opts]
 * @returns The global patch recorder.
 */
export function globalPatchRecorder(opts?: {
  recording?: boolean
  filter?(patches: Patch[], inversePatches: Patch[]): boolean
}): GlobalPatchRecorder {
  let { recording, filter } = {
    recording: true,
    filter: alwaysAcceptFilter,
    ...opts,
  }

  const events: GlobalPatchRecorder["events"] = []

  const onPatchesDisposer = onGlobalPatches((target, p, invP) => {
    if (recording && filter(p, invP)) {
      events.push({
        target,
        patches: p,
        inversePatches: invP,
      })
    }
  })

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

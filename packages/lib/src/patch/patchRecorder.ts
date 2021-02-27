import { observable } from "mobx"
import { assertTweakedObject } from "../tweaker/core"
import { onGlobalPatches, onPatches, OnPatchesDisposer, OnPatchesListener } from "./emitPatch"
import type { Patch } from "./Patch"

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
   * Observable array of patching events.
   */
  readonly events: PatchRecorderEvent[]

  /**
   * Dispose of the patch recorder.
   */
  dispose(): void
}

/**
 * Patch recorder options.
 */
export interface PatchRecorderOptions {
  /**
   * If the patch recorder is initilly recording when created.
   */
  recording?: boolean

  /**
   * An optional callback filter to select wich patches to record/skip.
   * It will be executed before the event is added to the events list.
   *
   * @param patches Patches about to be recorded.
   * @param inversePatches Inverse patches about to be recorded.
   * @returns `true` to record the patch, `false` to skip it.
   */
  filter?(patches: Patch[], inversePatches: Patch[]): boolean

  /**
   * An optional callback run once a patch is recorded.
   * It will be executed after the event is added to the events list.
   *
   * @param patches Patches just recorded.
   * @param inversePatches Inverse patches just recorded.
   */
  onPatches?: OnPatchesListener
}

/**
 * Creates a patch recorder.
 *
 * @param subtreeRoot
 * @param [opts]
 * @returns The patch recorder.
 */
export function patchRecorder(subtreeRoot: object, opts?: PatchRecorderOptions): PatchRecorder {
  assertTweakedObject(subtreeRoot, "subtreeRoot")

  return internalPatchRecorder(subtreeRoot, opts)
}

/**
 * @ignore
 * @internal
 *
 * Creates a global or local patch recorder.
 *
 * @param subtreeRoot
 * @param [opts]
 * @returns The patch recorder.
 */
export function internalPatchRecorder(
  subtreeRoot: object | undefined,
  opts?: PatchRecorderOptions
): PatchRecorder {
  let { recording, filter } = {
    recording: true,
    filter: alwaysAcceptFilter,
    ...opts,
  }

  const events = observable.array<PatchRecorderEvent>([], {
    deep: false,
  })

  let onPatchesDisposer: OnPatchesDisposer

  if (subtreeRoot) {
    onPatchesDisposer = onPatches(subtreeRoot, (p, invP) => {
      if (recording && filter(p, invP)) {
        events.push({
          target: subtreeRoot,
          patches: p,
          inversePatches: invP,
        })
        opts?.onPatches?.(p, invP)
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
        opts?.onPatches?.(p, invP)
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

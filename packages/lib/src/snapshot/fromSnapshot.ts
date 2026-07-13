import { action, observable } from "mobx"
import type { AnyModel } from "../model/BaseModel"
import { isReservedModelKey } from "../model/metadata"
import { resolveStandardTypeNoThrow, resolveTypeChecker } from "../types/resolveTypeChecker"
import type { AnyType, TypeToData, TypeToSnapshotIn } from "../types/schemas"
import { isLateTypeChecker, TypeChecker } from "../types/TypeChecker"
import { resolveCodecSupport } from "../types/utility/typesCodec"
import { isMap, isPrimitive, isSet, setProtoProp } from "../utils"
import {
  getCurrentErrorDiagnosticsContext,
  runWithErrorDiagnosticsContext,
} from "../utils/errorDiagnostics"
import { registerDefaultSnapshotters } from "./registerDefaultSnapshotters"
import type { SnapshotInOf, SnapshotInOfModel, SnapshotOutOf } from "./SnapshotOf"
import { SnapshotProcessingError } from "./SnapshotProcessingError"

/**
 * @internal
 */
export type Snapshotter = (sn: any, ctx: FromSnapshotContext) => any

const snapshotters: { priority: number; snapshotter: Snapshotter }[] = []

/**
 * @internal
 */
export function registerSnapshotter(priority: number, snapshotter: Snapshotter): void {
  snapshotters.push({ priority, snapshotter })
  snapshotters.sort((a, b) => a.priority - b.priority)
}

/**
 * From snapshot options.
 */
export interface FromSnapshotOptions {
  /**
   * Pass `true` to generate new internal ids for models rather than reusing them. (Default is `false`)
   */
  generateNewIds: boolean
}

/**
 * @internal
 */
export interface FromSnapshotContext {
  options: FromSnapshotOptions
  snapshotToInitialData: (processedSn: SnapshotInOfModel<AnyModel>) => any
  untypedSnapshot: unknown
}

/**
 * Given a type deserializes a data structure from its snapshot form.
 *
 * @template TType Object type.
 * @param type Type.
 * @param snapshot Snapshot, even if a primitive.
 * @param options Options.
 * @returns The deserialized object.
 */
export function fromSnapshot<TType extends AnyType>(
  type: TType,
  snapshot: TypeToSnapshotIn<TType>,
  options?: Partial<FromSnapshotOptions>
): TypeToData<TType>

/**
 * Deserializes a data structure from its snapshot form.
 *
 * @template T Object type.
 * @param snapshot Snapshot, even if a primitive.
 * @param options Options.
 * @returns The deserialized object.
 */
export function fromSnapshot<T>(
  snapshot: SnapshotInOf<T> | SnapshotOutOf<T>,
  options?: Partial<FromSnapshotOptions>
): T

export function fromSnapshot<T>(arg1: any, arg2: any, arg3?: any): T {
  return runWithErrorDiagnosticsContext(() => {
    let snapshot: any
    let unprocessedSnapshot: unknown
    let options: Partial<FromSnapshotOptions> | undefined
    // biome-ignore lint/complexity/noArguments: overload resolution needs the real call arity to distinguish omitted snapshots from omitted type args.
    const standardType = arguments.length >= 2 ? resolveStandardTypeNoThrow(arg1) : undefined

    if (isLateTypeChecker(arg1) || arg1 instanceof TypeChecker || standardType) {
      const resolvedType = standardType ?? arg1
      const codecSupport = resolveCodecSupport(resolvedType)

      if (codecSupport.hasCodec) {
        unprocessedSnapshot = arg2
        snapshot = resolveTypeChecker(codecSupport.storedType).fromSnapshotProcessor(
          unprocessedSnapshot
        )
        options = arg3
        const storedValue = fromSnapshotAction(snapshot, unprocessedSnapshot, options)
        return codecSupport.adapter.toRuntime(storedValue)
      }

      const typeChecker = resolveTypeChecker(resolvedType)
      unprocessedSnapshot = arg2
      snapshot = typeChecker.fromSnapshotProcessor(unprocessedSnapshot)
      options = arg3
    } else {
      snapshot = arg1
      unprocessedSnapshot = snapshot
      options = arg2
    }

    return fromSnapshotAction(snapshot, unprocessedSnapshot, options)
  })
}

const fromSnapshotAction = action(
  "fromSnapshot",
  <T>(
    snapshot: SnapshotInOf<T>,
    unprocessedSnapshot: unknown,
    options: Partial<FromSnapshotOptions> | undefined
  ): T => {
    const opts = {
      generateNewIds: false,
      overrideRootModelId: undefined,
      ...options,
    }

    const ctx: Partial<FromSnapshotContext> = {
      options: opts,
      untypedSnapshot: unprocessedSnapshot,
    }
    ctx.snapshotToInitialData = snapshotToInitialData.bind(undefined, ctx as FromSnapshotContext)

    return internalFromSnapshot<T>(snapshot, ctx as FromSnapshotContext)
  }
)

/**
 * @internal
 */
export function internalFromSnapshot<T>(
  sn: SnapshotInOf<T> | SnapshotOutOf<T>,
  ctx: FromSnapshotContext
): T {
  if (isPrimitive(sn)) {
    return sn as any
  }

  registerDefaultSnapshotters()

  const snapshotterLen = snapshotters.length
  for (let i = 0; i < snapshotterLen; i++) {
    const { snapshotter } = snapshotters[i]
    const ret = snapshotter(sn, ctx)
    if (ret !== undefined) {
      return ret
    }
  }

  if (isMap(sn)) {
    throw new SnapshotProcessingError({
      message: "a snapshot must not contain maps",
      actualSnapshot: sn,
    })
  }

  if (isSet(sn)) {
    throw new SnapshotProcessingError({
      message: "a snapshot must not contain sets",
      actualSnapshot: sn,
    })
  }

  throw new SnapshotProcessingError({
    message: "unsupported snapshot",
    actualSnapshot: sn,
  })
}

function snapshotToInitialData(
  ctx: FromSnapshotContext,
  processedSn: SnapshotInOfModel<AnyModel>
): any {
  const initialData: Record<string, unknown> = {}
  // Model hydration visits every data slot. Keep this direct stack use rather
  // than withErrorPathSegment: it avoids one callback closure per slot and
  // has a measured production hydration win.
  const errorDiagnosticsContext = getCurrentErrorDiagnosticsContext()

  const processedSnKeys = Object.keys(processedSn)
  const processedSnKeysLen = processedSnKeys.length
  for (let i = 0; i < processedSnKeysLen; i++) {
    const k = processedSnKeys[i]
    if (!isReservedModelKey(k)) {
      const v = processedSn[k]
      errorDiagnosticsContext?.pushPath(k)
      let snapshotValue: unknown
      try {
        snapshotValue = internalFromSnapshot(v, ctx)
      } finally {
        errorDiagnosticsContext?.popPath()
      }
      if (k === "__proto__") {
        setProtoProp(initialData, snapshotValue)
      } else {
        initialData[k] = snapshotValue
      }
    }
  }
  return observable.object(initialData, undefined, observableOptions)
}

export const observableOptions = {
  deep: false,
}

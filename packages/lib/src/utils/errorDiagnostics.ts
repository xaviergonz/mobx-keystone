import type { Path, PathElement, WritablePath } from "../parent/pathTypes"

interface ErrorDiagnosticsContext {
  path: WritablePath
  modelTrail: string[]
}

const errorDiagnosticsContextStack: ErrorDiagnosticsContext[] = []

function getCurrentErrorDiagnosticsContext(): ErrorDiagnosticsContext | undefined {
  return errorDiagnosticsContextStack.length > 0
    ? errorDiagnosticsContextStack[errorDiagnosticsContextStack.length - 1]
    : undefined
}

/**
 * @internal
 */
export function runWithErrorDiagnosticsContext<T>(fn: () => T): T {
  const existing = getCurrentErrorDiagnosticsContext()
  if (existing) {
    return fn()
  }

  const ctx: ErrorDiagnosticsContext = {
    path: [],
    modelTrail: [],
  }
  errorDiagnosticsContextStack.push(ctx)
  try {
    return fn()
  } finally {
    errorDiagnosticsContextStack.pop()
  }
}

/**
 * @internal
 */
export function withErrorPathSegment<T>(segment: PathElement, fn: () => T): T {
  const ctx = getCurrentErrorDiagnosticsContext()
  if (!ctx) {
    return fn()
  }

  ctx.path.push(segment)
  try {
    return fn()
  } finally {
    ctx.path.pop()
  }
}

/**
 * @internal
 */
export function withErrorPathSegments<T>(segments: readonly PathElement[], fn: () => T): T {
  if (segments.length <= 0) {
    return fn()
  }

  const ctx = getCurrentErrorDiagnosticsContext()
  if (!ctx) {
    return fn()
  }

  const initialLen = ctx.path.length
  const segmentsLen = segments.length
  for (let i = 0; i < segmentsLen; i++) {
    ctx.path.push(segments[i]!)
  }

  try {
    return fn()
  } finally {
    ctx.path.length = initialLen
  }
}

/**
 * @internal
 */
function formatErrorModelTrailEntry(modelType: string, modelId?: string): string {
  return modelId !== undefined ? `${modelType} (id=${JSON.stringify(modelId)})` : modelType
}

/**
 * @internal
 */
export function withErrorModelTrailEntry<T>(modelType: string, fn: () => T): T
/**
 * @internal
 */
export function withErrorModelTrailEntry<T>(
  modelType: string,
  modelId: string | undefined,
  fn: () => T
): T
/**
 * @internal
 */
export function withErrorModelTrailEntry<T>(
  modelType: string,
  modelIdOrFn: string | undefined | (() => T),
  maybeFn?: () => T
): T {
  const fn = (typeof modelIdOrFn === "function" ? modelIdOrFn : maybeFn)!
  const modelId = typeof modelIdOrFn === "function" ? undefined : modelIdOrFn

  const ctx = getCurrentErrorDiagnosticsContext()
  if (!ctx) {
    return fn()
  }

  const entry = formatErrorModelTrailEntry(modelType, modelId)
  ctx.modelTrail.push(entry)
  try {
    return fn()
  } finally {
    ctx.modelTrail.pop()
  }
}

/**
 * @internal
 */
export function getErrorPathSnapshot(): Path | undefined {
  const ctx = getCurrentErrorDiagnosticsContext()
  return ctx ? [...ctx.path] : undefined
}

/**
 * @internal
 */
export function getErrorModelTrailSnapshot(): readonly string[] | undefined {
  const ctx = getCurrentErrorDiagnosticsContext()
  return ctx && ctx.modelTrail.length > 0 ? [...ctx.modelTrail] : undefined
}

/**
 * @internal
 */
function formatErrorPathForMessage(path: Path | undefined = getErrorPathSnapshot()): string {
  const p = path ?? []
  return `/${p.join("/")}`
}

/**
 * @internal
 */
function getSafeErrorValuePreview(value: unknown, maxLen = 200): string {
  let str: string | undefined
  try {
    str = JSON.stringify(value)
  } catch {
    str = undefined
  }

  // JSON.stringify can return undefined (e.g. for undefined, Symbol, or functions) without throwing
  if (typeof str !== "string") {
    try {
      str = String(value)
    } catch {
      str = Object.prototype.toString.call(value)
    }
  }

  if (str.length > maxLen) {
    return str.slice(0, maxLen) + "..."
  }

  return str
}

interface BuildErrorMessageWithDiagnosticsData {
  message: string
  path: Path
  previewValue: unknown | typeof noErrorValuePreview
  modelTrail?: readonly string[]
}

/**
 * @internal
 */
export const noErrorValuePreview = Symbol("noErrorValuePreview")

/**
 * @internal
 */
export function buildErrorMessageWithDiagnostics(
  data: BuildErrorMessageWithDiagnosticsData
): string {
  const parts = [data.message, `Path: ${formatErrorPathForMessage(data.path)}`]

  if (data.previewValue !== noErrorValuePreview) {
    parts.push(`Value: ${getSafeErrorValuePreview(data.previewValue)}`)
  }

  if (data.modelTrail && data.modelTrail.length > 0) {
    parts.push(`Model trail: ${data.modelTrail.join(" -> ")}`)
  }

  return parts.join(" - ")
}

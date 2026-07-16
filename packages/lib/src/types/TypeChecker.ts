import type { Path } from "../parent/pathTypes"
import { isArray, isObject, isPrimitive, lazy } from "../utils"
import { getOrCreate } from "../utils/mapUtils"
import type { AnyStandardType } from "./schemas"
import type { TypeCheckError } from "./TypeCheckError"

type CheckFunction = (value: any, path: Path, typeCheckedValue: any) => TypeCheckError | null

/** @internal */
export type SnapshotProcessor = (snapshot: any) => unknown

/**
 * A lazily discovered snapshot-processor node. Dependencies are deliberately
 * TypeCheckers rather than processors so recursive graphs can be discovered
 * before any processor body is compiled.
 *
 * @internal
 */
export interface SnapshotProcessorPlan {
  readonly intrinsic?: boolean
  readonly getDependencies: () => ReadonlyArray<TypeChecker>
  readonly compile: (
    dependencyProcessors: ReadonlyArray<SnapshotProcessor | undefined>
  ) => SnapshotProcessor | undefined
}

/** @internal */
export function snapshotProcessorPlan(
  getDependencies: () => ReadonlyArray<TypeChecker>,
  compile: SnapshotProcessorPlan["compile"],
  intrinsic = false
): SnapshotProcessorPlan {
  return { intrinsic, getDependencies, compile }
}

type SnapshotProcessorSource = SnapshotProcessor | SnapshotProcessorPlan | undefined
type SnapshotProcessorDirection = "from" | "to"

/** @internal */
export class SnapshotProcessorPlanNode {
  private readonly owner: TypeChecker | undefined
  private readonly direction: SnapshotProcessorDirection
  private readonly source: SnapshotProcessorSource
  private presence: boolean | undefined
  private dependencies: SnapshotProcessorPlanNode[] | undefined
  private discovering = false
  private compiling = false
  private compiled = false
  private compiledProcessor: SnapshotProcessor | undefined
  private forwardingProcessor: SnapshotProcessor | undefined

  constructor(
    owner: TypeChecker | undefined,
    direction: SnapshotProcessorDirection,
    source: SnapshotProcessorSource
  ) {
    this.owner = owner
    this.direction = direction
    this.source = source
    if (typeof source === "function" || source === undefined) {
      this.presence = !!source
      this.compiled = true
      this.compiledProcessor = source
    }
  }

  resolve(): SnapshotProcessor | undefined {
    if (this.compiled) {
      return this.compiledProcessor
    }

    const discoveredNodes: SnapshotProcessorPlanNode[] = []
    const dependents = new Map<SnapshotProcessorPlanNode, SnapshotProcessorPlanNode[]>()
    this.discover(discoveredNodes, dependents, new Set())

    // Presence is the least fixed point of
    //   intrinsic || any(dependency is present)
    // over the newly discovered graph. An identity-only recursive component
    // therefore remains absent, while an intrinsic processor propagates
    // through every parent that contains it.
    const presentQueue: SnapshotProcessorPlanNode[] = []
    for (let i = 0; i < discoveredNodes.length; i++) {
      const node = discoveredNodes[i]
      const plan = node.source as SnapshotProcessorPlan
      if (plan.intrinsic || node.dependencies!.some((dependency) => dependency.presence === true)) {
        node.presence = true
        presentQueue.push(node)
      }
    }

    for (let queueIndex = 0; queueIndex < presentQueue.length; queueIndex++) {
      const nodeDependents = dependents.get(presentQueue[queueIndex])
      if (!nodeDependents) {
        continue
      }
      for (let i = 0; i < nodeDependents.length; i++) {
        const dependent = nodeDependents[i]
        if (dependent.presence === undefined) {
          dependent.presence = true
          presentQueue.push(dependent)
        }
      }
    }

    for (let i = 0; i < discoveredNodes.length; i++) {
      const node = discoveredNodes[i]
      if (node.presence === undefined) {
        node.presence = false
        node.compiled = true
        node.compiledProcessor = undefined
        node.dependencies = undefined
      }
    }

    return this.compile()
  }

  private discover(
    discoveredNodes: SnapshotProcessorPlanNode[],
    dependents: Map<SnapshotProcessorPlanNode, SnapshotProcessorPlanNode[]>,
    visited: Set<SnapshotProcessorPlanNode>
  ): void {
    if (this.presence !== undefined || this.discovering || visited.has(this)) {
      return
    }

    visited.add(this)
    this.discovering = true
    discoveredNodes.push(this)
    try {
      const plan = this.source as SnapshotProcessorPlan
      const dependencyCheckers = plan.getDependencies()
      this.dependencies = new Array(dependencyCheckers.length)
      for (let i = 0; i < dependencyCheckers.length; i++) {
        const dependency = dependencyCheckers[i].getSnapshotProcessorPlanNode(this.direction)
        this.dependencies[i] = dependency
        if (dependency.presence === undefined) {
          let dependencyDependents = dependents.get(dependency)
          if (!dependencyDependents) {
            dependencyDependents = []
            dependents.set(dependency, dependencyDependents)
          }
          dependencyDependents.push(this)
        }
        dependency.discover(discoveredNodes, dependents, visited)
      }
    } catch (error) {
      // A lazy schema may temporarily fail while a recursive declaration is
      // still initializing. Leave this node discoverable for a later retry.
      this.dependencies = undefined
      throw error
    } finally {
      this.discovering = false
    }
  }

  private compile(): SnapshotProcessor | undefined {
    if (this.compiled) {
      return this.compiledProcessor
    }
    if (!this.presence) {
      this.compiled = true
      return undefined
    }
    if (this.compiling) {
      if (!this.forwardingProcessor) {
        this.forwardingProcessor = (snapshot) => this.compiledProcessor!(snapshot)
      }
      return this.forwardingProcessor
    }

    this.compiling = true
    try {
      const dependencies = this.dependencies!
      const dependencyProcessors = new Array<SnapshotProcessor | undefined>(dependencies.length)
      for (let i = 0; i < dependencies.length; i++) {
        dependencyProcessors[i] = dependencies[i].compileForDependency()
      }

      const processor = (this.source as SnapshotProcessorPlan).compile(dependencyProcessors)
      this.compiledProcessor = processor
      this.compiled = true
      this.dependencies = undefined
      return processor
    } finally {
      this.compiling = false
    }
  }

  private compileForDependency(): SnapshotProcessor | undefined {
    const processor = this.compile()
    return processor && this.direction === "to" ? this.owner!.toSnapshotProcessor : processor
  }
}

const absentSnapshotProcessorPlanNode = new SnapshotProcessorPlanNode(undefined, "from", undefined)

/**
 * @internal
 */
export enum TypeCheckerBaseType {
  Object = "object",
  Array = "array",
  Primitive = "primitive",
  Any = "any",
}

/**
 * @internal
 */
export function getTypeCheckerBaseTypeFromValue(value: any): TypeCheckerBaseType {
  // array must be before object since arrays are also objects
  if (isArray(value)) {
    return TypeCheckerBaseType.Array
  }
  if (isObject(value)) {
    return TypeCheckerBaseType.Object
  }
  if (isPrimitive(value)) {
    return TypeCheckerBaseType.Primitive
  }
  return TypeCheckerBaseType.Any
}

const typeCheckersWithCachedSnapshotProcessorResultsOfObject = new WeakMap<
  object,
  Set<TypeChecker>
>()
const cachedUndefinedSnapshotProcessorResult = Symbol("cachedUndefinedSnapshotProcessorResult")

/**
 * @internal
 */
export function invalidateCachedToSnapshotProcessorResult(obj: object) {
  const set = typeCheckersWithCachedSnapshotProcessorResultsOfObject.get(obj)

  if (set) {
    set.forEach((typeChecker) => {
      typeChecker.invalidateSnapshotProcessorCachedResult(obj)
    })
    typeCheckersWithCachedSnapshotProcessorResultsOfObject.delete(obj)
  }
}

/**
 * @internal
 */
export class TypeChecker {
  unchecked: boolean
  skipCheck = false
  readonly baseType: TypeCheckerBaseType
  private readonly _check: CheckFunction | null
  readonly getTypeName: (...recursiveTypeCheckers: TypeChecker[]) => string
  readonly typeInfoGen: TypeInfoGen
  readonly snapshotType: (sn: unknown) => TypeChecker | null
  private readonly fromSnapshotProcessorSource: SnapshotProcessorSource
  private readonly toSnapshotProcessorSource: SnapshotProcessorSource
  private fromSnapshotProcessorPlanNode: SnapshotProcessorPlanNode | undefined
  private toSnapshotProcessorPlanNode: SnapshotProcessorPlanNode | undefined

  check(value: any, path: Path, typeCheckedValue: any): TypeCheckError | null {
    if (this.unchecked || this.skipCheck) {
      return null
    }

    return this._check!(value, path, typeCheckedValue)
  }

  private _cachedTypeInfoGen: TypeInfoGen

  get typeInfo() {
    return this._cachedTypeInfoGen(this as any)
  }

  constructor(
    baseType: TypeCheckerBaseType,
    _check: CheckFunction | null,
    getTypeName: (...recursiveTypeCheckers: TypeChecker[]) => string,
    typeInfoGen: TypeInfoGen,
    snapshotType: (sn: unknown) => TypeChecker | null,
    fromSnapshotProcessor: SnapshotProcessorSource,
    toSnapshotProcessor: SnapshotProcessorSource
  ) {
    this.baseType = baseType
    this._check = _check
    this.getTypeName = getTypeName
    this.typeInfoGen = typeInfoGen
    this.snapshotType = snapshotType
    this.fromSnapshotProcessorSource = fromSnapshotProcessor
    this.toSnapshotProcessorSource = toSnapshotProcessor
    this.unchecked = !_check
    this._cachedTypeInfoGen = lazy(typeInfoGen)
  }

  getSnapshotProcessorPlanNode(direction: SnapshotProcessorDirection): SnapshotProcessorPlanNode {
    const source =
      direction === "from" ? this.fromSnapshotProcessorSource : this.toSnapshotProcessorSource
    if (source === undefined) {
      return absentSnapshotProcessorPlanNode
    }

    let node =
      direction === "from" ? this.fromSnapshotProcessorPlanNode : this.toSnapshotProcessorPlanNode
    if (!node) {
      node = new SnapshotProcessorPlanNode(this, direction, source)
      if (direction === "from") {
        this.fromSnapshotProcessorPlanNode = node
      } else {
        this.toSnapshotProcessorPlanNode = node
      }
    }
    return node
  }

  private resolveSnapshotProcessor(
    direction: SnapshotProcessorDirection
  ): SnapshotProcessor | undefined {
    const source =
      direction === "from" ? this.fromSnapshotProcessorSource : this.toSnapshotProcessorSource
    return typeof source === "function"
      ? source
      : source === undefined
        ? undefined
        : this.getSnapshotProcessorPlanNode(direction).resolve()
  }

  getFromSnapshotProcessor(): SnapshotProcessor | undefined {
    return this.resolveSnapshotProcessor("from")
  }

  getToSnapshotProcessor(): SnapshotProcessor | undefined {
    return this.resolveSnapshotProcessor("to") ? this.toSnapshotProcessor : undefined
  }

  fromSnapshotProcessor = (sn: any): unknown => {
    const processor = this.getFromSnapshotProcessor()
    return processor ? processor(sn) : sn
  }

  private readonly _toSnapshotProcessorCache = new WeakMap<object, unknown>()

  invalidateSnapshotProcessorCachedResult(obj: object) {
    this._toSnapshotProcessorCache.delete(obj)
  }

  toSnapshotProcessor = (sn: any): unknown => {
    const processor = this.resolveSnapshotProcessor("to")
    if (!processor) {
      return sn
    }

    if (typeof sn !== "object" || sn === null) {
      // not cacheable
      return processor(sn)
    }

    const cachedResult = this._toSnapshotProcessorCache.get(sn)
    if (cachedResult !== undefined) {
      return cachedResult === cachedUndefinedSnapshotProcessorResult ? undefined : cachedResult
    }

    const val = processor(sn)
    this._toSnapshotProcessorCache.set(
      sn,
      val === undefined ? cachedUndefinedSnapshotProcessorResult : val
    )

    // register this type checker as listener of that sn changes
    const typeCheckerSet = getOrCreate(
      typeCheckersWithCachedSnapshotProcessorResultsOfObject,
      sn,
      () => new Set()
    )

    typeCheckerSet.add(this)

    return val
  }
}

const lateTypeCheckerSymbol = Symbol("lateTypeCheker")

/**
 * @internal
 */
export interface LateTypeChecker {
  [lateTypeCheckerSymbol]: true
  (): TypeChecker
  getFromSnapshotProcessor(): SnapshotProcessor | undefined
  getToSnapshotProcessor(): SnapshotProcessor | undefined
  typeInfo: TypeInfo
}

/**
 * @internal
 */
export function lateTypeChecker(fn: () => TypeChecker, typeInfoGen: TypeInfoGen): LateTypeChecker {
  let cached: TypeChecker | undefined
  const ltc = () => {
    if (cached) {
      return cached
    }

    cached = fn()
    return cached
  }
  Object.assign(ltc, {
    [lateTypeCheckerSymbol]: true as const,
    getFromSnapshotProcessor: () => ltc().getFromSnapshotProcessor(),
    getToSnapshotProcessor: () => ltc().getToSnapshotProcessor(),
  })

  const cachedTypeInfoGen = lazy(typeInfoGen)

  Object.defineProperty(ltc, "typeInfo", {
    enumerable: true,
    configurable: false,
    get() {
      return cachedTypeInfoGen(ltc as any)
    },
  })

  return ltc as LateTypeChecker
}

/**
 * @internal
 */
export function isLateTypeChecker(ltc: unknown): ltc is LateTypeChecker {
  return typeof ltc === "function" && lateTypeCheckerSymbol in ltc
}

/**
 * Type info base class.
 */
export class TypeInfo {
  readonly kind: string = "typeInfo"
  readonly thisType: AnyStandardType

  constructor(thisType: AnyStandardType) {
    this.thisType = thisType
  }
}

/**
 * @internal
 */
export type TypeInfoGen = (t: AnyStandardType) => TypeInfo

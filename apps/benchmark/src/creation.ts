import {
  DataModel,
  Model,
  ModelAutoTypeCheckingMode,
  model,
  prop,
  setGlobalConfig,
  tProp,
  types,
} from "mobx-keystone"
import {
  benchKeystone,
  type KeystoneBenchmarkResult,
  type KeystoneBenchmarkSetup,
} from "./bench.js"

export const FLAT_CREATION_PROFILE_BATCH_SIZE = 1_000

const providedData = {
  a: 1,
  b: 2,
  c: 3,
  d: 4,
  e: 5,
  f: 6,
  g: 7,
  h: 8,
}

const emptyData = {}

interface NestedData {
  groups: {
    enabled: boolean
    label: string
    values: number[]
  }[]
}

function createNestedData(): NestedData {
  return {
    groups: [
      { enabled: true, label: "a", values: [1, 2, 3, 4] },
      { enabled: false, label: "b", values: [5, 6, 7, 8] },
      { enabled: true, label: "c", values: [9, 10, 11, 12] },
      { enabled: false, label: "d", values: [13, 14, 15, 16] },
    ],
  }
}

const providedProps = {
  a: prop<number>(),
  b: prop<number>(),
  c: prop<number>(),
  d: prop<number>(),
  e: prop<number>(),
  f: prop<number>(),
  g: prop<number>(),
  h: prop<number>(),
}

const defaultedProps = {
  a: prop(1),
  b: prop(2),
  c: prop(3),
  d: prop(4),
  e: prop(5),
  f: prop(6),
  g: prop(7),
  h: prop(8),
}

const typedProps = {
  a: tProp(types.number),
  b: tProp(types.number),
  c: tProp(types.number),
  d: tProp(types.number),
  e: tProp(types.number),
  f: tProp(types.number),
  g: tProp(types.number),
  h: tProp(types.number),
}

@model("benchmark/CreationProvidedModel")
class CreationProvidedModel extends Model(providedProps) {}

@model("benchmark/CreationProvidedDataModel")
class CreationProvidedDataModel extends DataModel(providedProps) {}

@model("benchmark/CreationDefaultedModel")
class CreationDefaultedModel extends Model(defaultedProps) {}

@model("benchmark/CreationDefaultedDataModel")
class CreationDefaultedDataModel extends DataModel(defaultedProps) {}

@model("benchmark/CreationTypedModel")
class CreationTypedModel extends Model(typedProps) {}

@model("benchmark/CreationTypedDataModel")
class CreationTypedDataModel extends DataModel(typedProps) {}

@model("benchmark/CreationNestedModel")
class CreationNestedModel extends Model({
  value: prop<NestedData>(),
}) {}

@model("benchmark/CreationNestedDataModel")
class CreationNestedDataModel extends DataModel({
  value: prop<NestedData>(),
}) {}

function configuredSetup(
  modelAutoTypeChecking: ModelAutoTypeCheckingMode,
  run: () => void
): () => KeystoneBenchmarkSetup {
  return () => {
    setGlobalConfig({ modelAutoTypeChecking })
    return {
      run,
      dispose: () => {
        setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff })
      },
    }
  }
}

function benchCreationPair(
  name: string,
  modelAutoTypeChecking: ModelAutoTypeCheckingMode,
  createModel: () => void,
  createDataModel: () => void,
  onCycle: (result: KeystoneBenchmarkResult) => void
): void {
  benchKeystone(
    `model-create-${name}`,
    configuredSetup(modelAutoTypeChecking, createModel),
    onCycle
  )
  benchKeystone(
    `datamodel-create-${name}`,
    configuredSetup(modelAutoTypeChecking, createDataModel),
    onCycle
  )
}

export function runCreationBenchmarks(onCycle: (result: KeystoneBenchmarkResult) => void): void {
  benchCreationPair(
    "provided-p8-typecheck-off",
    ModelAutoTypeCheckingMode.AlwaysOff,
    () => {
      new CreationProvidedModel(providedData)
    },
    () => {
      new CreationProvidedDataModel(providedData)
    },
    onCycle
  )

  benchCreationPair(
    "defaults-p8-typecheck-off",
    ModelAutoTypeCheckingMode.AlwaysOff,
    () => {
      new CreationDefaultedModel(emptyData)
    },
    () => {
      new CreationDefaultedDataModel(emptyData)
    },
    onCycle
  )

  benchCreationPair(
    "typed-p8-typecheck-off",
    ModelAutoTypeCheckingMode.AlwaysOff,
    () => {
      new CreationTypedModel(providedData)
    },
    () => {
      new CreationTypedDataModel(providedData)
    },
    onCycle
  )

  benchCreationPair(
    "typed-p8-typecheck-on",
    ModelAutoTypeCheckingMode.AlwaysOn,
    () => {
      new CreationTypedModel(providedData)
    },
    () => {
      new CreationTypedDataModel(providedData)
    },
    onCycle
  )

  benchCreationPair(
    "nested-objects-and-arrays-typecheck-off",
    ModelAutoTypeCheckingMode.AlwaysOff,
    () => {
      new CreationNestedModel({ value: createNestedData() })
    },
    () => {
      new CreationNestedDataModel({ value: createNestedData() })
    },
    onCycle
  )

  benchKeystone(
    "datamodel-wrap-existing-tree-node-cache-hit-p8",
    () => {
      setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff })
      const existing = new CreationProvidedDataModel(providedData)
      return {
        run: () => {
          new CreationProvidedDataModel(existing.$)
        },
        dispose: () => {
          setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff })
        },
      }
    },
    onCycle
  )
}

export function createFlatModelCreationProfile(
  batchSize = FLAT_CREATION_PROFILE_BATCH_SIZE
): () => void {
  setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff })
  return () => {
    for (let i = 0; i < batchSize; i++) {
      new CreationProvidedModel(providedData)
    }
  }
}

export function createFlatDataModelCreationProfile(
  batchSize = FLAT_CREATION_PROFILE_BATCH_SIZE
): () => void {
  setGlobalConfig({ modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff })
  return () => {
    for (let i = 0; i < batchSize; i++) {
      new CreationProvidedDataModel(providedData)
    }
  }
}

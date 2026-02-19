import { AnyModel } from "../model/BaseModel"
import { getModelIdPropertyName } from "../model/getModelMetadata"
import { ModelConstructorOptions } from "../model/ModelConstructorOptions"
import { modelTypeKey } from "../model/metadata"
import { getModelOrSnapshotTypeAndId, getSnapshotModelType } from "../model/utils"
import { ModelClass } from "../modelShared/BaseModelShared"
import { getModelInfoForName, getModelNotRegisteredErrorMessage } from "../modelShared/modelInfo"
import { withErrorModelTrailEntry } from "../utils/errorDiagnostics"
import { FromSnapshotContext, registerSnapshotter } from "./fromSnapshot"
import { SnapshotInOfModel } from "./SnapshotOf"
import { SnapshotProcessingError } from "./SnapshotProcessingError"
import { SnapshotterAndReconcilerPriority } from "./SnapshotterAndReconcilerPriority"

function fromModelSnapshot(sn: SnapshotInOfModel<AnyModel>, ctx: FromSnapshotContext): AnyModel {
  const type = sn[modelTypeKey]

  if (!type) {
    throw new SnapshotProcessingError({
      message: `a model snapshot must contain a type key (${modelTypeKey}), but none was found`,
      actualSnapshot: sn,
    })
  }

  const modelInfo = getModelInfoForName(type)
  if (!modelInfo) {
    throw new SnapshotProcessingError({
      message: getModelNotRegisteredErrorMessage(type),
      actualSnapshot: sn,
    })
  }

  const modelIdPropertyName = getModelIdPropertyName(modelInfo.class as ModelClass<AnyModel>)
  if (modelIdPropertyName && sn[modelIdPropertyName] === undefined) {
    throw new SnapshotProcessingError({
      message: `a model snapshot of type '${type}' must contain an id key (${modelIdPropertyName}), but none was found`,
      actualSnapshot: sn,
    })
  }

  const modelTypeAndId = getModelOrSnapshotTypeAndId(sn)
  const modelId = modelTypeAndId?.modelId

  return withErrorModelTrailEntry(type, modelId, () => {
    return new (modelInfo.class as any)(undefined, {
      snapshotInitialData: {
        unprocessedSnapshot: sn,
        unprocessedModelType:
          typeof ctx.untypedSnapshot === "object" &&
          ctx.untypedSnapshot &&
          modelTypeKey in ctx.untypedSnapshot
            ? ctx.untypedSnapshot[modelTypeKey]
            : undefined,
        snapshotToInitialData: ctx.snapshotToInitialData,
      },
      generateNewIds: ctx.options.generateNewIds,
    } satisfies ModelConstructorOptions)
  })
}

/**
 * @internal
 */
export function registerFromModelSnapshotter() {
  registerSnapshotter(SnapshotterAndReconcilerPriority.Model, (sn, ctx) => {
    if (getSnapshotModelType(sn) !== undefined) {
      return fromModelSnapshot(sn, ctx)
    }
    return undefined
  })
}

import { AnyModel } from "../model/BaseModel"
import { getModelIdPropertyName } from "../model/getModelMetadata"
import { modelTypeKey } from "../model/metadata"
import { ModelConstructorOptions } from "../model/ModelConstructorOptions"
import { isModelSnapshot } from "../model/utils"
import { ModelClass } from "../modelShared/BaseModelShared"
import { getModelInfoForName } from "../modelShared/modelInfo"
import { failure } from "../utils"
import { FromSnapshotContext, registerSnapshotter } from "./fromSnapshot"
import { SnapshotInOfModel } from "./SnapshotOf"
import { SnapshotterAndReconcilerPriority } from "./SnapshotterAndReconcilerPriority"

function fromModelSnapshot(sn: SnapshotInOfModel<AnyModel>, ctx: FromSnapshotContext): AnyModel {
  const type = sn[modelTypeKey]

  if (!type) {
    throw failure(`a model snapshot must contain a type key (${modelTypeKey}), but none was found`)
  }

  const modelInfo = getModelInfoForName(type)
  if (!modelInfo) {
    throw failure(`model with name "${type}" not found in the registry`)
  }

  const modelIdPropertyName = getModelIdPropertyName(modelInfo.class as ModelClass<AnyModel>)
  if (modelIdPropertyName && sn[modelIdPropertyName] === undefined) {
    throw failure(
      `a model snapshot of type '${type}' must contain an id key (${modelIdPropertyName}), but none was found`
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
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
}

/**
 * @internal
 */
export function registerFromModelSnapshotter() {
  registerSnapshotter(SnapshotterAndReconcilerPriority.Model, (sn, ctx) => {
    if (isModelSnapshot(sn)) {
      return fromModelSnapshot(sn, ctx)
    }
    return undefined
  })
}

import { IAtom, computed, createAtom, observe, reaction } from "mobx"
import {
  Frozen,
  Model,
  frozen,
  getParentToChildPath,
  model,
  onSnapshot,
  tProp,
  types,
} from "mobx-keystone"
import * as Y from "yjs"
import { failure } from "../utils/error"
import { YjsBindingContext, yjsBindingContext } from "./yjsBindingContext"
import { resolveYjsPath } from "./resolveYjsPath"

// Delta[][], since each single change is a Delta[]
// we use frozen so that we can reuse each delta change
const deltaListType = types.array(types.frozen(types.unchecked<unknown[]>()))

export const yjsTextModelId = "mobx-keystone-yjs/YjsTextModel"

@model(yjsTextModelId)
export class YjsTextModel extends Model({
  deltaList: tProp(deltaListType, () => []),
}) {
  /**
   * Helper function to create a YjsTextModel instance with a simple text.
   */
  static withText(text: string): YjsTextModel {
    return new DecoratedYjsTextModel({
      deltaList: [
        frozen([
          {
            insert: text,
          },
        ]),
      ],
    })
  }

  /**
   * The Y.js path from the bound object to the YjsTextModel instance.
   */
  @computed
  private get _yjsObjectPath() {
    const ctx = yjsBindingContext.get(this)
    if (!ctx || ctx.boundObject == null) {
      throw failure(
        "the YjsTextModel instance must be part of a bound object before it can be accessed"
      )
    }

    const path = getParentToChildPath(ctx.boundObject, this)
    if (!path) {
      throw failure("a path from the bound object to the YjsTextModel instance is not available")
    }

    return path
  }

  /**
   * The Yjs.Text object present at this mobx-keystone node's path.
   */
  @computed
  private get _yjsObjectAtPath(): unknown {
    const path = this._yjsObjectPath

    const ctx = yjsBindingContext.get(this)!

    return resolveYjsPath(ctx.yjsObject, path)
  }

  /**
   * The Yjs.Text object represented by this mobx-keystone node.
   */
  @computed
  get yjsText(): Y.Text {
    const yjsObject = this._yjsObjectAtPath

    if (!(yjsObject instanceof Y.Text)) {
      throw failure(`Y.Text was expected at path ${JSON.stringify(this._yjsObjectPath)}`)
    }

    return yjsObject
  }

  /**
   * Atom that gets changed when the associated Y.js text changes.
   */
  yjsTextChangedAtom = createAtom("yjsTextChangedAtom")

  /**
   * The text value of the Yjs.Text object.
   * Shortcut for `yjsText.toString()`, but computed.
   */
  @computed
  get text(): string {
    this.yjsTextChangedAtom.reportObserved()
    return this.yjsText.toString()
  }

  protected onInit() {
    const shouldReplicateToYjs = (ctx: YjsBindingContext | undefined): ctx is YjsBindingContext => {
      return !!ctx && !!ctx.boundObject && !ctx.isApplyingYjsChangesToMobxKeystone
    }

    let reapplyDeltasToYjsText = false
    const newDeltas: Frozen<unknown[]>[] = []

    let disposeObserveDeltaList: (() => void) | undefined

    const disposeReactionToDeltaListRefChange = reaction(
      () => this.$.deltaList,
      (deltaList) => {
        disposeObserveDeltaList?.()
        disposeObserveDeltaList = undefined

        if (deltaList) {
          disposeObserveDeltaList = observe(this.$.deltaList, (change) => {
            if (reapplyDeltasToYjsText) {
              // already gonna replace them all
              return
            }
            if (!shouldReplicateToYjs(yjsBindingContext.get(this))) {
              // yjs text is already up to date with these changes
              return
            }

            if (
              change.type === "splice" &&
              change.removedCount === 0 &&
              change.addedCount > 0 &&
              change.index === this.deltaList.length
            ) {
              // optimization, just adding new ones to the end
              newDeltas.push(...change.added)
            } else {
              // any other change, we need to reapply all deltas
              reapplyDeltasToYjsText = true
            }
          })
        }
      },
      { fireImmediately: true }
    )

    const disposeOnSnapshot = onSnapshot(this, () => {
      try {
        if (reapplyDeltasToYjsText) {
          const ctx = yjsBindingContext.get(this)

          if (shouldReplicateToYjs(ctx)) {
            const { yjsText } = this

            ctx.yjsDoc.transact(() => {
              // didn't find a better way than this to reapply all deltas
              // without having to re-create the Y.Text object
              if (yjsText.length > 0) {
                yjsText.delete(0, yjsText.length)
              }

              this.deltaList.forEach((frozenDeltas) => {
                yjsText.applyDelta(frozenDeltas.data)
              })
            }, ctx.yjsOrigin)
          }
        } else if (newDeltas.length > 0) {
          const ctx = yjsBindingContext.get(this)

          if (shouldReplicateToYjs(ctx)) {
            const { yjsText } = this

            ctx.yjsDoc.transact(() => {
              newDeltas.forEach((frozenDeltas) => {
                yjsText.applyDelta(frozenDeltas.data)
              })
            }, ctx.yjsOrigin)
          }
        }
      } finally {
        reapplyDeltasToYjsText = false
        newDeltas.length = 0
      }
    })

    const diposeYjsTextChangedAtom = hookYjsTextChangedAtom(
      () => this.yjsText,
      this.yjsTextChangedAtom
    )

    return () => {
      disposeOnSnapshot()
      disposeReactionToDeltaListRefChange()
      disposeObserveDeltaList?.()
      disposeObserveDeltaList = undefined

      diposeYjsTextChangedAtom()
    }
  }
}

// we use this trick just to avoid a babel bug that causes classes used inside classes not to be overriden
// by the decorator
const DecoratedYjsTextModel = YjsTextModel

function hookYjsTextChangedAtom(getYjsText: () => Y.Text, textChangedAtom: IAtom) {
  let disposeObserveYjsText: (() => void) | undefined

  const observeFn = () => {
    textChangedAtom.reportChanged()
  }

  const disposeReactionToYTextChange = reaction(
    () => {
      try {
        return getYjsText()
      } catch {
        return undefined
      }
    },
    (yjsText) => {
      disposeObserveYjsText?.()
      disposeObserveYjsText = undefined

      if (yjsText) {
        yjsText.observe(observeFn)

        disposeObserveYjsText = () => {
          yjsText.unobserve(observeFn)
        }
      }

      textChangedAtom.reportChanged()
    },
    {
      fireImmediately: true,
    }
  )

  return () => {
    disposeReactionToYTextChange()
    disposeObserveYjsText?.()
    disposeObserveYjsText = undefined
  }
}

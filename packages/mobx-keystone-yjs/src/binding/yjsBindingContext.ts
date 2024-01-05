import { AnyType, createContext } from "mobx-keystone"
import * as Y from "yjs"

/**
 * Context with info on how a mobx-keystone model is bound to a Y.js data structure.
 */
export interface YjsBindingContext {
  /**
   * The Y.js document.
   */
  yjsDoc: Y.Doc

  /**
   * The bound Y.js data structure.
   */
  yjsObject: Y.Map<unknown> | Y.Array<unknown> | Y.Text

  /**
   * The mobx-keystone model type.
   */
  mobxKeystoneType: AnyType

  /**
   * The origin symbol used for transactions.
   */
  yjsOrigin: symbol

  /**
   * The bound mobx-keystone instance.
   */
  boundObject: unknown | undefined

  /**
   * Whether we are currently applying Y.js changes to the mobx-keystone model.
   */
  isApplyingYjsChangesToMobxKeystone: boolean
}

export const yjsBindingContext = createContext<YjsBindingContext | undefined>(undefined)

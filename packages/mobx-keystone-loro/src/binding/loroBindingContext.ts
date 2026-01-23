import type { LoroDoc } from "loro-crdt"
import { type AnyType, createContext } from "mobx-keystone"
import type { BindableLoroContainer } from "../utils/isBindableLoroContainer"

/**
 * Context for the Loro binding, providing access to the Loro document
 * and binding state from within mobx-keystone models.
 */
export interface LoroBindingContext {
  /**
   * The Loro document being bound.
   */
  loroDoc: LoroDoc

  /**
   * The root Loro object being bound.
   */
  loroObject: BindableLoroContainer

  /**
   * The mobx-keystone model type being used.
   */
  mobxKeystoneType: AnyType

  /**
   * String used as origin for Loro transactions to identify changes
   * coming from mobx-keystone.
   */
  loroOrigin: string

  /**
   * The bound mobx-keystone object (once created).
   */
  boundObject: unknown

  /**
   * Whether changes are currently being applied from Loro to mobx-keystone.
   * Used to prevent infinite loops.
   */
  isApplyingLoroChangesToMobxKeystone: boolean
}

/**
 * Context for accessing the Loro binding from within mobx-keystone models.
 */
export const loroBindingContext = createContext<LoroBindingContext | undefined>(undefined)

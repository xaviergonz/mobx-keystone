import { AnyType, createContext } from "mobx-keystone"
import * as Y from "yjs"

export interface YjsBindingContext {
  yjsDoc: Y.Doc
  yjsObject: Y.Map<unknown> | Y.Array<unknown> | Y.Text
  mobxKeystoneType: AnyType
  yjsOrigin: symbol
  boundObject: unknown | undefined
  isApplyingYjsChangesToMobxKeystone: boolean
}

export const yjsBindingContext = createContext<YjsBindingContext | undefined>(undefined)

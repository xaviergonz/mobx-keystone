import { AnyType, createContext } from "mobx-keystone"
import * as Y from "yjs"

export interface YjsBindingContext {
  yjsDoc: Y.Doc
  yjsObject: Y.Map<unknown> | Y.Array<unknown>
  mobxKeystoneType: AnyType
  yjsOrigin: symbol
}

export const yjsBindingContext = createContext<YjsBindingContext | undefined>(undefined)

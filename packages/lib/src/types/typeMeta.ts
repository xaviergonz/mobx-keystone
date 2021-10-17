/** @ignore */
export declare const typeMetaSymbol: unique symbol

export interface TypeMeta<
  TI extends {
    snapshotInOverride?: any
    snapshotOutOverride?: any
  }
> {
  // we use this double definition so we can "augment" the type, yet
  // be able to infer its data
  [typeMetaSymbol]?: {
    [typeMetaSymbol]: TI
  }
}

export type ExtractTypeMeta<T> = T extends {
  [typeMetaSymbol]?: infer O
}
  ? O extends { [typeMetaSymbol]: infer O2 }
    ? O2
    : never
  : never

/**
 * @internal
 */
// biome-ignore lint/style/useEnumInitializers: that's ok, it is not serialized
export enum SnapshotterAndReconcilerPriority {
  Array,
  Frozen,
  Model,
  PlainObject,
}

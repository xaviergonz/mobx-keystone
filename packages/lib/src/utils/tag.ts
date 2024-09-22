/**
 * Creates a tag data accessor for a target object of a certain type.
 * Tag data will be lazy created on access and reused for the same target object.
 *
 * @typeparam Target Target type.
 * @typeparam TagData Tag data type.
 * @param tagDataConstructor Function that will be called the first time the tag
 * for a given object is requested.
 * @returns The tag data associated with the target object.
 */
export function tag<Target extends object, TagData>(
  tagDataConstructor: (target: Target) => TagData
): {
  for(target: Target): TagData
} {
  const map = new WeakMap<Target, TagData>()

  return {
    for(target): TagData {
      if (map.has(target)) {
        return map.get(target)!
      } else {
        const data = tagDataConstructor(target)
        map.set(target, data)
        return data
      }
    },
  }
}

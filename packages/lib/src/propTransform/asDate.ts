import { propTransform } from "./propTransform"

/**
 * Prop transform for ISO date strings to Date objects
 * and vice-versa.
 */
export const stringAsDate = propTransform<string | null | undefined, Date | null | undefined>({
  propToData(prop) {
    if (prop == null) return prop
    return new Date(prop)
  },
  dataToProp(date) {
    if (date == null) return date
    return date.toJSON()
  },
})

/**
 * Prop transform for number timestamps to Date objects
 * and vice-versa.
 */
export const timestampAsDate = propTransform<number | null | undefined, Date | null | undefined>({
  propToData(prop) {
    if (prop == null) return prop
    return new Date(prop)
  },
  dataToProp(date) {
    if (date == null) return date
    return +date
  },
})

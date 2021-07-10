const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="

export function toBase64(input: string): string {
  if (typeof global === "object" && typeof Buffer === "function") {
    // node
    return Buffer.from(input).toString("base64")
  }

  if (typeof btoa === "function") {
    // browser
    return btoa(input)
  }

  const str = String(input)

  let output = ""
  for (
    // initialize result and counter
    let block = 0, charCode, idx = 0, map = chars;
    // if the next str index does not exist:
    //   change the mapping table to "="
    //   check if d has no fractional digits
    str.charAt(idx | 0) || ((map = "="), idx % 1);
    // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
    output += map.charAt(63 & (block >> (8 - (idx % 1) * 8)))
  ) {
    charCode = str.charCodeAt((idx += 3 / 4))
    if (charCode > 0xff) {
      throw new Error("the string to be encoded contains characters outside of the Latin1 range.")
    }
    block = (block << 8) | charCode
  }
  return output
}

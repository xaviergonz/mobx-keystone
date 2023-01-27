// nanoid/non-secure pasted in here to avoid the issue with modules
const urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict"

export const nanoid = (size = 21) => {
  let id = ""
  let i = size
  while (i--) {
    id += urlAlphabet[(Math.random() * 64) | 0]
  }
  return id
}

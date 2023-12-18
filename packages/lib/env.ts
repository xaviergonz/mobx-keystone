// if this file is changed then env.js needs to be changed

export const mobxVersion = Number(process.env.MOBX_VERSION || "6") as 4 | 5 | 6
export const compiler = process.env.COMPILER || "tsc" // tsc | tsc-experimental-decorators | babel | swc

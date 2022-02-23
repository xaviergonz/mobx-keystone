module.exports = {
  mobxVersion: Number(process.env.MOBX_VERSION || "6"), // 4 | 5 | 6
  compiler: process.env.COMPILER || "tsc", // tsc | babel | swc
}

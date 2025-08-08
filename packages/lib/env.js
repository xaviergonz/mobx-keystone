/**
 * Environment configuration object
 * @type {{mobxVersion: 4 | 5 | 6, compiler: string}}
 */
module.exports.env = {
  mobxVersion: Number(process.env.MOBX_VERSION || "6"),
  compiler: process.env.COMPILER || "tsc", // tsc | tsc-experimental-decorators | babel | swc
}

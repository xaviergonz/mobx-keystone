module.exports = {
  extends: [
    "react-app",
    "prettier",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
  ],
  rules: {
    // "import/no-cycle": ["error", { ignoreExternal: true }],
  },
}

module.exports = {
  root: true,

  env: {
    browser: true,
    commonjs: true,
    es6: true,
    jest: true,
    node: true,
  },

  settings: {
    react: {
      version: "detect",
    },
  },

  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: "latest",
    sourceType: "module",
    warnOnUnsupportedTypeScriptVersion: true,
  },

  plugins: ["@typescript-eslint", "import", "react", "react-hooks"],

  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended", // disables eslint:recommended rules that conflict with typescript
    "plugin:@typescript-eslint/recommended",
    "prettier", // disables rules that conflict with prettier
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
  ],

  rules: {
    // doesn't get along well with .js extensions (needed so node "type": module works)
    "import/no-unresolved": "off",
    // "import/no-cycle": ["error", { ignoreExternal: true }],
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-empty-interface": "off",
    "@typescript-eslint/no-this-alias": "off",
    "@typescript-eslint/no-explicit-any": "off", // perhaps we should re-enable this in the future
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        args: "none",
        ignoreRestSiblings: true,
      },
    ],
  },
}

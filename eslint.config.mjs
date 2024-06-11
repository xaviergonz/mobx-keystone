import { FlatCompat } from "@eslint/eslintrc"
import eslint from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import pluginImportX from "eslint-plugin-import-x"
import eslintPluginReactConfigsJsxRuntime from "eslint-plugin-react/configs/jsx-runtime.js"
import eslintPluginReactConfigsRecommended from "eslint-plugin-react/configs/recommended.js"
import globals from "globals"
import path from "path"
import tseslint from "typescript-eslint"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

export default tseslint.config(
  {
    ignores: [
      "eslint.config.*",
      "**/node_modules",
      ".idea",
      "*.log",
      "**/.turbo",
      "**/.DS_Store",
      ".yarn/*",
      "!.yarn/patches",
      "!.yarn/releases",
      "!.yarn/plugins",
      "!.yarn/sdks",
      "!.yarn/versions",
      ".pnp.*",
      "packages/lib/dist",
      "packages/lib/coverage",
      "packages/lib/api-docs",
      "packages/mobx-keystone-yjs/dist",
      "packages/mobx-keystone-yjs/coverage",
      "apps/benchmark/dist",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigDirName: import.meta.dirname,
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: "latest",
        warnOnUnsupportedTypeScriptVersion: true,
      },
      globals: {
        ...globals.browser,
        ...globals.commonjs,
        ...globals.es2021,
        ...globals.jest,
        ...globals.node,
      },
    },
  },
  ...compat.config(pluginImportX.configs.recommended),
  pluginImportX.configs.typescript,
  eslintPluginReactConfigsRecommended,
  eslintPluginReactConfigsJsxRuntime,
  ...compat.extends("plugin:react-hooks/recommended"),
  {
    rules: {
      // does not get along with flat configs for now, but TS takes care of this I think
      "import-x/namespace": "off",
      // "import/no-cycle": ["error", { ignoreExternal: true }],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "none",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-invalid-void-type": "off",
      "@typescript-eslint/no-unnecessary-type-arguments": "off",
      "@typescript-eslint/no-unnecessary-condition": "off", // bothers more than helps
      "@typescript-eslint/unified-signatures": "off",
      "@typescript-eslint/prefer-for-of": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/consistent-indexed-object-style": "off",
      // perhaps we should re-enable these in the future
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
  {
    files: ["packages/lib/test/**"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
    },
  },
  {
    files: ["apps/site/docs/examples/**"],
    rules: {
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  }
)

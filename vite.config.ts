import { defineConfig } from "vite-plus"

const generatedPaths = [
  "**/dist/**",
  "**/coverage/**",
  "packages/*/api-docs/**",
  "apps/site/.docusaurus/**",
  "apps/site/build/**",
  "apps/site/generated-static/**",
  "apps/site/generated-api/**",
]

export default defineConfig({
  fmt: {
    printWidth: 100,
    semi: false,
    trailingComma: "es5",
    sortPackageJson: false,
    // Mirrors Biome's organizeImports: type imports are mixed with value imports,
    // and relative imports (including style modules) are sorted together by path.
    sortImports: {
      groups: ["builtin", "external", "internal", ["parent", "sibling", "index"], "unknown"],
      newlinesBetween: false,
      partitionByNewline: true,
    },
    ignorePatterns: [
      ...generatedPaths,
      "**/*.md",
      "**/*.mdx",
      "**/*.yml",
      "**/*.yaml",
      "**/*.toml",
      "**/*.html",
    ],
  },
  lint: {
    plugins: ["eslint", "typescript", "unicorn", "oxc", "import", "react", "jsx-a11y"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    categories: {
      correctness: "error",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    ignorePatterns: [...generatedPaths, "apps/site/docs/examples/**"],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",

      "eslint/default-param-last": "error",
      "eslint/no-console": "error",
      "eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/src/**"],
              message:
                "Import package public APIs instead of reaching into src/ internals outside tests and benchmarks.",
            },
          ],
        },
      ],
      "eslint/one-var": ["error", "never"],
      "eslint/no-var": "error",
      "eslint/prefer-const": ["error", { ignoreReadBeforeAssign: true }],
      "eslint/prefer-rest-params": "error",
      "import/no-default-export": "error",
      "react/self-closing-comp": "error",
      "typescript/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports", disallowTypeAnnotations: false },
      ],
      "typescript/no-floating-promises": "error",
      "typescript/no-inferrable-types": "error",
      "typescript/parameter-properties": "error",
      "typescript/prefer-enum-initializers": "error",
      "unicorn/explicit-length-check": "error",
      "unicorn/prefer-node-protocol": "error",
      "unicorn/prefer-number-properties": "error",

      // Intentionally allowed patterns (they were also disabled in Biome).
      "typescript/no-this-alias": "off",

      // Oxlint correctness rules Biome did not enforce; the codebase uses these patterns on purpose.
      "jsx-a11y/prefer-tag-over-role": "off", // flags <svg role="img">, which is the recommended pattern
      "react/set-state-in-effect": "off",
      "typescript/no-base-to-string": "off",
      "typescript/no-redundant-type-constituents": "off",
      "typescript/restrict-template-expressions": "off",
      "typescript/unbound-method": "off",
      "unicorn/no-new-array": "off",
    },
    overrides: [
      {
        files: [
          "**/test/**",
          "**/perf_bench/**",
          "apps/benchmark/**",
          "apps/site/docs/examples/**",
        ],
        rules: { "eslint/no-console": "off" },
      },
      {
        files: ["**/test/**"],
        rules: { "eslint/no-restricted-imports": "off" },
      },
      {
        files: [
          "apps/site/src/pages/**/*.tsx",
          "apps/site/src/theme/**/*.tsx",
          "**/vite.config.{ts,mts}",
          "**/vitest.config.mts",
        ],
        rules: { "import/no-default-export": "off" },
      },
    ],
  },
})

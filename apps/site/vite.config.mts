import { defineConfig } from "vite-plus"

const siteDependencies = [
  "mobx-keystone#build",
  "mobx-keystone-yjs#build",
  "mobx-keystone-loro#build",
  "mobx-keystone#build-docs",
]

export default defineConfig({
  run: {
    tasks: {
      "llms:generate:raw": {
        command:
          'node --experimental-strip-types ./scripts/prepare-llms-docs.mts && get-llms-txt --content-dir ./.llms-docs --output-dir ./generated-static --base-url https://mobx-keystone.js.org --project-name mobx-keystone --project-description "Documentation site for mobx-keystone" && node --experimental-strip-types ./scripts/patch-llms-md.mts',
      },
      "llms:generate:full": {
        command: "node --experimental-strip-types ./scripts/generate-llms-full.mts",
      },
      "llms:generate": {
        command: "vp run llms:generate:raw && vp run llms:generate:full",
      },
      "llms:sync-root": {
        command: "shx cp ../../llms.txt ./generated-static/llms.txt",
      },
      build: {
        command: "vp run llms:generate && vp run llms:sync-root && docusaurus build",
        dependsOn: siteDependencies,
      },
      start: {
        command: "vp run llms:generate && vp run llms:sync-root && docusaurus start",
        dependsOn: siteDependencies,
        cache: false,
      },
      serve: {
        command: "docusaurus serve",
        dependsOn: ["build"],
        cache: false,
      },
    },
  },
})

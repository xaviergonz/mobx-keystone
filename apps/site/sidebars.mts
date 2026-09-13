import type { SidebarsConfig } from "@docusaurus/plugin-content-docs"

const sidebars: SidebarsConfig = {
  docs: [
    { type: "html", value: "Start here", className: "sidebar-section-label" },
    "intro",
    "installation",
    "gettingStarted",
    "mstComparison",
    { type: "html", value: "Core concepts", className: "sidebar-section-label" },
    "classModels",
    "dataModels",
    "standardAndStandaloneActions",
    "treeLikeStructure",
    "rootStores",
    "snapshots",
    "patches",
    "mapsSetsDates",
    { type: "html", value: "Go further", className: "sidebar-section-label" },
    {
      type: "category",
      label: "Action Middlewares",
      items: [
        "actionMiddlewares/onActionMiddleware",
        "actionMiddlewares/transactionMiddleware",
        "actionMiddlewares/undoMiddleware",
        "actionMiddlewares/readonlyMiddleware",
        "actionMiddlewares/customMiddlewares",
      ],
    },
    "contexts",
    "references",
    "frozen",
    "runtimeTypeChecking",
    "drafts",
    "sandboxes",
    "computedTrees",
    {
      type: "category",
      label: "Integrations",
      items: [
        "integrations/reduxCompatibility",
        "integrations/yjsBinding",
        "integrations/loroBinding",
      ],
    },
    {
      type: "category",
      label: "Examples",
      items: [
        "examples/todoList/todoList",
        "examples/clientServer/clientServer",
        "examples/yjsBinding/yjsBinding",
        "examples/loroBinding/loroBinding",
      ],
    },
    "mstMigrationGuide",
  ],
}

// biome-ignore lint/style/noDefaultExport: Docusaurus sidebars are consumed through a default export.
export default sidebars

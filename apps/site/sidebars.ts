import type { SidebarsConfig } from "@docusaurus/plugin-content-docs"

const sidebars: SidebarsConfig = {
  docs: [
    "intro",
    "installation",
    "mstComparison",
    "classModels",
    "dataModels",
    "standardAndStandaloneActions",
    "treeLikeStructure",
    "rootStores",
    "snapshots",
    "patches",
    "mapsSetsDates",
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
    "reduxCompatibility",
    {
      type: "category",
      label: "Examples",
      items: ["examples/todoList/todoList", "examples/clientServer/clientServer"],
    },
  ],
}

export default sidebars

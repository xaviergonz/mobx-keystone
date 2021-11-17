// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
module.exports = {
  docs: [
    "intro",
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
    "reduxCompatibility",
    {
      type: "category",
      label: "Examples",
      items: ["examples/todoList/todoList", "examples/clientServer/clientServer"],
    },
  ],
}

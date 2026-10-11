/**
 * What a call's name resolved to on its target.
 */
export enum CallKind {
  /**
   * An action declared on a class: a model's `@modelAction` / `@modelFlow` (including
   * `withSetter()` setters), or a data model's action.
   */
  ModelAction = "modelAction",
  /**
   * An action the app defines with `standaloneAction` / `standaloneFlow`, under a global name.
   */
  StandaloneAction = "standaloneAction",
  /**
   * A standalone action the library ships for editing any array or plain object
   * (`arrayActions`, `objectActions`).
   */
  StandardAction = "standardAction",
  /**
   * A built-in action, as library functions record when they change a node: `$$applySnapshot`,
   * `$$applyPatches`, `$$detach`, `$$applySet`, `$$applyDelete`, `$$applyMethodCall` (see
   * `BuiltInAction`).
   */
  BuiltInAction = "builtInAction",
  /**
   * Not an action: a method, getter or function field of a model's or data model's own classes.
   */
  View = "view",
}

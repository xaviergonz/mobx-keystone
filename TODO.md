# TODO

- (5) while ts output snapshot typings are ok, input snapshots still are not quite ok (they take a deep partial) for cases
  such as { x: 10 }, where it doesn't know if x has to be there for sure or not but will be present on the object for sure

- (5) action recorder abstraction?

- (6) should we add something to distinguish actions run as apply (from those who are not) in mwares? (applySnapshot, applyAction, applyPatches)
- in theory the user could use the filter function + isSpecialAction

- middlewares: (5) redux mware...

- refs? done, but need to document that saferefs only work properly when the ref is under a rootstore and the typing gotchas

- (4) does subclassing work? apparently it does

- (7) explore new babel decorators

- (6) readme, docs, new name, demos (todo list, sync between server and client)

- (5) check out mst api for missing features

- (3) future: object/array backed map, array backed set? the mapping of those types to pure json is not apparent though
- (4) some kind of validation or rely on ts? maybe allow them to use yup or some other validation library via some validation callback?
  - Model.validateSnapshotIn(sn),Model.validateSnapshotOut(sn)

# TODO

- (3) defaultData can take extra data which is not on the model data type definition

- (5) action recorder abstraction?

- (6) should we add something to distinguish actions run as apply (from those who are not) in mwares? (applySnapshot, applyAction, applyPatches)
- in theory the user could use the filter function + isSpecialAction

- middlewares: (5) redux mware...

- refs? done, but need to document that saferefs only work properly when the ref is under a rootstore and the typing gotchas

- (4) does subclassing work? apparently it does with small gotchas

- (7) explore new babel decorators

- (6) readme, docs, new name, more demos (sync between server and client)

- (5) check out mst api for missing features

- (3) future: object/array backed map, array backed set? the mapping of those types to pure json is not apparent though
- (4) some kind of validation or rely on ts? maybe allow them to use yup or some other validation library via some validation callback?
  - Model.validateSnapshotIn(sn),Model.validateSnapshotOut(sn)?

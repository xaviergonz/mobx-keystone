# TODO

- maybe we could reduce the model passed in actions to just the type/id if it is anywhere?

- (8) clear place to put effects and the like?
- in theory that would be afterAttachToRootModel

- (7) explore new babel decorators compatibility

- (6) should we add something to distinguish actions run as apply (from those who are not) in mwares? (applySnapshot, applyAction, applyPatches)
- in theory the user could use the filter function + isSpecialAction

- (6) readme, docs, new name, more demos (sync between server and client)

- (5) action recorder abstraction?

- (4) custom refs? cross tree refs?

- (4) check out mst api for missing features

- (3) does subclassing work? apparently it does with small gotchas

- (3) future: object/array backed map, array backed set? the mapping of those types to pure json is not apparent though

- (2) defaultData can take extra data which is not on the model data type definition

# TODO

- Maybe we should ofer specialized versions of array and our custom map that are auto transformed into
  arrays / objects and do things like make indexOf use ids for models?
  That way we could also remove toTreeNode.

- (8) clear place to put effects and the like?
- in theory that would be afterAttachToRootModel

- (7) explore new babel decorators compatibility

- (6) should we add something to distinguish actions run as apply (from those who are not) in mwares? (applySnapshot, applyPatches)
- in theory the user could use the filter function + isSpecialAction

- (5) action recorder abstraction?

- (4) custom refs? cross tree refs?

- (4) check out mst api for missing features

- (3) does subclassing work? apparently it does with small gotchas

- (3) future: object/array backed map, array backed set? the mapping of those types to pure json is not apparent though

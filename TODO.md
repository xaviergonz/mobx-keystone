# TODO

- should we add something to distinguish actions run as apply from those who are not in mwares? (applySnapshot, applyAction, applyPatches)
- maybe add that as some option to onAction

- action tracker middleware

- something like frozen that allows us to opt out from the tweaker for some parts of the tree

data = {
  whatever: frozen(x) // array, object, anything serializable (freezed the object, adds it to some frozen objs weakset)
}

- middlewares? (we have addActionMiddleware though)
- redux mware, atomic, undo manager...

- refs? done, but need to document that saferefs only work properly when the ref is under a rootstore and the typing gotchas

- does subclassing work? apparently it does

- explore new babel decorators

- readme, docs, new name

- future: object/array backed map, array backed set?
- some kind of validation or rely on ts?

# TODO

- should we add something to distinguish actions run as apply from those who are not in mwares? (applySnapshot, applyAction, applyPatches)
- maybe add that as some option to onAction

- action tracker middleware

- something like frozen that allows us to opt out from the tweaker for some parts of the tree

- middlewares? (we have addActionMiddleware though)
- redux mware, atomic...

- refs? done, but need to document that saferefs only work properly when the ref is under a rootstore and the typing gotchas

- does subclassing work? apparently it does

- readme, docs, new name

- future: object/array backed map, array backed set?
- some kind of validation or rely on ts?

# TODO

- patch emitting thanks to immer? although fastjson patch is cool
- make applySnapshot NOT use fastjson patch?

- reactive getParentPath and friends?

- flows

- middlewares? (we have addActionMiddleware though)
- redux mware, atomic...

- refs?

x: new Ref(obj, { autoDetach: true/false }) -> Ref<T>
stores: ref to a (tweaked) object
serializes: absolute path of such object (both must be under the same root at that time)
deserializes: absolute path to an object, that after fromSnapshot is done will be actually resolved (ref)

.isValid // valid if both ref and target are under the same root, reactive
.current // get/set, does not throw
readonly .path // the actual thing that is / will be stored, throws if not valid

not serializable in pure json mode (or rather it won't work), stored as
{
$typeof: "$Ref", // a model
path: "path",
autoDetach?: true/false
}

since ref will be a kind of "Model", we will do once attached to a root store (or after the constructor is done / some init func called?):
if (this.data.autoDetach) {
reaction to this.isValid
when it gets to true detach this
}
also detach when dismounted from root store? guess not in case we want to move it to another root store?

on the model constructor we can do:
reaction(() => this.data.r && !this.data.r.isValid, (invalid) => {
if (invalid) {
detach(this.data.r)
}
}, {fireImm})

- readme, new name

- future: object/array backed map, array backed set?
- some kind of validation or rely on ts?

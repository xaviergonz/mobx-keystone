# mobx-keystone-loro

Loro CRDT bindings for mobx-keystone.

This package provides bidirectional synchronization between mobx-keystone models and Loro CRDT documents. It enables real-time collaborative editing of mobx-keystone state trees.

## Features

- Uses `LoroMap` for objects (LWW semantics)
- Uses `LoroMovableList` for arrays with native move operations
- Uses `LoroText` for rich text editing
- Automatically detects and uses move operations when reordering array items
- Full bidirectional sync between mobx-keystone and Loro

## Installation

```bash
npm install mobx-keystone-loro
# or
yarn add mobx-keystone-loro
# or
pnpm add mobx-keystone-loro
```

## Peer Dependencies

- `mobx` ^4.3.1 || ^5.0.0 || ^6.0.0
- `mobx-keystone` ^1.16.0
- `loro-crdt` ^1.0.0

## Usage

```typescript
import { LoroDoc } from "loro-crdt"
import { Model, tProp, types, modelAction, registerRootStore } from "mobx-keystone"
import { bindLoroToMobxKeystone } from "mobx-keystone-loro"

// Define your model
@model("myApp/Todo")
class Todo extends Model({
  text: tProp(types.string),
  done: tProp(types.boolean, false),
}) {
  @modelAction
  setText(text: string) {
    this.text = text
  }

  @modelAction
  toggle() {
    this.done = !this.done
  }
}

// Create a Loro document
const doc = new LoroDoc()
const rootMap = doc.getMap("root")

// Initialize with snapshot data
rootMap.set("text", "Hello")
rootMap.set("done", false)
doc.commit()

// Bind to mobx-keystone
const { boundObject, dispose } = bindLoroToMobxKeystone({
  loroDoc: doc,
  loroObject: rootMap,
  mobxKeystoneType: Todo,
})

registerRootStore(boundObject)

// Changes to boundObject will sync to Loro
boundObject.setText("World")

// Changes from Loro will sync to boundObject
rootMap.set("done", true)
doc.commit()

// Clean up when done
dispose()
```

## API

### `bindLoroToMobxKeystone(options)`

Creates a bidirectional binding between a Loro object and a mobx-keystone model.

#### Options

- `loroDoc: LoroDoc` - The Loro document
- `loroObject: LoroMap | LoroMovableList | LoroText` - The Loro object to bind to
- `mobxKeystoneType: ModelClass<T> | AnyStandardType` - The mobx-keystone model class or type

#### Returns

- `boundObject: T` - The mobx-keystone model instance
- `dispose: () => void` - Function to clean up the binding
- `loroOrigin: string` - The origin string used for Loro commits by the binding

### `LoroTextModel`

A mobx-keystone model for representing Loro rich text.

```typescript
import { LoroTextModel } from "mobx-keystone-loro"

// Create a text model
const textModel = LoroTextModel.withText("Hello, world!")

// Access the plain text
console.log(textModel.text) // "Hello, world!"

// Access the delta for rich text (Quill format)
console.log(textModel.delta)
```

## License

MIT

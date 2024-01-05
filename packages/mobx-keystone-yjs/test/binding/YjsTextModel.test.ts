import { Model, frozen, getSnapshot, runUnprotected, tProp, types } from "mobx-keystone"
import * as Y from "yjs"
import { YjsTextModel, bindYjsToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test("bind a text as root object", () => {
  const doc = new Y.Doc()

  const yTestText = doc.getText("testText")

  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: yTestText,
    mobxKeystoneType: YjsTextModel,
  })
  autoDispose(() => dispose())

  expect(boundObject).toBeDefined()
  expect(boundObject.yjsText).toBe(yTestText)

  // mobx-keystone -> yjs
  runUnprotected(() => {
    boundObject.deltaList.push(
      frozen([
        {
          insert: "abc",
        },
      ])
    )
    expect(yTestText.toDelta()).toMatchInlineSnapshot(`[]`)
  })
  expect(boundObject.yjsText).toBe(yTestText)
  expect(yTestText.toDelta()).toMatchInlineSnapshot(`
    [
      {
        "insert": "abc",
      },
    ]
  `)

  // yjs -> mobx-keystone
  yTestText.insert(0, "def")
  expect(yTestText.toDelta()).toMatchInlineSnapshot(`
    [
      {
        "insert": "defabc",
      },
    ]
  `)
  expect(getSnapshot(boundObject)).toMatchInlineSnapshot(`
    {
      "$modelType": "mobx-keystone-yjs/YjsTextModel",
      "deltaList": [
        {
          "$frozen": true,
          "data": [
            {
              "insert": "abc",
            },
          ],
        },
        {
          "$frozen": true,
          "data": [
            {
              "insert": "def",
            },
          ],
        },
      ],
    }
  `)
})

test("load a pre-exiting text", () => {
  const doc = new Y.Doc()

  const yTestText = doc.getText("testText")
  yTestText.insert(0, "abc")
  yTestText.insert(0, "def")
  yTestText.insertEmbed(0, { type: "image", src: "https://example.com/image.png" })

  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: yTestText,
    mobxKeystoneType: YjsTextModel,
  })
  autoDispose(() => dispose())

  expect(boundObject).toBeDefined()
  expect(boundObject.yjsText).toBe(yTestText)
  expect(getSnapshot(boundObject)).toMatchInlineSnapshot(`
    {
      "$modelType": "mobx-keystone-yjs/YjsTextModel",
      "deltaList": [
        {
          "$frozen": true,
          "data": [
            {
              "insert": {
                "src": "https://example.com/image.png",
                "type": "image",
              },
            },
            {
              "insert": "defabc",
            },
          ],
        },
      ],
    }
  `)
})

@testModel("yjs-test-model-with-text-model")
class TestModel extends Model({
  text: tProp(types.maybe(YjsTextModel)).withSetter(),
}) {}

test("bind a text as a sub-object (text starts undefined)", () => {
  const doc = new Y.Doc()
  const yTestModel = doc.getMap("testModel")

  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: yTestModel,
    mobxKeystoneType: TestModel,
  })
  autoDispose(() => dispose())

  expect(boundObject).toBeDefined()
  expect(boundObject.text).toBeUndefined()

  const yTestText = YjsTextModel.withText("abc")

  boundObject.setText(yTestText)
  expect(boundObject.text!.yjsText).toBeDefined()
  expect(boundObject.text!.yjsText.toDelta()).toMatchInlineSnapshot(`
    [
      {
        "insert": "abc",
      },
    ]
  `)
  expect(getSnapshot(boundObject.text)).toMatchInlineSnapshot(`
    {
      "$modelType": "mobx-keystone-yjs/YjsTextModel",
      "deltaList": [
        {
          "$frozen": true,
          "data": [
            {
              "insert": "abc",
            },
          ],
        },
      ],
    }
  `)
})

const createSubobjectWithText = () => {
  const doc = new Y.Doc()
  const yTestModel = doc.getMap("testModel")
  yTestModel.set("text", new Y.Text("abc"))

  const { boundObject, dispose } = bindYjsToMobxKeystone({
    yjsDoc: doc,
    yjsObject: yTestModel,
    mobxKeystoneType: TestModel,
  })
  autoDispose(() => dispose())

  return {
    boundObject,
    yTestModel,
  }
}

test("bind a text as a sub-object (text starts defined)", () => {
  const { boundObject } = createSubobjectWithText()

  expect(boundObject).toBeDefined()
  expect(boundObject.text!.yjsText).toBeDefined()
  expect(boundObject.text!.yjsText.toDelta()).toMatchInlineSnapshot(`
    [
      {
        "insert": "abc",
      },
    ]
  `)
  expect(getSnapshot(boundObject.text)).toMatchInlineSnapshot(`
    {
      "$modelType": "mobx-keystone-yjs/YjsTextModel",
      "deltaList": [
        {
          "$frozen": true,
          "data": [
            {
              "insert": "abc",
            },
          ],
        },
      ],
    }
  `)
})

test("modify y.js native test - insert", () => {
  const { boundObject } = createSubobjectWithText()

  boundObject.text!.yjsText.insert(0, "def")
  expect(boundObject.text!.yjsText.toDelta()).toMatchInlineSnapshot(`
    [
      {
        "insert": "defabc",
      },
    ]
  `)
  expect(getSnapshot(boundObject.text)).toMatchInlineSnapshot(`
    {
      "$modelType": "mobx-keystone-yjs/YjsTextModel",
      "deltaList": [
        {
          "$frozen": true,
          "data": [
            {
              "insert": "abc",
            },
          ],
        },
        {
          "$frozen": true,
          "data": [
            {
              "insert": "def",
            },
          ],
        },
      ],
    }
  `)
})

test("modify YJsText - clear", () => {
  const { boundObject } = createSubobjectWithText()

  runUnprotected(() => {
    boundObject.text!.deltaList.length = 0
  })
  expect(boundObject.text!.yjsText.toDelta()).toMatchInlineSnapshot(`[]`)
  expect(getSnapshot(boundObject.text)).toMatchInlineSnapshot(`
    {
      "$modelType": "mobx-keystone-yjs/YjsTextModel",
      "deltaList": [],
    }
  `)
})

test("modify YJsText - set to a value", () => {
  const { boundObject } = createSubobjectWithText()

  runUnprotected(() => {
    boundObject.text!.deltaList[0] = frozen([
      {
        insert: "def",
      },
    ])
  })
  expect(boundObject.text!.yjsText.toDelta()).toMatchInlineSnapshot(`
    [
      {
        "insert": "def",
      },
    ]
  `)
  expect(getSnapshot(boundObject.text)).toMatchInlineSnapshot(`
    {
      "$modelType": "mobx-keystone-yjs/YjsTextModel",
      "deltaList": [
        {
          "$frozen": true,
          "data": [
            {
              "insert": "def",
            },
          ],
        },
      ],
    }
  `)
})

test("detach/reattach same YJsText", () => {
  const { boundObject, yTestModel } = createSubobjectWithText()

  // detach
  const abcText = boundObject.text!
  boundObject.setText(undefined)
  expect(boundObject.text).toBeUndefined()
  expect(yTestModel.get("text")).toBeUndefined()
  expect(() => abcText.text).toThrow(
    "the YjsTextModel instance must be part of a bound object before it can be accessed"
  )

  // reattach
  boundObject.setText(abcText)
  expect(boundObject.text).toBeDefined()
  expect(yTestModel.get("text")).toBeDefined()
  expect(boundObject.text!.yjsText.toDelta()).toMatchInlineSnapshot(`
    [
      {
        "insert": "abc",
      },
    ]
  `)
  expect(getSnapshot(boundObject.text)).toMatchInlineSnapshot(`
    {
      "$modelType": "mobx-keystone-yjs/YjsTextModel",
      "deltaList": [
        {
          "$frozen": true,
          "data": [
            {
              "insert": "abc",
            },
          ],
        },
      ],
    }
  `)
})

test("detach/reattach different YJsText", () => {
  const { boundObject, yTestModel } = createSubobjectWithText()

  // detach
  const abcText = boundObject.text!
  boundObject.setText(undefined)
  expect(boundObject.text).toBeUndefined()
  expect(yTestModel.get("text")).toBeUndefined()
  expect(() => abcText.text).toThrow(
    "the YjsTextModel instance must be part of a bound object before it can be accessed"
  )

  // reattach
  const defText = YjsTextModel.withText("def")
  boundObject.setText(defText)
  expect(boundObject.text).toBeDefined()
  expect(yTestModel.get("text")).toBeDefined()
  expect(boundObject.text!.yjsText.toDelta()).toMatchInlineSnapshot(`
    [
      {
        "insert": "def",
      },
    ]
  `)
  expect(getSnapshot(boundObject.text)).toMatchInlineSnapshot(`
    {
      "$modelType": "mobx-keystone-yjs/YjsTextModel",
      "deltaList": [
        {
          "$frozen": true,
          "data": [
            {
              "insert": "def",
            },
          ],
        },
      ],
    }
  `)
})

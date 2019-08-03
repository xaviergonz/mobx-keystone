import {
  applySnapshot,
  connectReduxDevTools,
  model,
  Model,
  modelAction,
  modelFlow,
  modelSnapshotOutWithMetadata,
  newModel,
} from "../../src"

jest.useRealTimers()

const waitAsync = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const waitAsyncReject = async (ms: number) => {
  await waitAsync(ms)
  throw new Error("thrown")
}

test("waitAsync helper works", async () => {
  await waitAsync(10)
})

test("waitAsyncReject helper works", async () => {
  try {
    await waitAsyncReject(10)
    throw fail("should have failed")
  } catch {
    // do nothing
  }
})

@model("SubModel")
class M2 extends Model<{ a: string }>() {
  defaultData = {
    a: "",
  }

  @modelAction
  setA() {
    this.$.a = "setA"
  }
}

@model("TestModel")
class M extends Model<{ x: string; y: string; array: M2[] }>() {
  defaultData = {
    x: "uninitializedX",
    y: "",
    array: [],
  }

  onInit() {
    this.$.x = ""
  }

  @modelAction
  addToArray(val: M2) {
    this.array.push(val)
  }

  @modelAction
  setX() {
    this.$.x = "setX"
  }

  @modelAction
  setXThrow() {
    this.$.x = "setXThrow"
    throw new Error("bye")
  }

  @modelFlow
  *setXAsync() {
    this.$.x = "setXAsync +0"
    yield waitAsync(20)
    this.$.x = "setXAsync +20"
  }

  @modelFlow
  *setXAsyncWithEmptyFirstPart() {
    yield waitAsync(20)
    this.$.x = "setXAsyncWithEmptyFirstPart +20"
  }

  @modelFlow
  *setXAsyncThrowSync() {
    this.$.x = "setXAsyncThrowSync +0"
    yield waitAsync(20)
    throw new Error("setXAsyncThrowSync +20")
  }

  @modelFlow
  *setXAsyncThrowAsync() {
    this.$.x = "setXAsyncThrowAsync +0"
    yield waitAsyncReject(20)
  }

  @modelAction
  setY() {
    this.$.y = "setY"
  }

  @modelAction
  setYThrow() {
    this.$.y = "setYThrow"
    throw new Error("bye2")
  }

  @modelFlow
  *setYAsync() {
    this.$.y = "setYAsync +0"
    yield waitAsync(50)
    this.$.y = "setYAsync +50"
  }

  @modelFlow
  *setYAsyncThrowSync() {
    this.$.y = "setYAsyncThrowSync +0"
    yield waitAsync(50)
    throw new Error("setYAsyncThrowSync +50")
  }

  @modelFlow
  *setYAsyncThrowAsync() {
    this.$.y = "setYAsyncThrowAsync +0"
    yield waitAsyncReject(50)
  }

  @modelAction
  setXY() {
    this.$.x = "setXY starts"
    this.setX()
    this.setY()
    this.$.x = "setXY ends"
  }

  @modelFlow
  *setXYAsync() {
    this.$.x = "setXYAsync starts"
    yield this.setXAsync()
    yield this.setYAsync()
    this.$.x = "setXYAsync ends"
  }

  @modelFlow
  *setXYAsyncThrowSync() {
    yield this.setXAsyncThrowSync()
  }

  @modelFlow
  *setXYAsyncThrowAsync() {
    yield this.setXAsyncThrowAsync()
  }
}

let m = newModel(M, {})
function mockDevTools() {
  return { init: jest.fn(), subscribe: jest.fn(), send: jest.fn() }
}
let devTools = mockDevTools()

function initTest() {
  const devToolsManager = {
    connectViaExtension: () => mockDevTools(),
    extractState: jest.fn(),
  }
  devTools = devToolsManager.connectViaExtension()

  m = newModel(M, {})
  connectReduxDevTools(devToolsManager, devTools, m)
}

function addStandardTests() {
  test("m.setX()", () => {
    m.setX()
    expect(devTools.send.mock.calls).toMatchSnapshot()
  })

  test("m.setXThrow()", () => {
    expect(() => m.setXThrow()).toThrow()
    expect(devTools.send.mock.calls).toMatchSnapshot()
  })

  test("m.setXAsync()", async () => {
    await m.setXAsync()
    expect(devTools.send.mock.calls).toMatchSnapshot()
  })

  test("m.setXAsyncThrowSync()", async () => {
    try {
      await m.setXAsyncThrowSync()
      throw fail("should have thrown")
    } catch {}
    expect(devTools.send.mock.calls).toMatchSnapshot()
  })

  test("m.setXAsyncThrowAsync()", async () => {
    try {
      await m.setXAsyncThrowAsync()
      throw fail("should have thrown")
    } catch {}
    expect(devTools.send.mock.calls).toMatchSnapshot()
  })

  test("concurrent [m.setYAsync() / m.setXAsync()]", async () => {
    // expected order is y0, x0, x1, y1 due to timeouts
    const b = m.setYAsync()
    const a = m.setXAsync()
    await Promise.all([b, a])
    expect(devTools.send.mock.calls).toMatchSnapshot()
  })

  test("m.setXY() -> m.setX(), m.setY()", () => {
    m.setXY()
    expect(devTools.send.mock.calls).toMatchSnapshot()
  })

  test("m.setXYAsync() -> m.setXAsync(), m.setYAsync()", async () => {
    await m.setXYAsync()
    expect(devTools.send.mock.calls).toMatchSnapshot()
  })

  test("m.setXYAsyncThrowSync() -> m.setXAsyncThrowSync()", async () => {
    try {
      await m.setXYAsyncThrowSync()
      throw fail("should have thrown")
    } catch {}
    expect(devTools.send.mock.calls).toMatchSnapshot()
  })

  test("m.setXYAsyncThrowAsync() -> m.setXYAsyncThrowAsync()", async () => {
    try {
      await m.setXYAsyncThrowAsync()
      throw fail("should have thrown")
    } catch {}
    expect(devTools.send.mock.calls).toMatchSnapshot()
  })

  test("m.setXAsyncWithEmptyFirstPart()", async () => {
    await m.setXAsyncWithEmptyFirstPart()
    expect(devTools.send.mock.calls).toMatchSnapshot()
  })

  test('m.addtoArray({ a: "otherA" }), m.array[0].setA()', () => {
    m.addToArray(newModel(M2, { a: "otherA" }))
    m.array[0]!.setA()
    expect(devTools.send.mock.calls).toMatchSnapshot()
  })

  test('applySnapshot(m, { x: "snapshotX", y: "snapshotY", array: [] })', () => {
    const snapshot = modelSnapshotOutWithMetadata(
      M,
      { x: "snapshotX", y: "snapshotY", array: [] },
      m.modelId
    )
    applySnapshot(m, snapshot)
    expect(devTools.send.mock.calls).toMatchSnapshot()
  })
}

beforeEach(() => {
  initTest()
})

addStandardTests()

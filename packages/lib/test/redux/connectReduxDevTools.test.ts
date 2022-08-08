import {
  applySnapshot,
  connectReduxDevTools,
  idProp,
  Model,
  modelAction,
  modelFlow,
  modelIdKey,
  modelSnapshotOutWithMetadata,
  prop,
  _async,
  _await,
} from "../../src"
import { testModel } from "../utils"

jest.useRealTimers()

const waitAsync = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
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

@testModel("SubModel")
class M2 extends Model({
  a: prop(() => ""),
}) {
  @modelAction
  setA() {
    this.a = "setA"
  }
}

@testModel("TestModel")
class M extends Model({
  [modelIdKey]: idProp,
  x: prop(() => "uninitializedX"),
  y: prop(() => ""),
  array: prop<M2[]>(() => []),
}) {
  onInit() {
    this.x = ""
  }

  @modelAction
  addToArray(val: M2) {
    this.array.push(val)
  }

  @modelAction
  setX() {
    this.x = "setX"
  }

  @modelAction
  setXThrow() {
    this.x = "setXThrow"
    throw new Error("bye")
  }

  private *_setXAsync() {
    this.x = "setXAsync +0"
    yield* _await(waitAsync(20))
    this.x = "setXAsync +20"
  }

  @modelFlow
  setXAsync = _async(this._setXAsync)

  private *_setXAsyncWithEmptyFirstPart() {
    yield* _await(waitAsync(20))
    this.x = "setXAsyncWithEmptyFirstPart +20"
  }

  @modelFlow
  setXAsyncWithEmptyFirstPart = _async(this._setXAsyncWithEmptyFirstPart)

  private *_setXAsyncThrowSync() {
    this.x = "setXAsyncThrowSync +0"
    yield* _await(waitAsync(20))
    throw new Error("setXAsyncThrowSync +20")
  }

  @modelFlow
  setXAsyncThrowSync = _async(this._setXAsyncThrowSync)

  private *_setXAsyncThrowAsync() {
    this.x = "setXAsyncThrowAsync +0"
    yield* _await(waitAsyncReject(20))
  }

  @modelFlow
  setXAsyncThrowAsync = _async(this._setXAsyncThrowAsync)

  @modelAction
  setY() {
    this.y = "setY"
  }

  @modelAction
  setYThrow() {
    this.y = "setYThrow"
    throw new Error("bye2")
  }

  private *_setYAsync() {
    this.y = "setYAsync +0"
    yield* _await(waitAsync(50))
    this.y = "setYAsync +50"
  }

  @modelFlow
  setYAsync = _async(this._setYAsync)

  private *_setYAsyncThrowSync() {
    this.y = "setYAsyncThrowSync +0"
    yield* _await(waitAsync(50))
    throw new Error("setYAsyncThrowSync +50")
  }

  @modelFlow
  setYAsyncThrowSync = _async(this._setYAsyncThrowSync)

  private *_setYAsyncThrowAsync() {
    this.y = "setYAsyncThrowAsync +0"
    yield* _await(waitAsyncReject(50))
  }

  @modelFlow
  setYAsyncThrowAsync = _async(this._setYAsyncThrowAsync)

  @modelAction
  setXY() {
    this.x = "setXY starts"
    this.setX()
    this.setY()
    this.x = "setXY ends"
  }

  private *_setXYAsync() {
    this.x = "setXYAsync starts"
    yield* _await(this.setXAsync())
    yield* _await(this.setYAsync())
    this.x = "setXYAsync ends"
  }

  @modelFlow
  setXYAsync = _async(this._setXYAsync)

  private *_setXYAsyncThrowSync() {
    yield* _await(this.setXAsyncThrowSync())
  }

  @modelFlow
  setXYAsyncThrowSync = _async(this._setXYAsyncThrowSync)

  private *_setXYAsyncThrowAsync() {
    yield* _await(this.setXAsyncThrowAsync())
  }

  @modelFlow
  setXYAsyncThrowAsync = _async(this._setXYAsyncThrowAsync)
}

let m = new M({})
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

  m = new M({})
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
    m.addToArray(new M2({ a: "otherA" }))
    m.array[0]!.setA()
    expect(devTools.send.mock.calls).toMatchSnapshot()
  })

  test('applySnapshot(m, { x: "snapshotX", y: "snapshotY", array: [] })', () => {
    const snapshot = modelSnapshotOutWithMetadata(M, {
      x: "snapshotX",
      y: "snapshotY",
      array: [],
      [modelIdKey]: m.$modelId!,
    })
    applySnapshot(m, snapshot)
    expect(devTools.send.mock.calls).toMatchSnapshot()
  })
}

beforeEach(() => {
  initTest()
})

addStandardTests()

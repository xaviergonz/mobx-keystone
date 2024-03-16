import {
  ActionTrackingResult,
  applySerializedActionAndSyncNewModelIds,
  applySerializedActionAndTrackNewModelIds,
  clone,
  getSnapshot,
  idProp,
  Model,
  modelAction,
  modelIdKey,
  onActionMiddleware,
  prop,
  serializeActionCall,
  SerializedActionCall,
} from "../../src"
import { testModel } from "../utils"

describe("concurrency", () => {
  @testModel("Root")
  class Root extends Model({
    [modelIdKey]: idProp,
    list: prop<ChildA[]>(() => []),
  }) {
    @modelAction
    add() {
      this.list.push(new ChildA({}))
    }

    @modelAction
    addData(child: ChildA) {
      this.list.push(child)
    }

    @modelAction
    clone(index: number) {
      this.list.push(clone(this.list[index]))
    }

    @modelAction
    cloneData(data: ChildA) {
      this.list.push(clone(data))
    }

    @modelAction
    changeId(index: number, newId: string) {
      this.list[index].$modelId = newId
    }

    @modelAction
    changeDeepId(index: number, newId: string) {
      this.list[index].childB.$modelId = newId
    }
  }

  @testModel("ChildA")
  class ChildA extends Model({
    [modelIdKey]: idProp,
    childB: prop(() => new ChildB({})),
  }) {}

  @testModel("ChildB")
  class ChildB extends Model({
    [modelIdKey]: idProp,
  }) {}

  let rootClient!: Root
  let rootServer!: Root
  let capturing = true
  const captured: SerializedActionCall[] = []
  beforeEach(() => {
    rootClient = new Root({})
    rootServer = new Root({})
    capturing = true
    captured.length = 0

    onActionMiddleware(rootClient, {
      onStart(actionCall) {
        if (capturing) {
          captured.push(serializeActionCall(actionCall, rootClient))
          return {
            result: ActionTrackingResult.Return,
            value: undefined,
          }
        }
        return undefined
      },
    })
  })

  function replicate(actionCall: SerializedActionCall) {
    // apply action on server, track model ids
    const ret = applySerializedActionAndTrackNewModelIds(rootServer, actionCall)

    // replicate on client, sync model ids
    capturing = false
    applySerializedActionAndSyncNewModelIds(rootClient, ret.serializedActionCall)
  }

  test("id replication", () => {
    // capture events
    rootClient.add()
    rootClient.addData(new ChildA({}))
    rootClient.clone(0)
    rootClient.cloneData(new ChildA({}))
    rootClient.changeId(0, "SOME ID")
    rootClient.changeDeepId(0, "SOME ID 2")

    expect(captured.length).toBe(6)

    for (const capture of captured) {
      replicate(capture)
    }

    expect(getSnapshot(rootClient.list)).toEqual(getSnapshot(rootServer.list))
    expect(getSnapshot(rootClient.list)).toMatchInlineSnapshot(`
      [
        {
          "$modelId": "SOME ID",
          "$modelType": "ChildA",
          "childB": {
            "$modelId": "SOME ID 2",
            "$modelType": "ChildB",
          },
        },
        {
          "$modelId": "id-3",
          "$modelType": "ChildA",
          "childB": {
            "$modelId": "id-4",
            "$modelType": "ChildB",
          },
        },
        {
          "$modelId": "id-11",
          "$modelType": "ChildA",
          "childB": {
            "$modelId": "id-12",
            "$modelType": "ChildB",
          },
        },
        {
          "$modelId": "id-15",
          "$modelType": "ChildA",
          "childB": {
            "$modelId": "id-16",
            "$modelType": "ChildB",
          },
        },
      ]
    `)
  })
})

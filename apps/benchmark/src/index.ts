import {
  fromSnapshot,
  getSnapshot,
  ModelAutoTypeCheckingMode,
  setGlobalConfig,
} from "mobx-keystone"
import { getSnapshot as mstGetSnapshot } from "mobx-state-tree"
import { bench, ExtrasToRun } from "./bench.js"
import { ESBigModel } from "./models/es6.js"
import { BigModel } from "./models/ks-nonTypeChecked.js"
import { TcBigModel } from "./models/ks-typeChecked.js"
import { MobxBigModel } from "./models/mobx.js"
import { mstBigModel } from "./models/mst.js"

const extrasToRun: ExtrasToRun = [
  // "es6",
  // "mobx",
]

const tcModes: (ModelAutoTypeCheckingMode | false)[] = [
  ModelAutoTypeCheckingMode.AlwaysOn,
  ModelAutoTypeCheckingMode.AlwaysOff,
]

tcModes.forEach((tcMode) => {
  let name = ""
  let bigModel: typeof BigModel | typeof TcBigModel

  switch (tcMode) {
    case false:
      name = "non type checked props"
      bigModel = BigModel
      setGlobalConfig({
        modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff,
      })
      break
    case ModelAutoTypeCheckingMode.AlwaysOn:
      name = "type checking enabled"
      bigModel = TcBigModel
      setGlobalConfig({
        modelAutoTypeChecking: tcMode,
      })
      break
    case ModelAutoTypeCheckingMode.AlwaysOff:
      name = "type checking disabled"
      bigModel = TcBigModel
      setGlobalConfig({
        modelAutoTypeChecking: tcMode,
      })
      break

    default:
      throw new Error("wrong mode")
  }

  bench(
    `empty creation (${name}) - mst is usually faster here due to lazy creation`,
    () => {
      new bigModel({})
    },
    () => {
      mstBigModel.create({})
    },
    () => {
      new ESBigModel({})
    },
    () => {
      new MobxBigModel({})
    },
    extrasToRun
  )

  const bigModelBigVars = ["aa", "bb", "cc", "dd"]
  const bigModelSmallVars = ["a", "b", "c", "d"]
  const smallModelVars = ["a", "b", "c", "d"]

  const accessVars = (x: any) => {
    bigModelBigVars.forEach((bmbv) => {
      const small = x[bmbv]
      smallModelVars.forEach((smv) => {
        void small[smv]
      })
    })
    bigModelSmallVars.forEach((bmsv) => {
      void x[bmsv]
    })
  }

  bench(
    `empty creation + access all simple props (${name})`,
    () => {
      const x = new bigModel({})
      accessVars(x)
    },
    () => {
      const x = mstBigModel.create({})
      accessVars(x)
    },
    () => {
      const x = new ESBigModel({})
      accessVars(x)
    },
    () => {
      const x = new MobxBigModel({})
      accessVars(x)
    },
    extrasToRun
  )

  {
    const bm1 = new bigModel({})
    const bm2 = mstBigModel.create({})
    const bm3 = new ESBigModel({})
    const bm4 = new MobxBigModel({})

    bench(
      `already created, access all simple props (${name})`,
      () => {
        accessVars(bm1)
      },
      () => {
        accessVars(bm2)
      },
      () => {
        accessVars(bm3)
      },
      () => {
        accessVars(bm4)
      },
      extrasToRun
    )
  }

  {
    const bigModelSnapshot = {
      $modelType: "TcBigModel",
      a: "a value",
      b: "b value",
      c: "c value",
      d: "d value",
      aa: {
        $modelType: "TcSmallModel",
        a: "aa a value",
        b: "aa b value",
        c: "aa c value",
        d: "aa d value",
      },
      bb: {
        $modelType: "TcSmallModel",
        a: "bb a value",
        b: "bb b value",
        c: "bb c value",
        d: "bb d value",
      },
      cc: {
        $modelType: "TcSmallModel",
        a: "cc a value",
        b: "cc b value",
        c: "cc c value",
        d: "cc d value",
      },
      dd: {
        $modelType: "TcSmallModel",
        a: "dd a value",
        b: "dd b value",
        c: "dd c value",
        d: "dd d value",
      },
    }

    bench(
      `snapshot creation (${name})`,
      () => {
        fromSnapshot(bigModel, bigModelSnapshot)
      },
      () => {
        mstBigModel.create(bigModelSnapshot)
      },
      () => {
        ESBigModel.fromSnapshot(bigModelSnapshot)
      },
      () => {
        MobxBigModel.fromSnapshot(bigModelSnapshot)
      },
      extrasToRun
    )
  }

  const setVars = (x: any) => {
    bigModelBigVars.forEach((bmbv) => {
      const small = x[bmbv]
      smallModelVars.forEach((smv) => {
        small["set" + smv.toUpperCase()](small[smv] + "x")
      })
    })
    bigModelSmallVars.forEach((bmsv) => {
      x["set" + bmsv.toUpperCase()](x[bmsv] + "x")
    })
  }

  {
    const bm1 = new bigModel({})
    const bm2 = mstBigModel.create({})
    const bm3 = mstBigModel.create({})
    const bm4 = mstBigModel.create({})

    bench(
      `already created, change all simple props (${name})`,
      () => {
        setVars(bm1)
      },
      () => {
        setVars(bm2)
      },
      () => {
        setVars(bm3)
      },
      () => {
        setVars(bm4)
      },
      extrasToRun
    )
  }

  {
    const bm1 = new bigModel({})
    const bm2 = mstBigModel.create({})
    const bm3 = new ESBigModel({})
    const bm4 = new MobxBigModel({})

    bench(
      `already created, change one simple props + getSnapshot (${name})`,
      () => {
        bm1.setA(bm1.a + "x")
        getSnapshot(bm1)
      },
      () => {
        bm2.setA(bm2.a + "x")
        mstGetSnapshot(bm2)
      },
      () => {
        bm3.setA(bm3.a + "x")
        bm3.toJSON()
      },
      () => {
        bm4.setA(bm4.a + "x")
        bm4.toJSON()
      },
      extrasToRun
    )
  }
})

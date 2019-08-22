import { getSnapshot, ModelAutoTypeCheckingMode, setGlobalConfig } from "mobx-keystone"
import { getSnapshot as mstGetSnapshot } from "mobx-state-tree"
import { bench } from "./bench"
import { BigModel } from "./models/ks-nonTypeChecked"
import { TcBigModel } from "./models/ks-typeChecked"
import { mstBigModel } from "./models/mst"

const tcModes: (ModelAutoTypeCheckingMode | false)[] = [
  /*false, ModelAutoTypeCheckingMode.AlwaysOn, */ ModelAutoTypeCheckingMode.AlwaysOff,
]

tcModes.forEach(tcMode => {
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
    }
  )

  const bigModelBigVars = ["aa", "bb", "cc", "dd"]
  const bigModelSmallVars = ["a", "b", "c", "d"]
  const smallModelVars = ["a", "b", "c", "d"]

  const accessVars = (x: any) => {
    bigModelBigVars.forEach(bmbv => {
      const small = x[bmbv]
      smallModelVars.forEach(smv => {
        small[smv]
      })
    })
    bigModelSmallVars.forEach(bmsv => {
      x[bmsv]
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
    }
  )

  {
    const bm1 = new bigModel({})
    const bm2 = mstBigModel.create({})
    bench(
      `already created, access all simple props (${name})`,
      () => {
        accessVars(bm1)
      },
      () => {
        accessVars(bm2)
      }
    )
  }

  const setVars = (x: any) => {
    bigModelBigVars.forEach(bmbv => {
      const small = x[bmbv]
      smallModelVars.forEach(smv => {
        small["set" + smv.toUpperCase()](small[smv] + "x")
      })
    })
    bigModelSmallVars.forEach(bmsv => {
      x["set" + bmsv.toUpperCase()](x[bmsv] + "x")
    })
  }

  {
    const bm1 = new bigModel({})
    const bm2 = mstBigModel.create({})
    bench(
      `already created, change all simple props (${name})`,
      () => {
        setVars(bm1)
      },
      () => {
        setVars(bm2)
      }
    )
  }

  {
    const bm1 = new bigModel({})
    const bm2 = mstBigModel.create({})

    bench(
      `already created, change one simple props + getSnapshot (${name})`,
      () => {
        bm1.setA(bm1.a + "x")
        getSnapshot(bm1)
      },
      () => {
        bm2.setA(bm2.a + "x")
        mstGetSnapshot(bm2)
      }
    )
  }
})

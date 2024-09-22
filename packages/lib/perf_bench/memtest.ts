import { observable } from "mobx"
import {
  idProp,
  Model,
  model,
  modelAction,
  ModelAutoTypeCheckingMode,
  prop,
  Ref,
  registerRootStore,
  rootRef,
  setGlobalConfig,
  tProp,
  types,
} from "../src"

const byteValueNumberFormatter = Intl.NumberFormat("en", {
  notation: "standard",
  style: "unit",
  unit: "byte",
  unitDisplay: "narrow",
})

// @ts-ignore
function memtest(numProps: number, numInstances: number) {
  console.log(`[${numProps} props, ${numInstances} instances]`)
  console.log()

  function measure<R>(name: string, fn: () => R): R {
    global.gc!()
    const start = process.memoryUsage().heapUsed
    const v = fn()
    global.gc!()
    const end = process.memoryUsage().heapUsed

    const diff = end - start
    console.log(
      `${name}: ${byteValueNumberFormatter.format(diff)} (${byteValueNumberFormatter.format(
        Math.ceil(diff / (numProps * numInstances))
      )}/each)`
    )

    return v
  }

  function plainObj<T>(defValue: (i: number) => T) {
    const obj = {} as any
    for (let i = 0; i < numProps; i++) {
      obj[`prop${i}`] = defValue(i)
    }
    return obj
  }

  const createManyInstances = (fn: () => void) => {
    const arr = [] // keep the instances alive
    for (let i = 0; i < numInstances; i++) {
      arr.push(fn())
    }
    return arr
  }

  function runTests<T>(defValue: (i: number) => T, typedProp: any) {
    measure("plainObj", () => createManyInstances(() => plainObj(defValue)))

    measure("plainMap", () =>
      createManyInstances(() => {
        const map = new Map()
        for (let i = 0; i < numProps; i++) {
          map.set(`prop${i}`, defValue(i))
        }
        return map
      })
    )

    measure("mobxObj", () =>
      createManyInstances(() => {
        const obj = observable.object<any>({}, undefined, { deep: false })
        for (let i = 0; i < numProps; i++) {
          let dv = defValue(i)
          if (typeof dv === "object" && dv !== null) dv = observable(dv)
          obj[`prop${i}`] = dv
        }
        return obj
      })
    )

    measure("mobxMap", () =>
      createManyInstances(() => {
        const map = observable.map<any>()
        for (let i = 0; i < numProps; i++) {
          let dv = defValue(i)
          if (typeof dv === "object" && dv !== null) dv = observable(dv)
          map.set(`prop${i}`, dv)
        }
        return map
      })
    )

    const MksProp = measure("mobxKeystoneClass model creation (prop)", () => {
      const props = Object.create(null)
      for (let i = 0; i < numProps; i++) {
        props[`prop${i}`] = prop<T>()
      }

      @model("MKS-prop-" + Math.random())
      class MKS extends Model(props) {}

      return MKS
    })
    measure("mobxKeystoneClass instance creation (prop)", () =>
      createManyInstances(() => new MksProp(plainObj(defValue)))
    )

    const MksTProp = measure("mobxKeystoneClass model creation (tProp)", () => {
      const props = Object.create(null)
      for (let i = 0; i < numProps; i++) {
        props[`prop${i}`] = tProp(typedProp)
      }

      @model("MKS-tProp-" + Math.random())
      class MKS extends Model(props) {}

      return MKS
    })
    measure("mobxKeystoneClass instance creation (tProp)", () =>
      createManyInstances(() => new MksTProp(plainObj(defValue)))
    )

    console.log()
  }

  console.log("# simple props")

  runTests((i) => i, types.number)

  console.log("# array props")

  runTests(() => [], types.array(types.number))

  console.log("# object props")

  runTests(
    () => ({}),
    types.object(() => ({}))
  )
}

memtest(10000, 1)
// memtest(1, 2000)

function testCreationSpeed(n: number) {
  setGlobalConfig({
    modelAutoTypeChecking: ModelAutoTypeCheckingMode.AlwaysOff,
  })
  const categoryRef = rootRef<TodoCategory>("myCoolApp/categoryRef")

  @model("myCoolApp/Cateogry")
  class TodoCategory extends Model({
    id: idProp,
    text: prop<string>("category"),
  }) {}

  @model("myCoolApp/Todo")
  class Todo extends Model({
    id: idProp,
    text: prop<string>("todo"),
    done: prop(false),
    categoryRef: prop<Ref<TodoCategory> | undefined>(),
  }) {}

  @model("myCoolApp/TodoStore")
  class Store extends Model({
    categories: prop<TodoCategory[]>(() => []),
    todos: prop<Todo[]>(() => []),
  }) {
    @modelAction
    reset() {
      this.categories = []
      this.todos = []
    }

    @modelAction
    justCreatingModels() {
      const todos: Todo[] = []
      for (let i = 0; i < n; i++) {
        todos.push(new Todo({ text: "" }))
      }
    }

    @modelAction
    bigInitWithoutRefsWithoutAssign() {
      for (let i = 0; i < n; i++) {
        this.todos.push(new Todo({ text: "" }))
      }
    }

    @modelAction
    bigInitWithoutRefsWithAssign() {
      const todos: Todo[] = []
      for (let i = 0; i < n; i++) {
        todos.push(new Todo({ text: "" }))
      }
      this.todos = [...this.todos, ...todos]
    }

    @modelAction
    bigInitWithRefsWithoutAssign() {
      const category = new TodoCategory({})
      const todos: Todo[] = []
      for (let i = 0; i < n; i++) {
        todos.push(new Todo({ text: "", categoryRef: categoryRef(category) }))
      }
    }

    @modelAction
    bigInitWithRefsWithAssign() {
      const category = new TodoCategory({})
      this.categories.push(category)

      const todos: Todo[] = []
      for (let i = 0; i < n; i++) {
        todos.push(new Todo({ text: "", categoryRef: categoryRef(category) }))
      }
      this.todos = [...this.todos, ...todos]
    }

    mobxInit() {
      const todos: { text: string }[] = observable([])
      for (let i = 0; i < n; i++) {
        todos.push({ text: "" })
      }
    }
  }

  const store = new Store({})
  registerRootStore(store)

  store.reset()

  console.time("justCreatingModel")
  store.justCreatingModels()
  console.timeEnd("justCreatingModel")

  store.reset()

  console.time("bigInitWithoutRefsWithoutAssign")
  store.bigInitWithoutRefsWithoutAssign()
  console.timeEnd("bigInitWithoutRefsWithoutAssign")

  store.reset()

  console.time("bigInitWithoutRefsWithAssign")
  store.bigInitWithoutRefsWithAssign()
  console.timeEnd("bigInitWithoutRefsWithAssign")

  store.reset()

  console.time("bigInitWithRefsWithoutAssign")
  store.bigInitWithRefsWithoutAssign()
  console.timeEnd("bigInitWithRefsWithoutAssign")

  store.reset()

  console.time("bigInitWithRefsWithoutAssign")
  store.bigInitWithRefsWithoutAssign()
  console.timeEnd("bigInitWithRefsWithoutAssign")

  store.reset()

  console.time("mobxInit")
  store.mobxInit()
  console.timeEnd("mobxInit")

  store.reset()
}

testCreationSpeed(10_000)

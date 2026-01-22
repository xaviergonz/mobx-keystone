import { ImplicitTreap } from "../../src/binding/ImplicitTreap"

describe("ImplicitTreap", () => {
  test("fromArray should handle various sizes", () => {
    const sizes = [0, 1, 2, 5, 10, 100]

    for (const size of sizes) {
      const items = Array.from({ length: size }, (_, i) => `item-${i}`)
      const treap = ImplicitTreap.fromArray(items)

      // Verify indexOf works correctly
      for (let i = 0; i < size; i++) {
        expect(treap.indexOf(`item-${i}`)).toBe(i)
      }

      // Test move operation
      if (size >= 2) {
        treap.move(0, size - 1)
        expect(treap.indexOf("item-0")).toBe(size - 1)
        expect(treap.indexOf("item-1")).toBe(0)
      }
    }
  })

  test("handles moves correctly", () => {
    const items = ["A", "B", "C", "D", "E"]
    const treap = ImplicitTreap.fromArray(items)

    // Initial positions
    expect(treap.indexOf("A")).toBe(0)
    expect(treap.indexOf("C")).toBe(2)
    expect(treap.indexOf("E")).toBe(4)

    // Move A to position 2 (after removing it)
    // [A,B,C,D,E] -> [B,C,A,D,E]
    treap.move(0, 2)

    expect(treap.indexOf("B")).toBe(0)
    expect(treap.indexOf("C")).toBe(1)
    expect(treap.indexOf("A")).toBe(2)
    expect(treap.indexOf("D")).toBe(3)
    expect(treap.indexOf("E")).toBe(4)
  })

  test("move from beginning to end", () => {
    const treap = ImplicitTreap.fromArray(["A", "B", "C"])
    treap.move(0, 3) // Move A to end
    expect(treap.indexOf("B")).toBe(0)
    expect(treap.indexOf("C")).toBe(1)
    expect(treap.indexOf("A")).toBe(2)
  })

  test("move from end to beginning", () => {
    const treap = ImplicitTreap.fromArray(["A", "B", "C"])
    treap.move(2, 0) // Move C to beginning
    expect(treap.indexOf("C")).toBe(0)
    expect(treap.indexOf("A")).toBe(1)
    expect(treap.indexOf("B")).toBe(2)
  })

  test("move to same position is no-op", () => {
    const treap = ImplicitTreap.fromArray(["A", "B", "C"])
    treap.move(1, 1) // Move B to its own position
    expect(treap.indexOf("A")).toBe(0)
    expect(treap.indexOf("B")).toBe(1)
    expect(treap.indexOf("C")).toBe(2)
  })

  test("multiple sequential moves", () => {
    const treap = ImplicitTreap.fromArray(["A", "B", "C", "D"])

    // [A, B, C, D] -> [B, C, D, A] (move A to end)
    treap.move(0, 4)
    expect(treap.indexOf("B")).toBe(0)
    expect(treap.indexOf("C")).toBe(1)
    expect(treap.indexOf("D")).toBe(2)
    expect(treap.indexOf("A")).toBe(3)

    // [B, C, D, A] -> [D, B, C, A] (move D to beginning)
    treap.move(2, 0)
    expect(treap.indexOf("D")).toBe(0)
    expect(treap.indexOf("B")).toBe(1)
    expect(treap.indexOf("C")).toBe(2)
    expect(treap.indexOf("A")).toBe(3)
  })

  describe("length property", () => {
    test("returns 0 for empty treap", () => {
      const treap = ImplicitTreap.fromArray<string>([])
      expect(treap.length).toBe(0)
    })

    test("returns correct length after construction", () => {
      const treap = ImplicitTreap.fromArray(["A", "B", "C"])
      expect(treap.length).toBe(3)
    })
  })

  describe("has method", () => {
    test("returns true for existing values", () => {
      const treap = ImplicitTreap.fromArray(["A", "B", "C"])
      expect(treap.has("A")).toBe(true)
      expect(treap.has("B")).toBe(true)
      expect(treap.has("C")).toBe(true)
    })

    test("returns false for non-existing values", () => {
      const treap = ImplicitTreap.fromArray(["A", "B", "C"])
      expect(treap.has("D")).toBe(false)
      expect(treap.has("")).toBe(false)
    })
  })

  describe("get method", () => {
    test("returns value at index", () => {
      const treap = ImplicitTreap.fromArray(["A", "B", "C"])
      expect(treap.get(0)).toBe("A")
      expect(treap.get(1)).toBe("B")
      expect(treap.get(2)).toBe("C")
    })

    test("returns undefined for out of bounds index", () => {
      const treap = ImplicitTreap.fromArray(["A", "B", "C"])
      expect(treap.get(-1)).toBeUndefined()
      expect(treap.get(3)).toBeUndefined()
      expect(treap.get(100)).toBeUndefined()
    })

    test("works correctly after move", () => {
      const treap = ImplicitTreap.fromArray(["A", "B", "C"])
      treap.move(0, 3) // [A,B,C] -> [B,C,A]
      expect(treap.get(0)).toBe("B")
      expect(treap.get(1)).toBe("C")
      expect(treap.get(2)).toBe("A")
    })
  })

  describe("insert method", () => {
    test("insert at beginning", () => {
      const treap = ImplicitTreap.fromArray(["B", "C"])
      treap.insert(0, "A")
      expect(treap.length).toBe(3)
      expect(treap.get(0)).toBe("A")
      expect(treap.get(1)).toBe("B")
      expect(treap.get(2)).toBe("C")
      expect(treap.indexOf("A")).toBe(0)
    })

    test("insert at end", () => {
      const treap = ImplicitTreap.fromArray(["A", "B"])
      treap.insert(2, "C")
      expect(treap.length).toBe(3)
      expect(treap.get(0)).toBe("A")
      expect(treap.get(1)).toBe("B")
      expect(treap.get(2)).toBe("C")
      expect(treap.indexOf("C")).toBe(2)
    })

    test("insert in middle", () => {
      const treap = ImplicitTreap.fromArray(["A", "C"])
      treap.insert(1, "B")
      expect(treap.length).toBe(3)
      expect(treap.get(0)).toBe("A")
      expect(treap.get(1)).toBe("B")
      expect(treap.get(2)).toBe("C")
      expect(treap.indexOf("B")).toBe(1)
    })

    test("insert into empty treap", () => {
      const treap = ImplicitTreap.fromArray<string>([])
      treap.insert(0, "A")
      expect(treap.length).toBe(1)
      expect(treap.get(0)).toBe("A")
    })

    test("throws if value already exists", () => {
      const treap = ImplicitTreap.fromArray(["A", "B"])
      expect(() => treap.insert(1, "A")).toThrow("Value already exists in treap")
    })

    test("multiple inserts", () => {
      const treap = ImplicitTreap.fromArray<string>([])
      treap.insert(0, "C")
      treap.insert(0, "A")
      treap.insert(1, "B")
      expect(treap.length).toBe(3)
      expect(treap.get(0)).toBe("A")
      expect(treap.get(1)).toBe("B")
      expect(treap.get(2)).toBe("C")
    })
  })

  describe("deleteAt method", () => {
    test("delete at beginning", () => {
      const treap = ImplicitTreap.fromArray(["A", "B", "C"])
      const deleted = treap.deleteAt(0)
      expect(deleted).toBe("A")
      expect(treap.length).toBe(2)
      expect(treap.get(0)).toBe("B")
      expect(treap.get(1)).toBe("C")
      expect(treap.has("A")).toBe(false)
    })

    test("delete at end", () => {
      const treap = ImplicitTreap.fromArray(["A", "B", "C"])
      const deleted = treap.deleteAt(2)
      expect(deleted).toBe("C")
      expect(treap.length).toBe(2)
      expect(treap.get(0)).toBe("A")
      expect(treap.get(1)).toBe("B")
      expect(treap.has("C")).toBe(false)
    })

    test("delete in middle", () => {
      const treap = ImplicitTreap.fromArray(["A", "B", "C"])
      const deleted = treap.deleteAt(1)
      expect(deleted).toBe("B")
      expect(treap.length).toBe(2)
      expect(treap.get(0)).toBe("A")
      expect(treap.get(1)).toBe("C")
      expect(treap.has("B")).toBe(false)
    })

    test("delete out of bounds returns undefined", () => {
      const treap = ImplicitTreap.fromArray(["A", "B", "C"])
      expect(treap.deleteAt(-1)).toBeUndefined()
      expect(treap.deleteAt(3)).toBeUndefined()
      expect(treap.length).toBe(3)
    })

    test("delete all elements", () => {
      const treap = ImplicitTreap.fromArray(["A", "B", "C"])
      treap.deleteAt(0)
      treap.deleteAt(0)
      treap.deleteAt(0)
      expect(treap.length).toBe(0)
    })
  })

  describe("delete method", () => {
    test("delete existing value", () => {
      const treap = ImplicitTreap.fromArray(["A", "B", "C"])
      expect(treap.delete("B")).toBe(true)
      expect(treap.length).toBe(2)
      expect(treap.get(0)).toBe("A")
      expect(treap.get(1)).toBe("C")
    })

    test("delete non-existing value returns false", () => {
      const treap = ImplicitTreap.fromArray(["A", "B", "C"])
      expect(treap.delete("D")).toBe(false)
      expect(treap.length).toBe(3)
    })
  })

  describe("combined operations", () => {
    test("insert then move", () => {
      const treap = ImplicitTreap.fromArray(["A", "C"])
      treap.insert(1, "B")
      // [A, B, C]
      treap.move(0, 3) // [B, C, A]
      expect(treap.get(0)).toBe("B")
      expect(treap.get(1)).toBe("C")
      expect(treap.get(2)).toBe("A")
    })

    test("delete then move", () => {
      const treap = ImplicitTreap.fromArray(["A", "B", "C", "D"])
      treap.delete("B")
      // [A, C, D]
      treap.move(0, 3) // [C, D, A]
      expect(treap.get(0)).toBe("C")
      expect(treap.get(1)).toBe("D")
      expect(treap.get(2)).toBe("A")
    })

    test("move then insert", () => {
      const treap = ImplicitTreap.fromArray(["A", "B", "C"])
      treap.move(0, 3) // [B, C, A]
      treap.insert(1, "X")
      // [B, X, C, A]
      expect(treap.get(0)).toBe("B")
      expect(treap.get(1)).toBe("X")
      expect(treap.get(2)).toBe("C")
      expect(treap.get(3)).toBe("A")
    })

    test("stress test with many operations", () => {
      const treap = ImplicitTreap.fromArray<string>([])

      // Insert 10 items
      for (let i = 0; i < 10; i++) {
        treap.insert(i, `item-${i}`)
      }
      expect(treap.length).toBe(10)

      // Verify all positions
      for (let i = 0; i < 10; i++) {
        expect(treap.indexOf(`item-${i}`)).toBe(i)
        expect(treap.get(i)).toBe(`item-${i}`)
      }

      // Delete even indices (in reverse to keep indices stable)
      for (let i = 8; i >= 0; i -= 2) {
        treap.deleteAt(i)
      }
      expect(treap.length).toBe(5)

      // Remaining: item-1, item-3, item-5, item-7, item-9
      expect(treap.get(0)).toBe("item-1")
      expect(treap.get(1)).toBe("item-3")
      expect(treap.get(2)).toBe("item-5")
      expect(treap.get(3)).toBe("item-7")
      expect(treap.get(4)).toBe("item-9")

      // Move first to end
      treap.move(0, 5)
      expect(treap.get(0)).toBe("item-3")
      expect(treap.get(4)).toBe("item-1")
    })
  })
})

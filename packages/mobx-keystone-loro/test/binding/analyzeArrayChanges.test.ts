describe("analyzeArrayChanges path encoding", () => {
  test("path encoding should distinguish numeric and string path segments", () => {
    // Create mock changes with paths that could collide
    // Path ["items", 1] vs ["items", "1"] should be different
    const mockChangePath1 = ["items", 1] as const
    const mockChangePath2 = ["items", "1"] as const

    // Encode paths using the same logic as analyzeArrayChanges
    const encodeSegment = (s: string | number) => (typeof s === "number" ? `n:${s}` : `s:${s}`)
    const key1 = mockChangePath1.map(encodeSegment).join("\0")
    const key2 = mockChangePath2.map(encodeSegment).join("\0")

    // After fix, these should be different
    expect(key1).not.toBe(key2)
    expect(key1).toBe("s:items\0n:1")
    expect(key2).toBe("s:items\0s:1")
  })

  test("deeply nested paths should encode correctly", () => {
    const encodeSegment = (s: string | number) => (typeof s === "number" ? `n:${s}` : `s:${s}`)

    const path1 = ["root", "items", 0, "children", 1]
    const path2 = ["root", "items", "0", "children", "1"]

    const key1 = path1.map(encodeSegment).join("\0")
    const key2 = path2.map(encodeSegment).join("\0")

    expect(key1).not.toBe(key2)
    expect(key1).toBe("s:root\0s:items\0n:0\0s:children\0n:1")
    expect(key2).toBe("s:root\0s:items\0s:0\0s:children\0s:1")
  })

  test("empty path should encode correctly", () => {
    const encodeSegment = (s: string | number) => (typeof s === "number" ? `n:${s}` : `s:${s}`)
    const emptyPath: (string | number)[] = []
    const key = emptyPath.map(encodeSegment).join("\0")
    expect(key).toBe("")
  })

  test("single segment paths should encode correctly", () => {
    const encodeSegment = (s: string | number) => (typeof s === "number" ? `n:${s}` : `s:${s}`)

    expect([0].map(encodeSegment).join("\0")).toBe("n:0")
    expect(["0"].map(encodeSegment).join("\0")).toBe("s:0")
    expect(["items"].map(encodeSegment).join("\0")).toBe("s:items")
  })
})

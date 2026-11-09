/**
 * lib/log-safe.ts stands between a caller-supplied identifier and a server log
 * line. Two attacks motivate it, and both are cheap to regress: a tool name
 * carrying CR/LF forges log entries a human or an alerting rule will read as
 * real, and a tool name carrying a `%s` directive makes `console.*` splice the
 * next argument — usually the error object — into the message.
 *
 * The rule is a whitelist, so the tests pin both halves: legitimate identifiers
 * must survive untouched, and anything outside the alphabet must not.
 */

import { safeLogToken } from "@/lib/log-safe"

describe("safeLogToken", () => {
  it("leaves a legitimate tool name exactly as it was", () => {
    expect(safeLogToken("articles.publish")).toBe("articles.publish")
    expect(safeLogToken("notilab/mcp:tools-list")).toBe("notilab/mcp:tools-list")
    expect(safeLogToken("agent@v1")).toBe("agent@v1")
  })

  it("neutralises newlines so a value cannot forge a second log line", () => {
    expect(safeLogToken("real\n[admin-auth] login accepted")).toBe(
      "real??admin-auth??login?accepted",
    )
    expect(safeLogToken("a\r\nb")).toBe("a??b")
  })

  it("neutralises format directives so console.* cannot splice an argument", () => {
    // The `%` is what console.* reads; the letter after it is harmless on its own.
    expect(safeLogToken("tools/call %s %o")).toBe("tools/call??s??o")
    expect(safeLogToken("%s").includes("%")).toBe(false)
  })

  it("drops the usual injection punctuation", () => {
    // `/` is part of a legitimate method name, so it stays; the brackets do not.
    expect(safeLogToken("<script>alert(1)</script>")).toBe("?script?alert?1??/script?")
  })

  it("caps the length so one request cannot flood the log", () => {
    const long = "a".repeat(500)
    const result = safeLogToken(long)
    expect(result).toHaveLength(123)
    expect(result.endsWith("...")).toBe(true)
  })

  it("accepts a caller-chosen cap", () => {
    expect(safeLogToken("abcdefghij", 4)).toBe("abcd...")
  })

  it("renders a non-string without throwing", () => {
    expect(safeLogToken(undefined)).toBe("")
    expect(safeLogToken(null)).toBe("")
    expect(safeLogToken(42)).toBe("42")
    expect(safeLogToken({ toString: () => "obj\nname" })).toBe("obj?name")
  })
})

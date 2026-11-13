/**
 * Covers the rewrite parser, whose job is to refuse.
 *
 * The case that must never regress is the truncated response: a token limit
 * cuts the model off mid-article and what arrives is *valid JSON* with a
 * believable title and three sentences of body. Accepting it stamps half an
 * article as ours. § 3.5 of docs/editor/ingestion-editorial-workflow.md is
 * explicit that a partially-written rewrite is treated as absent, and that
 * rule is only real if it is enforced here.
 */

import { parseRewrite } from "@/lib/ai-processing/rewrite/parse"

const BODY = "Parágrafo com substância suficiente para passar o piso mínimo. ".repeat(6)

describe("parseRewrite", () => {
  it("accepts a well-formed rewrite", () => {
    const outcome = parseRewrite(JSON.stringify({ title: "FC Porto vence no Dragão", content: BODY }))

    expect(outcome.kind).toBe("ok")
    if (outcome.kind === "ok") {
      expect(outcome.result.title).toBe("FC Porto vence no Dragão")
      expect(outcome.result.content).toBe(BODY.trim())
    }
  })

  it("accepts JSON the model wrapped in a code fence", () => {
    const fenced = "```json\n" + JSON.stringify({ title: "Título", content: BODY }) + "\n```"
    expect(parseRewrite(fenced).kind).toBe("ok")
  })

  it("refuses a truncated body that is otherwise valid JSON", () => {
    const outcome = parseRewrite(
      JSON.stringify({ title: "Título plausível", content: "Três frases apenas." }),
    )

    expect(outcome.kind).toBe("unusable")
    if (outcome.kind === "unusable") expect(outcome.reason).toMatch(/too short/)
  })

  it("refuses a title with no body", () => {
    const outcome = parseRewrite(JSON.stringify({ title: "Só a manchete" }))
    expect(outcome.kind).toBe("unusable")
  })

  it("refuses a body with no title", () => {
    const outcome = parseRewrite(JSON.stringify({ content: BODY }))
    expect(outcome.kind).toBe("unusable")
  })

  it("refuses an empty title rather than storing whitespace", () => {
    expect(parseRewrite(JSON.stringify({ title: "   ", content: BODY })).kind).toBe("unusable")
  })

  it("refuses prose that is not JSON at all", () => {
    expect(parseRewrite("Claro! Aqui está o artigo que pediste.").kind).toBe("unusable")
  })

  it("recognises the model's own refusal", () => {
    expect(parseRewrite("INSUFICIENTE").kind).toBe("insufficient")
    expect(parseRewrite("  insuficiente  ").kind).toBe("insufficient")
  })

  it("does not mistake an article that discusses insufficiency for a refusal", () => {
    const outcome = parseRewrite(
      JSON.stringify({
        title: "Relatório considera insuficiente a resposta do governo",
        content: BODY,
      }),
    )

    expect(outcome.kind).toBe("ok")
  })
})

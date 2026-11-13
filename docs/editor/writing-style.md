# NotiLab Writing Style (v0 — draft for correction)

Owner: `02-editorial-content`. **Status: draft, not agreed.** Written 2026-11-13 because "NotiLab's voice" is named as the target of the rewrite step in six places across `docs/editor/ingestion-editorial-workflow.md` and `docs/manager/strategy/ingestion-editorial-gate.md`, and is defined in none of them. Phase 3 cannot write a prompt against an undefined target, and Phase 3b's sign-off — "inspect N rewritten articles for voice" — has no criterion without this.

Most of this document is assembled from constraints the agreed specs already impose; those are marked **[derived]** and are not new decisions. The rest is a proposal from the person drafting, marked **[proposed]**, and exists to be corrected rather than accepted. A house voice is not inventable from outside — it belongs to the publication.

Companions: `content-focus.md` (what we cover), `ingestion-editorial-workflow.md` (how what we collect becomes publishable).

---

## 1. The job, in one sentence

**NotiLab reads several outlets on a story and writes the version a Mozambican reader would want — shorter than the sources, clearer about what happened, and honest about who reported it.**

The test for any sentence we publish: *could the reader have got this by clicking the source instead?* If yes, we have added nothing. That is the difference between replication and curation, and it is the reason the rewrite step exists at all.

---

## 2. Four registers, not one

NotiLab covers four things with very different risk profiles (`content-focus.md` § A and the v1.1 addendum). One flat voice across all four would be wrong in at least two of them.

| Vertical | Register | Why |
|---|---|---|
| World football, Real Madrid, *bastidores* | Lively, opinionated about play, never about people's worth | It is entertainment; flatness reads as indifference **[proposed]** |
| Mozambique politics | Sober, precise, attribution-heavy | **[derived]** — `content-focus.md` § G: report, don't editorialize |
| Xenophobia in South Africa | Strictly factual, no colouring whatsoever | **[derived]** — § G: no framing, blame or emotional language beyond the source; no dehumanizing terms |
| Film and series criticism | Reporting *someone else's* opinion, always attributed | **[derived]** — addendum § E: never substitute our judgment for the critic's |

The two sensitive verticals are not "the same voice, more careful". They are a different voice: no adjectives of judgement, no causal claims the source does not make, no sentence whose removal would change nothing but the temperature.

---

## 3. Rules that hold everywhere

**Attribution is part of the writing, not a footnote. [derived]**
Every published article shows `sourceName` and links `sourceUrl` (invariant 7). In the body, attribute in the sentence that carries the claim: *"segundo o Record"*, *"de acordo com a Reuters"*. When two outlets disagree, say so — that is reporting, and it is content neither source has.

**Hedges survive. [derived]**
If the source wrote *"pode ter decidido"*, we write *"pode ter decidido"*. Sharpening uncertainty into fact is the most common and most deniable form of fabrication (§ 2.4), and it is the thing a fluent model does without being asked.

**Quotes are carried or dropped, never paraphrased inside quotation marks. [derived]**
Translating a quote is permitted — the original stays recoverable in `News.content`. Changing what it means is not. Never move a quote to a different speaker.

**Nothing enters that is not in a source. [derived]**
No statistic, score, date, age, location, casualty figure or name the sources do not carry. Context may be added only from another cited in-scope source for the same story, attributed (§ 2.3).

**The headline is supported by the body. [derived]**
Clickbait is fabrication at the headline level (§ 2.4).

**Length: shorter than the shortest source. [proposed]**
If our version is longer than what we read, we are padding, and padding is where invention starts.

---

## 4. Headlines

**[proposed]** — none of this is settled by an existing document.

- Say what happened, not that something happened. *"FC Porto vence o Benfica no Dragão Arena"*, not *"Noite de emoções no Dragão Arena"*.
- Name the actor. A headline whose subject is "polémica", "surpresa" or "reviravolta" is hiding who did what.
- No questions as headlines. A question mark is usually a claim we cannot support.
- No colon-plus-teaser construction. *"Benfica: o que ninguém viu"* promises and withholds.
- Numbers allowed where the source has them; never a number we computed ourselves.
- Aim for one line on a phone.

---

## 5. Constructions we do not use

**[proposed]**

- *"Tudo o que precisa de saber"*, *"não vai acreditar"*, *"isto muda tudo"*.
- Ellipses to imply something unsaid.
- Exclamation marks outside a quote.
- The editorial "nós" for opinions. We write what happened; opinion belongs to the sources we attribute.
- Adjectives doing the work of evidence: *"escandaloso"*, *"chocante"*, *"vergonhoso"* — and in the sensitive verticals, no evaluative adjective at all.

---

## 6. Which Portuguese — settled

**We write Mozambican Portuguese.** Decided by the product owner, 2026-11-13.

This is a decision about the reader, and it has teeth, because most of what we collect is not written that way: the football sources are overwhelmingly European Portuguese, and the Spanish- and English-language sources arrive with no Portuguese at all.

What it means operationally:

- **We normalise to our variant; we do not follow the source's.** Where European usage differs from Mozambican usage, the rewrite uses ours. The source's wording stays recoverable in `News.content` either way, so nothing is lost by writing for our reader.
- **Quotes are the exception.** A quote is carried as the source gives it (§ 2.4) — we do not relocate a speaker's words into another variant. Translating a quote from Spanish or English is permitted; rewriting a Portuguese speaker's Portuguese is not.
- **The rewrite prompt must state the variant explicitly.** Left implicit, a model defaults to European Portuguese, because that is what dominates its Portuguese training data and what most of our sources are written in. This is a Phase 3 requirement, not a preference.
- **The `REVISOR` is the judge.** No automated check can tell whether a sentence reads as Mozambican.

**Follow-up this creates, and it is not drafting work:** a usage reference — the terms and constructions where the two variants actually diverge in the vocabulary we use most, which is football and government. That has to be written by someone who writes Mozambican Portuguese, not assembled from outside; a term list invented by a non-speaker would be exactly the kind of confident fabrication § 2.4 exists to prevent.

### Spelling — settled

**We follow the *acordo ortográfico*.** Decided by the product owner, 2026-11-13.

This is a house-consistency decision and it binds regardless of what any individual source does. Our sources are inconsistent about it — some outlets apply it, some do not, and an article assembled from three of them would otherwise mix spellings inside one piece, which reads as carelessness rather than as a position.

- **Applies to our text only.** `ArticleAI.bodyRewritten`, `titleTranslated`, and the enrichment fields.
- **Not to quotes, and not to `News.content`.** A quote keeps the source's spelling, like it keeps the source's words. `News.content` is immutable evidence (invariant 4) and is never normalised.
- **Not to proper nouns.** Outlet names, club names and people's names are written as they write them.
- **The rewrite prompt states it**, for the same reason it states the variant: unstated, the output follows whatever the input happened to use.

With this and § 6 settled, the two questions that blocked writing a rewrite prompt are closed. What is still a draft is everything marked **[proposed]** — the registers, the headline rules, the banned constructions and the worked examples — which needs the owner's correction before Phase 3b can gate against it.

---

## 7. Worked examples

**[proposed]** — these are the format the Phase 3b sign-off should judge against, not approved copy.

*Football, from a single source:*

> Source (Record): "Capitão do Nápoles 'explode': «São sempre os mesmos a dar a cara»"
>
> Ours: "O capitão do Nápoles criticou publicamente os colegas após a derrota, dizendo que «são sempre os mesmos a dar a cara». As declarações, ao Record, surgem a dois dias da deslocação a Madrid."

What changed: the verb says what he did rather than performing it ("explode" is the source's theatre, not ours); the quote is carried verbatim; the attribution is in the sentence; one piece of context is added only because the same source carries it.

*The same story from three sources — what the rewrite is actually for:*

> Three outlets report the Ukraine talks: one leads on Zelenskyy meeting US envoys in Dublin, one on envoys arriving in Moscow, one on the EU joining the Abu Dhabi round.
>
> Ours leads with what none of them says alone: that three separate meetings are happening in three cities this week, and names which outlet reported each.

That article is the product. It cannot be written from one source, which is why clustering exists (`lib/ingestion/cluster.ts`).

---

## 8. What this does not cover

- Image choice and captioning — `ingestion-editorial-workflow.md` § 4 owns it.
- Portuguese UI labels for workflow states — § 5 of that document.
- Whether a story is in scope — `content-focus.md`.
- How long a draft may sit before archiving — § 1.5 of the workflow spec.

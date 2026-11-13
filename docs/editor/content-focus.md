# NotiLab Editorial Content-Focus Policy

> **The active scope is v2 (2026-11-12) — jump to it at the end of this file.**
> v1 and Addendum v1.1 below are **superseded**, kept because the reasoning
> behind a retired decision is what stops it being re-proposed from scratch.
> v2 supersedes v1 § A–F and v1.1 § A/C; **v1 § G still binds** (see § G-v2) and
> v1.1 § E still binds for any `filmes` stray.

---

# v1 — pivot (2026-07-14, SUPERSEDED by v2)

Owner: `docs/editor/` (per maintainer decision, 2026-07-14). Drafted by `02-editorial-content`, confirmed by the maintainer. Cross-referenced from `docs/memory/business-rules.md` and `docs/manager/roadmap/ROADMAP.md`.

## A. Scope statement

**In scope (the only content NotiLab now covers):**
1. World football — major international football: FIFA World Cup, continental tournaments, UEFA Champions League, national-team fixtures.
2. Real Madrid CF specifically (club news, matches, squad, board/backstage).
3. Behind-the-scenes ("bastidores") coverage of the **top clubs only** in three domestic top flights — Liga Portugal, English Premier League, Spanish LaLiga (team list in Section B).
4. Mozambique politics (government, parties, elections, national political events).
5. Xenophobia in South Africa — treated as serious social/political news reporting (see Section G).

**Explicitly OUT of scope now** (dropped from the previous general Portugal/EU remit): general EU/Portugal politics, economy/markets/finance, culture/arts/entertainment, technology/AI, science/health, and law/justice as standalone topics. The seeded categories **economia, tecnologia, ciencia, cultura, leis** and generic **politica** (EU/Portugal/global institutional politics) are retired. Non-football sport (F1, NBA, tennis, rugby, cycling, surfing, UFC, cricket, golf, esports, swimming) is also out — "desporto" now means football-in-scope only, not all sport.

## B. "Top teams" per league — CONFIRMED

- **Liga Portugal:** Benfica, FC Porto, Sporting CP.
- **Premier League ("top 6"):** Manchester City, Manchester United, Liverpool, Chelsea, Arsenal, Tottenham.
- **LaLiga:** Real Madrid, Barcelona, Atlético Madrid.

Real Madrid is intentionally double-weighted (standalone focus + LaLiga top team).

## C. Category taxonomy — CONFIRMED

New slugs added (no schema change — uses existing `Category` fields):

| slug | name | meaning |
|---|---|---|
| `desporto` | Desporto | World football, Real Madrid, top-team backstage across PT/EN/ES |
| `mocambique` | Moçambique | Mozambique politics |
| `africa-do-sul` | África do Sul | South Africa xenophobia / migration social issue |
| `general` | Geral | fallback only |

Retired (rows kept, not deleted — see Section F): `politica`, `leis`, `economia`, `tecnologia`, `ciencia`, `cultura`. Deleting the Category rows would orphan existing `News.categoryId` references and destroy the audit/provenance trail — they stay in the DB, just no longer routed to.

## D. `SYNC_QUERIES` (`lib/ingestion/providers.ts`)

```ts
const SYNC_QUERIES: { q: string; lang: string }[] = [
  { q: "\"Real Madrid\"",                                                     lang: "en" },
  { q: "\"Real Madrid\"",                                                     lang: "es" },
  { q: "\"Champions League\" OR \"World Cup\" OR FIFA OR UEFA",              lang: "en" },
  { q: "Benfica OR \"FC Porto\" OR \"Sporting CP\"",                          lang: "pt" },
  { q: "\"Premier League\" AND (Arsenal OR Liverpool OR Chelsea OR Tottenham OR Manchester)", lang: "en" },
  { q: "LaLiga AND (Barcelona OR \"Atletico Madrid\")",                       lang: "es" },
  { q: "Moçambique AND (política OR governo OR eleições OR Frelimo OR Renamo)", lang: "pt" },
  { q: "Mozambique AND (politics OR government OR election)",                lang: "en" },
  { q: "xenophobia AND \"South Africa\"",                                    lang: "en" },
  { q: "xenofobia AND \"África do Sul\"",                                    lang: "pt" },
]
```

Verify the GNews/NewsAPI plan in use actually honors `AND (... OR ...)` grouping; if not, simplify the query and drop the lowest-value slot.

## E. `CATEGORY_RULES` (`lib/ingestion/normalize.ts`)

Order matters (first match wins): `desporto` → `mocambique` → `africa-do-sul` → `general` fallback. Multiword keywords are deliberate — bare single words (`goal`, `porto`, `mundial`, `south africa`) caused the previous false-positive mislabeling bug and are excluded on purpose.

```ts
const CATEGORY_RULES: [string, string[]][] = [
  ["desporto", [
    "real madrid", "barcelona", "atletico madrid", "atlético madrid",
    "benfica", "fc porto", "sporting cp", "sporting clube",
    "manchester city", "manchester united", "liverpool fc",
    "chelsea fc", "arsenal fc", "tottenham",
    "premier league", "la liga", "laliga", "liga portugal",
    "champions league", "world cup", "copa do mundo", "fifa", "uefa",
    "football", "futebol", "soccer", "transfer window", "bastidores",
  ]],
  ["mocambique", [
    "moçambique", "mocambique", "mozambique", "maputo",
    "frelimo", "renamo", "daniel chapo", "nyusi",
  ]],
  ["africa-do-sul", [
    "xenophobia", "xenofobia", "afrophobia", "operation dudula",
    "south africa migrant", "south africa migrants", "south africa immigrant",
    "south africa foreigners", "áfrica do sul imigrantes", "áfrica do sul xenofobia",
  ]],
]
// fallback remains "general"
```

## F. Existing ~142 out-of-scope articles — NOT YET EXECUTED

Recommendation (unchanged from draft): bulk-transition out-of-scope `PUBLISHED` articles to `ARCHIVED` (never delete — preserves `sourceUrl`/provenance and avoids orphaning `ArticleAI`/reactions/read-history). In-scope survivors (Benfica/Champions League/World Cup/Ronaldo/Sporting/Porto-transfers/Women's-football items already under `desporto`) stay `PUBLISHED`.

**Not executed in this pass** — it requires an `AdminAction` audit row (`userId`, `action: "ARCHIVE"`, `resource: "NEWS"`, `resourceId`) per changed article, and there is currently no ADMIN/SUPER_ADMIN user seeded to attribute the action to, plus a set of borderline items (e.g. is a general "football tech" story in scope?) that the policy says should go through a REVISOR rather than an automated keyword sweep. Flagged as a follow-up task rather than run blind against real data.

The seeded `TrendingTopic` rows (AI Regulation, Quantum Computing, Digital Euro, etc.) are also off-scope now and should be cleared/archived on the same basis — let the `recalculate-ranking` cron re-derive scores afterward rather than hand-patching them.

## G. Editorial-sensitivity note (Mozambique politics / South Africa xenophobia)

- **Report, don't editorialize.** Cover xenophobic violence in South Africa as documented events with attributed sources; AI-generated `summary`/`tldr`/`whyItMatters` must not add framing, blame, or emotional language beyond the source. No dehumanizing terms toward migrants — state facts and attribute them.
- **No fabricated specifics.** Casualty figures, dates, quotes, and named actors must trace to `sourceUrl`; contested claims need corroboration or explicit attribution.
- **Human review is mandatory — no auto-publish** for these two categories, regardless of origin (ingestion or AI enrichment). A low-confidence classification here should hold the item for a human, never fall through to publish.
- **Provenance weighting.** Prefer higher-`NewsSource.priority` outlets for these topics; a single low-trust source should not alone drive a published item.

---

# Addendum v1.1 — Film & Series Criticism Vertical (2026-07-14, SUPERSEDED by v2)

> § A and § C are superseded: no query feeds `filmes` under v2 and the vertical is
> defunded. The `filmes` rule block and § E (reviews are opinion) still bind for a
> stray. Whether the vertical is *paused* or *retired* is open — § I-v2 item 6.

ADDS a vertical — does not replace anything in v1 (football, Mozambique politics, South Africa xenophobia all stand unchanged).

## A. Scope

Film and series journalism — criticism/reviews **and** industry news (casting, release/streaming dates, trailers, renewals/cancellations, box-office) — centered on **Netflix**, **Amazon Prime Video**, and **Marvel (MCU)**. Genre emphasis: **action** and **comedy**, plus **doramas (Korean dramas)** as a trending sub-focus. Boundary: platform/franchise-anchored film & TV only — not general celebrity gossip, music, gaming, or red-carpet/awards fluff unless it concerns an in-scope title. A title from another platform (HBO/Disney+, etc.) is in scope only if the story is genuinely about action/comedy/dorama content of note; default is to skip.

## B. Category — new slug `filmes` (not a repurposed `cultura`)

`desporto` was safely repurposed for football because football is a strict subset of "all sport." Film criticism is *not* a subset of `cultura`'s old meaning ("Arte, música, cinema e eventos culturais") — reusing that row would retroactively mislabel legacy music/arts/events articles. Mint a fresh row instead:

| field | value |
|---|---|
| `name` | Cinema & Séries |
| `slug` | `filmes` |
| `description` | Crítica e notícias de cinema e séries — Netflix, Prime Video, Marvel; ação, comédia e doramas |
| `color` | `#7c3aed` |
| `icon` | `clapperboard` |

## C. `SYNC_QUERIES` changes

Merge the two Spanish football slots into one to free a slot:

```ts
// remove:
{ q: "\"Real Madrid\"",                               lang: "es" },
{ q: "LaLiga AND (Barcelona OR \"Atletico Madrid\")", lang: "es" },
// replace with:
{ q: "\"Real Madrid\" OR Barcelona OR \"Atletico Madrid\"", lang: "es" },
```

Add three film-vertical queries:

```ts
{ q: "(Netflix OR \"Prime Video\" OR \"Marvel Studios\") AND (movie OR series OR review OR trailer)", lang: "en" },
{ q: "(Netflix OR \"Prime Video\") AND (filme OR série OR estreia OR crítica)",                        lang: "pt" },
{ q: "dorama OR \"k-drama\" OR \"korean drama\"",                                                       lang: "en" },
```

Net: 10 → 12 queries.

**Rate-limit reality (flagged, not silently fixed):** the sync-news cron runs every 30 min (`vercel.json`) — 48 runs/day. At 12 queries/run that's **576 GNews requests/day**, ~5.75× a 100-req/day free tier. Query count is not the lever — cron cadence is. Recommended fix (needs an explicit decision, it changes `vercel.json`): drop `sync-news` to every 3h (8 runs/day × 12 = 96/day, back under 100), or move to a paid GNews plan. Not applied automatically — this is an infra/cost decision, not an editorial one.

## D. `CATEGORY_RULES` — new `filmes` block

Inserted after `africa-do-sul`, before the `general` fallback (so football/politics keywords still win first — e.g. "Champions League on Prime Video" still lands in `desporto`):

```ts
["filmes", [
  "netflix", "prime video", "amazon prime video",
  "marvel studios", "marvel cinematic", "mcu",
  "movie review", "film review", "series review",
  "crítica de cinema", "crítica do filme", "crítica de série", "crítica da série",
  "box office", "streaming series", "estreia netflix", "nova série",
  "dorama", "doramas", "k-drama", "korean drama",
  "action movie", "action film", "filme de ação",
  "comedy movie", "comedy series", "filme de comédia", "série de comédia",
]],
```

Deliberately no bare `action`, `comedy`, or `marvel` (would false-positive, e.g. `marvel` inside "marvelous").

## E. Editorial-sensitivity note (reviews are opinion — highest fabrication risk)

- No invented ratings — AI enrichment must never manufacture a star score/"X/10"/"critical consensus" the source doesn't state.
- No fabricated verdict — AI may summarize the critic's stated opinion, never substitute its own judgment as if it were the source's.
- No spoilers not present in the source.
- Attribute opinion to the critic/outlet; preserve `sourceName`/`sourceUrl`.
- Standard REVIEW/APPROVAL gate applies before PUBLISHED — not the mandatory-human-hold weight of Mozambique/SA content, but not optional either.

---

# v2 — Scope replacement (2026-11-12 maintainer decision)

Ruling by `02-editorial-content`, 2026-11-13, on a scope decision the maintainer
had already taken and already implemented in `lib/ingestion/*`. The scope itself
is not re-litigated here; what follows is the editorial meaning attached to it.

**Supersedes** v1 § A–F and Addendum v1.1 § A/C. **§ G survives** — see § G-v2.
Nothing in `docs/memory/business-rules.md` or
`docs/editor/ingestion-editorial-workflow.md` is changed by this revision.

## A-v2. Scope statement

**In scope:**

1. **US celebrities** — figures of the North-American entertainment industry:
   Taylor Swift, Beyoncé, Rihanna, the Kardashian/Jenner family, Dwayne Johnson,
   Zendaya, Selena Gomez, Ariana Grande, Travis Kelce, Jennifer Lopez, Timothée
   Chalamet; Hollywood, red-carpet and awards appearances.
2. **Club football** in the English, Portuguese, Spanish and Italian top flights,
   plus Paris Saint-Germain / Ligue 1, plus the UEFA Champions League and Europa
   League.
3. **Financial markets** — Wall Street, S&P 500, Nasdaq, Dow Jones, the Federal
   Reserve, Euronext, the BCE, interest rates and inflation as market events.

**Out of scope by explicit instruction: politics, in all forms.** The Hormuz,
Ukraine/Russia, Trump, Macron and Moçambique queries that held six of the ten
`SYNC_QUERIES` slots were removed, not reordered. Also out, and not revived:
technology/AI, science/health, law, culture/arts, non-football sport.

**Defunded but not re-litigated:** Mozambique politics and South Africa
xenophobia (v1), and the film & series vertical (v1.1). No query feeds them;
their `CATEGORY_RULES` blocks stay — see § C-v2.

## B-v2. Category taxonomy

| slug | status under v2 | notes |
|---|---|---|
| `desporto` | active, narrowed | Club football only. National-team and FIFA-tournament football is **no longer fed** by any query, though the keywords remain |
| `celebridades` | active, new row | Minted rather than repurposing `cultura`, which carries legacy arts/music articles that reuse would retroactively relabel |
| `economia` | active, **revived and narrowed** | A v1-retired slug brought back. Financial markets are a strict *subset* of the row's persisted meaning, so narrowing mislabels no legacy article |
| `general` | fallback only | Not a category — an admission the categoriser could not tell |
| `mocambique`, `africa-do-sul`, `filmes` | routable, unfed | See § C-v2 |

**A `Category` row is never deleted.** v1 § C's reason still holds — deletion
orphans `News.categoryId` and destroys the provenance trail — and `model
Category` has no soft-delete field, so deletion is the only available "removal"
and it is the destructive one.

### Definitions

**`celebridades`** — *Figuras públicas do entretenimento norte-americano —
carreira, música, cinema, aparições públicas e declarações próprias.*

- **In:** career, release, tour, casting and award news about a named US
  entertainment figure; their own on-the-record statements; red-carpet and awards
  appearances as events.
- **Out:** private life as such (relationships, health, family) unless stated on
  the record by the subject or their representative; children; speculation of any
  kind; US politicians and business figures — fame is not the criterion, the
  entertainment industry is; athletes, who reach `desporto` only via in-scope
  football and are otherwise off-scope.

**`economia`** — *Mercados financeiros noticiados — índices, taxas de juro e
decisões de bancos centrais, resultados de empresas cotadas, e os movimentos de
mercado que os acompanham.*

- **In:** index and session moves; central-bank rate decisions and statements
  (Fed, BCE); inflation and rate prints as market events; listed-company
  earnings; Euronext and Wall Street market reporting.
- **Out:** anything advice-shaped (§ H.2.1); crypto price movement and
  prediction; personal finance and "how to invest"; macro and political economy
  as such (budgets, tax policy, GDP as a policy story) — the general-economy
  remit v1 retired and v2 did **not** revive; company news that is not market
  news.

Boundary with `filmes`: a story about a **named person** is `celebridades`; a
story about a **title** is `filmes`. v1.1 § A already excluded general celebrity
gossip and red-carpet fluff from `filmes`, so the two are complementary.

## C-v2. The unfed rule blocks stay — this is deliberate

`mocambique`, `africa-do-sul` and `filmes` keep their `CATEGORY_RULES` keyword
blocks although no query feeds them.

The classifier and the scope statement are two different artefacts with two
different jobs. The classifier's job is to label truthfully what arrives; the
coverage statement is this document plus `SYNC_QUERIES`, which is the actual
volume lever. Collapsing them buys a tidier file at the cost of turning a
genuinely on-topic stray into a silent `general` mislabel — the bug roadmap #15
closed once already.

Two conditions:

- **(a) The `Category` row must exist for every slug the categoriser can emit.**
  Guaranteed mechanically as of 2026-11-13: `CATEGORY_SLUGS` is derived from
  `CATEGORY_RULES` in `lib/ingestion/normalize.ts`, and
  `scripts/db/ensure-categories.ts` refuses to run when
  `lib/ingestion/category-catalog.ts` has no row for one of them.
- **(b) Inert is not invisible.** A category with no intake must not be presented
  to readers as a live section. Open — see § I-v2.

Keep the dated comment in `normalize.ts` explaining that no query feeds them. It
is what lets the next pivot tell *retired* from *forgotten*.

## G-v2. Mozambique / South Africa sensitivity — survives unchanged

**§ G survives into v2 verbatim. Not reduced, not retired.** It governs
*handling*, not *coverage*; it was never conditional on our seeking those
stories. Four live subjects remain with zero intake:

1. **Strays.** The rule blocks still match, so an article can still be classified
   there. § G binds it in full.
2. **The existing published corpus.** Nothing is unpublished (§ F-v2), so those
   articles remain selectable by `lib/digest.ts`, `lib/messaging/deliver.ts`,
   trending, and the `News.priority` "destaque" lever. Every re-surfacing is
   governed by § G.
3. **The rewrite step.** `ingestion-editorial-workflow.md` § 2.4 cites § G by
   name as the "added framing or blame" failure mode. Retiring § G would silently
   delete a rewrite test case still needed for the legacy corpus.
4. **Invariant #12** (an article in `mocambique` or `africa-do-sul` never reaches
   `PUBLISHED` without a `reviewerId`) stays as written.

**§ G.5 — default disposition of a stray (added by v2).** A stray in these
categories is now off-scope *as well as* sensitive. The default is therefore **do
not advance**: leave it at `DRAFT` and let the age-out archive it. Publishing one
requires an explicit `SUPERVISOR` decision recorded as such — an off-scope
exception, not a routine approval. Do **not** use `REJECTED`: it is terminal
(§ 3.4), and "off scope this quarter" is not "not for NotiLab".

## H-v2. Sensitivity notes for the two new verticals

Both belong in `ingestion-editorial-workflow.md` § 2.4 as named failure modes,
alongside the existing `filmes` and `mocambique`/`africa-do-sul` entries.

### § H.1 — `celebridades`: the subject is a living person

The first vertical whose subject matter is named living individuals. The failure
mode is no longer only fabrication; it is **defamation and privacy harm**, and it
is worse than under v1 because the rewrite step publishes in NotiLab's own voice
rather than as attributed republication. Never publish:

1. **An unattributed claim.** "Sources say", "insiders tell" may be carried only
   with the outlet named in our text ("segundo a *People*"). *Test: every claim
   about a named person traces to an attributable subject — the person, their
   representative, a court or official document, or the named outlet.*
2. **Relationship, pregnancy, engagement or breakup speculation stated as fact.**
   § 2.4's "sharpened certainty", and the dominant risk here. "terá terminado"
   must not become "terminou". *Test: modal verbs in the rewrite match the
   modality in `News.content`.*
3. **A health, mental-health, addiction or death claim** without an on-the-record
   statement from the subject, their representative, or an official source. Never
   inferred from a photograph. *Test: every health assertion carries a quote or a
   named source.*
4. **A sexuality or gender-identity claim not self-stated by the subject.**
   Outing is never ours to do, whatever a source carries.
5. **A criminal or legal allegation without its procedural state and authority
   named.** *Acusado / arguido / investigado / condenado* are different facts.
   Never "fez X" where the source says "é acusado de X". *Test: every legal claim
   names the stage and the authority.*
6. **Anything about a celebrity's children.** Minors are not subjects: no names,
   no images, no schooling or health detail, even when a source carries it.
7. **Appearance or body commentary, or "shocking photos" framing.** The rewrite
   adds no adjective of judgement the source does not carry.
8. **A reconstructed quote from a social post.** A tweet or caption is quoted
   verbatim or paraphrased *outside* quotation marks — never rendered as a quote.
9. **An image that merely resolves.** § 4.1 applies in full. A celebrity photo
   from an unknown host is dropped and the article runs imageless (§ 4.2);
   paparazzi imagery has a rights profile at least as bad as wire photos.
10. **Gate:** standard REVIEW/APPROVAL, plus a **mandatory human hold — no
    automated-only path — for any item engaging rules 3, 4, 5 or 6** (health,
    identity, legal allegation, minor). That is § G's weight applied to the
    subset that earns it, rather than to the whole category.

### § H.2 — `economia`: the reader can act on it

The failure mode here is not reputational — a fabricated number or an
advice-shaped sentence is **actionable**. NotiLab is not licensed, holds no
position, and gives no advice. Never publish:

1. **Advice framing of any kind.** No buy/sell/hold, no "oportunidade de
   compra", no "deve investir". An analyst recommendation in a source is reported
   *as that named analyst's recommendation, via the named outlet* — never in our
   voice.
2. **A price target or forecast in our voice.** A target is attributed to the
   institution that issued it or it does not appear. Never one the source does
   not state; never a rounded version of a stated one.
3. **A figure that is not carried verbatim.** Index levels, percentage moves,
   basis points, decision dates, earnings figures, market cap. No recomputation
   (re-basing "rose 1.2% to 5,430" is fabrication), no unit change, no currency
   conversion.
4. **Invented causality.** "Stocks fell and the Fed met" must not become "stocks
   fell *because* the Fed met". Market-cause claims are the most frequent
   hallucination in this vertical: causality is attributed or absent.
5. **A tense or timing slip.** A decided rate change and an expected one are
   different facts. "Expected to cut" must never become "cut".
6. **A stale price presented as current.** `publishedAt` is the source's date and
   review latency is real (median 14.5 h old on arrival, plus review time). Any
   price or level in our text carries its as-of date or session reference, or the
   number is dropped.
7. **Single-security promotion, or crypto price prediction at all.** A
   single-ticker item is in scope only as reported market news, never as a
   thesis.
8. **Gate:** standard REVIEW/APPROVAL, plus a **numeric check** — the reviewer
   confirms every figure in the rewrite appears in `News.content`. This is the one
   vertical where the side-by-side requirement (strategy R4) is mechanically
   checkable, so it is checked rather than eyeballed.
9. **A not-investment-advice disclosure is editorially required** on `economia`
   articles. Its wording and jurisdiction are the maintainer's call — see § I-v2.

## F-v2. The orphaned corpus — explicitly deferred

**Do not mass-unpublish, do not backfill, cut over by date.** Not a new ruling:
`docs/manager/strategy/ingestion-editorial-gate.md` § 3 and the ROADMAP's
"Decided, so it is not re-proposed" already settle the mechanism, and
`PUBLISHED → DRAFT` is not a legal edge anyway. v2 adds a second batch to the
same queue; it does not reopen the question.

What v2 does commit to:

- **(a) Roadmap #18's scope definition widens to v2, and the sweep runs once.**
  #18 was scoped against the *v1* scope. Run as written, it would archive the
  July batch and leave the Jul→Nov politics batch untouched — exactly the
  "half-done, and someone believes it was handled" outcome the strategy doc
  rejects. One sweep, one scope definition, dated 2026-11-12.
- **(b) The "~142" figure must not be carried forward.** It does not reconcile
  with Phase 0 (measured 2026-11-12: 72 rows, 70 PUBLISHED). Either it is wrong or
  the two count different populations — `prisma/seed.ts` alone carries dozens of
  `politica`/`leis`/`economia` demonstration articles, a different problem from
  ingested orphans and possibly a different disposition. Re-measure with
  `pnpm editorial:measure` before sizing anything.
- **(c) The orphans stay published and stay governed.** Everything about Ukraine,
  Trump, Macron, Hormuz and Moçambique politics collected since July keeps its
  status, and § G keeps binding the Mozambique subset. A category going unfed does
  not make its published articles ungoverned.
- **(d) Record the cut-over date.** `docs/memory/decisions.md` carries 2026-11-12
  alongside the v1 date, so the eventual sweep has two queryable boundaries.

**No retroactive demotion by category, ever.**

## I-v2. Open — outside the editorial lane

1. **The `economia` disclosure** (§ H.2.9) — required editorially; its wording and
   jurisdiction (Mozambique / Portugal / both) are a legal and product call.
2. **Defamation posture on `celebridades`.** Publishing about named living
   individuals in NotiLab's own rewritten voice is a materially different
   liability profile from football or markets. § H.1 reduces but does not
   eliminate it; this needs explicit owner acceptance, not an editorial note.
3. **Corpus numbers** — the ~142 vs 72 discrepancy and the size of the new orphan
   batch need a re-measure before #18 is scoped. Owner: `05-database`.
4. **Reader-facing taxonomy is stale.** `components/filter-bar.tsx` hardcodes
   *Política, Desporto, Cultura, Economia, Tendências* — advertising two sections
   we do not cover plus a `tendencias` slug that is not a category, and omitting
   *Celebridades*. Owner: `03-frontend`.
5. **Intake volume.** Phase 0 measured 15.3 articles/active day against a 15/day
   enrichment ceiling — no headroom — and v2 adds three new source clusters.
   Whether intake actually rises is empirical: re-measure after a week, and
   remember that `SYNC_QUERIES` is the lever (strategy R3a).
6. **Is `filmes` paused or retired?** v1.1 was an owner decision and v2 silently
   defunds it. The rule block stays either way; the word decides whether roadmap
   #19 is reopened.
7. **`desporto` narrowed again — confirm the national-team drop is intended.**
   `"World Cup"` and `FIFA` were dropped from `SYNC_QUERIES` while remaining in
   `CATEGORY_RULES`, so national-team and FIFA-tournament football is now unfed.
8. **Travis Kelce routes to `desporto`.** `desporto` is evaluated before
   `celebridades` and carries bare `"football"`/`"soccer"`, so an NFL story about
   him is labelled European club football. American football is in scope in no
   category. Fixing it means reordering the rules or narrowing `desporto`'s bare
   keywords — a taxonomy-ordering decision, not a code cleanup.

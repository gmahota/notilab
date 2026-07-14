# NotiLab Editorial Content-Focus Policy (v1 — pivot)

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

# Addendum v1.1 — Film & Series Criticism Vertical (2026-07-14)

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
- Standard REVIEW/APPROVAL gate applies before PUBLISHED — not the mandatory-human-hold weight of Moçambique/SA content, but not optional either.

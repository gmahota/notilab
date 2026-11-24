# Scope v2 — intake measurement (dry-run, 2026-11-13)

Evidence for roadmap #77 / `USER_STORIES.md` A3: does the 2026-11-12 query set
reopen the noise channel the 2026-07-14 tuning closed?

Run with `pnpm ingest:dry-run` (`scripts/ingestion-dry-run.ts`) against the
working-tree `SYNC_QUERIES`, `quality.ts` and `image-rights.ts`. Writes nothing.
Two consecutive runs returned identical counts, so the figures below are stable
rather than a single sample.

## Counts

| | |
|---|---|
| Fetched | **100** across 10 queries, 0 provider errors |
| Passed the quality gate | **24** |
| Rejected by source (allowlist) | **76** |
| Rejected by shape | **0** |
| Rejected for relevance | **0** |
| Distinct hostnames rejected | 52 |
| Kept their image | **9 of 24** |
| Images dropped, unlicensed host | 15, across 9 distinct hosts |
| After in-batch title dedup | **23 articles** |
| Published that day | 7 |

## Verdict: the noise channel is closed, the volume ceiling is not met

**No noise of the 2026-07-14 kind.** Zero rejections by shape and zero by
relevance, and nothing in the 23 resembles the failures that motivated
`quality.ts` — no scene-release listing, no crypto fan-token piece, no NFL link
roundup, no phone-charging tutorial. On that question the answer is clean.

**But intake exceeds the reviewable rate by about 50 %.** 23 articles/run against
the Phase 0 figures of 15.3 intake per active day and **16/day** the reviewer rate
needed to hold the queue flat. A3's acceptance criterion was that intake stay at
or under that rate, and it does not. Per strategy R3(a), `SYNC_QUERIES` is the
only lever that actually bounds the queue — everything else reorders a backlog.
Which queries to cut is a scope decision, so it is reported here rather than
taken.

**The relevance gate has stopped contributing, and that matters.** It rejected
0/100. The reason is structural, not lucky: the new queries are mostly proper
nouns, and `mustMatch` restates the same proper nouns, so the gate asks whether an
article returned for mentioning "Taylor Swift" mentions "Taylor Swift" in its
title or lead. It almost always does. Under the old topical queries (`Hormuz`,
`Ukraine AND war`) the gate did real work.

The consequence is that **the domain allowlist is now doing 100 % of the
filtering** — 76 of 76 rejections. That is a more fragile arrangement than the
three-gate design assumed: the allowlist is hand-maintained, 52 distinct outlets
were turned away in a single run, and nothing behind it catches a bad article
from a good domain. See the three examples below, each of which came from an
allowlisted outlet and cleared every gate.

## Three items that cleared every gate and should not have

These are editorial failures, not mechanical ones — no tightening of `quality.ts`
would catch them, which is precisely why the § H checklists and the approval
surface matter.

1. **"Lewis Hamilton reportedly plans to take a serious step for Kim Kardashian"**
   (*Times of India*, published that day). Breaks § H.1 rule 1 (unattributed —
   "reportedly", no named source) and rule 2 (relationship speculation). This is
   the dominant `celebridades` failure mode arriving on day one of the vertical.
2. **"Pio Esposito's brace leads Italy to historic 3-1 win over France"** (*ESPN*).
   A **national-team** fixture. v2 narrowed `desporto` to club football and dropped
   `"World Cup"`/`FIFA` from the queries, but the keywords remain in
   `CATEGORY_RULES` and the Serie A query's `mustMatch` admits it. Confirms § I-v2
   item 7 is a live gap, not a theoretical one.
3. **"Fim de ano se aproxima com inflação alta e PIB travado"** (*O Estado de S.
   Paulo*). Brazilian macro — GDP as a policy story — which § H.2 puts explicitly
   out of `economia`'s remit. The `economia` rule's `inflação` keyword cannot tell
   a market print from a macro feature.

**Also: *Times of India* supplied 3 of the 23.** It has been on the allowlist
since the wire era, where it belonged. Under v2 it functions as a
celebrity-gossip desk, and it produced example 1. Whether a general Indian daily
is an acceptable `celebridades` source is an editorial call.

## Images: 62 % of articles would publish with no picture

15 of 24 lost their image, and every rejected host is a **first-party outlet
CDN**, not a stock or aggregator host:

`dimages2.gazzettaobjects.it` (Gazzetta), `i.f1g.fr` (Le Figaro),
`e0.365dm.com` (Sky), `img.asmedia.epimg.net` (AS),
`objetos-xlk.estaticos-marca.com` (Marca), `estaticos-cdn.prensaiberica.es`,
`static.toiimg.com` (Times of India), `sportal365images.com`,
`staticx.noticiasilimitadas.pt`.

Four of these are the candidates roadmap #65a already put to a SUPERVISOR and
which are still undecided. v2 raises the stakes: the Italy, France and celebrity
clusters it added are precisely the ones bleeding images, so #65a is now blocking
the look of the new verticals rather than a handful of legacy articles.

## What this measurement does not cover

- Whether intake *rises* over a week. One run is one run; the crons were dead
  05-11 → 12-11, so the Phase 0 per-active-day figure rests on three days.
  Re-measure with `pnpm editorial:measure` after a week of the new queries.
- Provider quota headroom. This run cost 10 requests, the same as one cron run.

---

# After the cut — 10 queries → 7 (2026-11-13)

By maintainer decision, following the measurement above. Removed: the second
celebrity query, PSG/Ligue 1, and Champions/Europa/UEFA. Also tightened the
Portuguese football query's `mustMatch` from bare `porto`/`sporting` (which
matched "sporting director", "sporting chance" and Porto the city) to
`fc porto`/`sporting cp`. Reasoning per query is in the `providers.ts` docblock.

`scripts/ingestion-dry-run.ts` gained a **per-query contribution** report in the
same change, keyed on the `mustMatch` each article carries through the pipeline.
The first cut had to be argued from inferred attribution; the next one will not.

## Counts

| | before | after |
|---|---|---|
| Queries | 10 | **7** |
| Fetched | 100 | **70** |
| Passed the quality gate | 24 | **10** |
| Rejected by source | 76 | 60 |
| Rejected by shape / relevance | 0 / 0 | **0 / 0** |
| After dedup | 23 | **10** |
| Kept their image | 9/24 (38 %) | **3/10 (30 %)** |

**The volume criterion now passes:** 10 articles/run against 16/day reviewable
and a 15/day enrichment ceiling. It passes with room to spare — the cut overshot,
because removing three queries and tightening the Portuguese `mustMatch`
compounded (that query alone went from ~6 kept to 3).

## Per-query contribution — the finding that matters more than the volume

```
  3/10   benfica | fc porto | sporting cp
  2/10   taylor swift | beyonce | rihanna | kardashian | dwayne johnson | zendaya
  2/10   serie a | juventus | napoli | milan | lazio | inter milan | ...
  2/10   bolsa | mercados | juros | inflacao | euronext | bce
  1/10   real madrid | barcelona | atletico
  0/10   premier league | arsenal | liverpool | chelsea | tottenham | man city | man utd
  0/10   wall street | s&p 500 | nasdaq | dow jones | federal reserve | stocks
```

**Two queries fetch 10 articles each and keep none.** They are not noisy — they
are *filtered out entirely by the domain allowlist*, which the rejected-source
list confirms: `liverpoolecho.co.uk`, `manchestereveningnews.co.uk` for English
football; `marketscreener.com`, `ndtvprofit.com`, `financialexpress.com`,
`economictimes.indiatimes.com` for markets.

So **English Premier League football and US financial markets — two of the three
verticals v2 names — are effectively dark**, while costing 20 of the 70 provider
requests per run. Widening the allowlist for those two beats restoring a deleted
query: it would return volume to the verticals that have none, rather than to
Portuguese football, which already supplies the largest share.

## What the 10 actually are

Of the 10 that would publish today:

- **2 should not** — the same two that survived the pre-cut run. "Lewis Hamilton
  reportedly plans to take a serious step for Kim Kardashian" (§ H.1 rules 1–2)
  and "Fim de ano se aproxima com inflação alta e PIB travado" (macro, out of
  `economia` per § H.2). Neither is reachable by any mechanical gate.
- **1 is marginal** — "Roberto Gómez carga contra el periodismo español" (MARCA)
  is media criticism, not club football.
- **2 are near-duplicates** — two Benfica European-tie items from different
  outlets on the same story. In-batch title dedup caught none of it, which is
  what `cluster.ts` exists for.
- Usable, unambiguously in scope: about **6**.

Against a 15/day enrichment ceiling this is a thin feed, and thin in the wrong
places. The volume problem is solved; the **coverage** problem it exposed is not.

---

# After widening the allowlist — 6 domains added (2026-11-13)

By maintainer decision, to un-dark the two verticals above. Added, each with its
reason in `quality.ts`: `liverpoolecho.co.uk` and `manchestereveningnews.co.uk`
(Reach plc club desks — what the Premier League query actually returns),
`telegraph.co.uk` and `standard.co.uk` (tier-1 English football desks absent by
oversight; neither appeared in this yield), `economictimes.indiatimes.com` and
`financialexpress.com` (Indian business dailies — what the US-markets query
actually returns). Deliberately **not** added: `marketscreener.com` (aggregator,
republishes wires), `ndtvprofit.com`, and the Brazilian general dailies.

## Both verticals lit up — #84's criterion is met

| query | before | after |
|---|---|---|
| Wall Street / S&P / Nasdaq / Fed | **0/10** | **6/10** |
| Premier League | **0/10** | **1/10** |

## But intake went back over the ceiling, and a new noise class came with it

| | after the cut | after widening |
|---|---|---|
| Kept | 10/70 | **21/70** |
| Rejected by source | 60 | 49 |
| Images kept | 3/10 | 6/21 |

**21/run against 16/day reviewable and 15/day enrichment.** The widening undid
the cut. It is not a like-for-like comparison — see the variance note below — but
the direction and the magnitude are not in doubt.

### Of the ~11 articles the widening added, roughly 6 are what we wanted

Genuinely in scope and worth having: a Man City midfield analysis (Manchester
Evening News), European shares on the Nvidia CEO exit (Euronews), Cisco earnings,
Asian shares, Yuan/Fed, and the Anthropic IPO story (all Economic Times).

### The rest exposed three new problems

1. **A metaphor cleared the relevance gate — twice.** *"How Jensen Huang, the
   Taylor Swift of tech, reached the pinnacle"* and *"The Taylor Swift of Tech:
   Jensen Huang's mastermind rise"* both arrived via the celebrity query, because
   "Taylor Swift" is genuinely in the title. This is precisely the noise class
   `quality.ts` was built to stop, and **no gate here can catch it**: the term is
   in the title, the outlet is allowlisted, the body is long enough. It needs the
   celebrity queries to require a second entertainment signal (the deleted query 2
   had exactly that: `AND (Hollywood OR music OR film OR tour OR "red carpet")`),
   or a stop-pattern for metaphorical use.
2. **They are also the same story twice, and in-batch title dedup caught neither**
   — different headlines, one subject, one outlet. That is `cluster.ts`'s job, not
   the title fingerprint's, so it may yet be caught downstream; the dry-run does
   not show it.
3. **A regional's entertainment desk came in with its football desk.** Liverpool
   Echo's one contribution was a streaming listicle — *"'Cinematic masterpiece'
   leaves viewers 'gagged' by its dark twist now on Amazon Prime"* — which
   `CATEGORY_RULES` routes to `filmes`, a **defunded** category. It contributed
   zero football this run.

### One source now dominates

**The Times Group supplies 8 of the 21** — 7 from The Economic Times plus the
Times of India celebrity item. A single group producing 38 % of a day's feed is a
concentration risk the allowlist has not had before, and `NewsSource.priority`
cannot express it because nothing is linked to it yet (see the Phase 0 finding on
`sourceId`).

### Also still present

Both items flagged before the cut survive unchanged: the "reportedly" Kim
Kardashian piece (§ H.1) and the Brazilian macro story (§ H.2). And item 19 —
*"year low, but CEO exit and AI worries cloud the bargain"* — is a **truncated
title**, the provider-truncation problem B1/B2 exists to fix, visible in the title
field rather than only the body.

## Variance note — read the three runs with this in mind

The first two runs (10 queries) returned identical counts minutes apart, which
suggested the measurement was stable. It is not, across a longer gap: this run
shows 17 articles published that day against 7 in the pre-cut run, and the
celebrity query moved 2 → 5 and Serie A 2 → 1 on changes that cannot explain
either. These are live queries against a moving corpus. Treat every figure here as
one sample, not a constant, and re-measure with `pnpm editorial:measure` over a
week before sizing anything on them.

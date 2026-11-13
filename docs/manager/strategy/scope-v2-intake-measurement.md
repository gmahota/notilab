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

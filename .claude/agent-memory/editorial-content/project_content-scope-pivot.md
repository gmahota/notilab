---
name: content-scope-pivot
description: Two editorial scope pivots — 2026-07-14 (football + Mozambique politics + SA xenophobia, superseded) and 2026-11-12 (US celebrities + European club football + financial markets, current; politics out by explicit instruction).
metadata:
  type: project
---

NotiLab's editorial scope has been replaced twice by the single maintainer. Each was a REPLACEMENT, not an addition.

## Current — 2026-11-12 maintainer decision (v2)

- **US celebrities** (Taylor Swift, Beyoncé, Rihanna, Kardashian, Zendaya, Selena Gomez, Ariana Grande, Travis Kelce, J-Lo, Timothée Chalamet, Kylie Jenner, Hollywood, red carpet) → new slug `celebridades`.
- **Club football** in the English, Portuguese, Spanish and Italian top flights plus PSG/Ligue 1, plus Champions/Europa League → `desporto` (narrowed again; Real Madrid's v1 standalone double-weighting and World Cup/FIFA/national-team coverage are no longer fed by any query).
- **Financial markets** (Wall Street, S&P 500, Nasdaq, Dow Jones, Federal Reserve, Euronext, BCE, juros, inflação) → `economia`, which is a **revived v1-retired slug, not a new mint** (defensible on the `desporto` precedent: markets ⊂ the old "Mercados financeiros e economia" meaning).
- **Politics is out by explicit instruction.** The Hormuz, Ukraine/Russia, Trump, Macron and Moçambique queries that held six of the ten `SYNC_QUERIES` slots were removed, not reordered.
- `mocambique`, `africa-do-sul` and `filmes` keep their `CATEGORY_RULES` blocks but have no query feeding them — inert, deliberately kept so a stray on-topic article still lands somewhere truthful instead of `general` (roadmap #15's bug).

## Superseded — 2026-07-14 (v1)

World football, Real Madrid, PT/EN/ES top-team backstage, Mozambique politics, South Africa xenophobia; plus the v1.1 `filmes` vertical ([[film-series-vertical]]). Retired at that time: general EU/Portugal politics, economy, culture, tech/AI, science/health, law, non-football sport.

**Why:** owner-directed strategic repositioning, twice, pre-production and without an audience to disrupt yet.
**How to apply:** v2 is authoritative for ingestion-query, categorisation, digest, trending and lifecycle decisions. Two standing consequences: (1) each pivot orphans a batch of already-published articles and NOTHING has ever been archived — roadmap #18's "~142" predates v2 and does not reconcile with the 72-row corpus measured 2026-11-12, so re-measure rather than carrying either number forward; (2) a scope retirement never retroactively demotes published articles — see [[ingestion-publish-gate]], cut over by date. Sensitivity rules: [[sensitive-topic-framing]] (survives with no intake), [[celebrity-markets-sensitivity]] (new in v2). Verify against current code before acting — this snapshot ages fast.

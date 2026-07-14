---
name: content-scope-pivot
description: 2026-07-14 editorial scope pivot — NotiLab now covers only world football, Real Madrid, PT/EN/ES top-team backstage, Mozambique politics, and South Africa xenophobia. Replaces prior general EU/Portugal remit.
metadata:
  type: project
---

On 2026-07-14 the site owner (single maintainer, pre-production) pivoted NotiLab's entire editorial scope. This is a REPLACEMENT of the old general Portugal/EU remit, not an addition (confirmed by direct yes/no).

New scope (the ONLY content covered now):
- World football (World Cup, Champions League, national teams)
- Real Madrid specifically (also counts as a LaLiga top team)
- Behind-the-scenes ("bastidores") of top clubs only in Liga Portugal / Premier League / LaLiga
- Mozambique politics
- Xenophobia in South Africa (serious news reporting, not commentary — see [[sensitive-topic-framing]])

Dropped/retired topics: general EU/Portugal politics, economy, culture, technology/AI, science/health, law, and all non-football sport.

Category-taxonomy recommendation I gave (pending maintainer confirmation): repurpose `desporto` = football-in-scope; add new slugs `mocambique` and `africa-do-sul`; retire `politica`/`leis`/`economia`/`tecnologia`/`ciencia`/`cultura`; keep `general` fallback. No Prisma schema change needed (uses existing Category fields).

Proposed "top teams" default (needs maintainer sign-off, NOT locked): PT = Benfica, FC Porto, Sporting; EN = Man City, Man Utd, Liverpool, Chelsea, Arsenal, Tottenham; ES = Real Madrid, Barcelona, Atlético.

**Why:** Owner-directed strategic pivot to a niche football + specific-politics audience.
**How to apply:** Treat this scope as authoritative for any article-lifecycle, ingestion-query, categorization, digest, or trending decision. The seeded ~142 general-news articles and the seeded TrendingTopic rows are now off-scope — recommend ARCHIVE (not delete, to preserve provenance/audit) via a script that emits AdminAction rows. Intended policy-doc home is docs/editor/. Verify against current code before acting — this snapshot may age.

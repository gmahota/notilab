# Editorial-Content Agent Memory

- [Content scope pivots (v1 2026-07-14, v2 2026-11-12)](project_content-scope-pivot.md) — current scope = US celebrities + EN/PT/ES/IT club football + PSG + financial markets; politics out by explicit instruction.
- [Sensitive-topic framing](project_sensitive-topic-framing.md) — Mozambique politics & SA xenophobia: factual/sourced only, no inflammatory AI framing, mandatory human review; still binding with zero intake.
- [Celebrity & markets sensitivity (v2)](project_celebrity-markets-sensitivity.md) — `celebridades` = defamation/privacy risk on named living people; `economia` = no advice, no invented figures or causality.
- [Film & series vertical (2026-07-14)](project_film-series-vertical.md) — additive vertical: film/series criticism (Netflix/Prime/Marvel, action/comedy/doramas), new `filmes` slug not a `cultura` repurpose; defunded by the v2 pivot.
- [Ingestion publish gate (2026-11-06/11-12)](project_ingestion-publish-gate.md) — scraper never publishes: entry is DRAFT, no source-trust exemption, no retroactive demotion.
- [Gate vs publication window](project_gate-downstream-publication-window.md) — review latency is subtracted from digest/messaging/ranking windows because they key off source `publishedAt`.
- [AI failure must stay failed](project_ai-failure-must-stay-failed.md) — enrichment batch currently stamps heuristic fallback as success; the rewrite step must not copy it.

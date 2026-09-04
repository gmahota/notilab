---
name: language-convention
description: Repo convention — schema/code/identifiers/comments in English; Portuguese only for user-facing content. Portuguese enum values are deliberate persisted data.
metadata:
  type: project
---

A repo-wide language audit (roadmap task #31, done 2026-09-04) established: code, schema,
identifiers, and comments are English. Portuguese is reserved for user-facing *content*.
`prisma/schema.prisma` was brought fully in line — all 33 models/enums already had English
names; the last 8 Portuguese comments were translated.

**Two things in the schema stay Portuguese on purpose:**
- `ProfileType` enum values (`JOVEM`, `EXECUTIVO`, `ESTUDANTE`, `SENIOR`)
- Category slugs

**Why:** those are persisted data values, not identifiers. Renaming them is a real data
migration (enum rename + backfill of every existing row), not a cosmetic change — and
per [[prod-shares-local-db]] there is no safe place to rehearse it.

**How to apply:** write new schema comments and field names in English without asking. Do
*not* "fix" the Portuguese enum values or category slugs as cleanup — if someone asks,
scope it as a data migration and confirm with 02-editorial-content, since `ProfileType`
encodes a product rule. Not yet written into `docs/memory/decisions.md`; if the
convention comes up again, route it to 10-docs-memory so it outranks this file.

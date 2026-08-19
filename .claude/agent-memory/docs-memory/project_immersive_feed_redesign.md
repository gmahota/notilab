---
name: project-immersive-feed-redesign
description: /now immersive feed was redesigned end-to-end 2026-07-15 to match a hifi prototype; backend/schema follow-up work is deferred and tracked on roadmap
metadata:
  type: project
---

On 2026-07-15, `/now` (the immersive feed) was redesigned end-to-end by AI agents in one session to match a static hifi design prototype at `docs/cto/task/1. V01 - New Layout/designs/Agora - Bandeja.dc.html`. Full details recorded in `docs/memory/decisions.md` (2026-07-15 entry) and `docs/manager/roadmap/ROADMAP.md` (roadmap items 21-23).

**Why**: design handoff requested matching the prototype's UI/UX for the immersive feed (onboarding, category picker "bandeja", pace-driven feed styling, why-popover, context panel, dormant spatial viewer).

**How to apply**: The prototype contained fabricated demo data (multi-source lists, per-article "facts", location, a hardcoded 3D scene) that don't exist in the real schema — implementation deliberately did not fabricate matching backend data; see [[decision-no-fabricated-ui-data]] and [[decision-bandeja-store-no-library]]. Two follow-up items are deliberately deferred and NOT yet done: (1) real schema/cron support for `spatialAsset`/multi-source/facts (roadmap #22), (2) the "Explorar" mural redesign (roadmap #23, separate design file `Explorar - Mural.dc.html`, not started). Before treating either as complete, check the roadmap status directly rather than assuming from this memory. No automated test suite covers the new `/now` flows as of this date — verification was typecheck/lint + manual browser exercise only.

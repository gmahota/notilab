---
name: no-state-lib-policy
description: don't add a state-management library (zustand, jotai, redux, etc.) for cross-component client state — use useSyncExternalStore singletons instead
metadata:
  type: feedback
---

Do not add a state-management dependency (zustand, jotai, redux, etc.) to solve cross-component client state sharing in the frontend surface. Use a dependency-free external-store singleton (module-level mutable state + `Set` of listeners + `subscribe`/`getSnapshot`/`getServerSnapshot`) wrapped in a `useSyncExternalStore` hook instead.

**Why:** explicit instruction when building the `/now` feed personalization foundation ([[now-feed-personalization]]) — React 19's `useSyncExternalStore` covers the need without adding a dependency, and the repo currently has zero state-management libraries installed.

**How to apply:** any time a task calls for shared reactive client state across components without prop drilling, reach for this pattern first. Only escalate to proposing a library if the `useSyncExternalStore` approach genuinely can't handle the complexity (e.g., needs derived/selector memoization at scale) — and flag that explicitly rather than adding it silently.

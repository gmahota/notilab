# UI Standards

- **Stack**: Tailwind CSS v4 + Radix UI primitives + shadcn/ui. Reusable primitives live in `components/ui/` — check there before building a new button/dialog/select/etc. from scratch.
- **Server vs. client**: server components by default; add `'use client'` only where interactivity (state, effects, event handlers) requires it.
- **Naming**:
  - React components: PascalCase (`NewsCard`, `AdminSidebar`).
  - Hooks: camelCase with `use` prefix (`useNewsData`).
  - Utility functions: camelCase (`formatDate`, `slugify`) — shared helpers go in `lib/utils.ts`.
  - Component files: kebab-case (`news-card.tsx`); `lib/` modules: camelCase (`newsService.ts`).
- **Data**: components call `lib/*-service.ts` functions or API routes — never query Prisma directly from a component.
- **Env vars**: only `NEXT_PUBLIC_*` variables may be read in client components; everything else stays server-side.
- **Animation**: `framer-motion` and `tailwindcss-animate`/`tw-animate-css` are already dependencies — prefer them over adding a new animation library.
- **Charts**: `recharts` is the established charting library (used in admin dashboards).
- **Client-side cross-component state (no library)**: for small, feature-scoped shared client state (e.g. `/now`'s followed/hidden/pace/onboarded preferences), prefer a hand-rolled `useSyncExternalStore` singleton over adding zustand/jotai/etc. See `lib/immersive/bandeja-store.ts` for the reference pattern (module-level state + subscriber set + localStorage persistence). Only reach for a state library if a second, independent feature needs the same shape of shared state and the duplication becomes real — see `docs/memory/decisions.md`, 2026-07-15.

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

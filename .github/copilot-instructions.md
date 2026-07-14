# NotiLab — GitHub Copilot Instructions

You are assisting with **NotiLab**, a Next.js 15 news aggregation and notification platform.

## Authority Order

`AGENTS.md` (repo root) is the top-level, tool-agnostic charter — if anything below conflicts with it, `AGENTS.md` wins. Below that: this file → `docs/memory/*` (durable project knowledge — architecture, business rules, decisions) → existing code patterns → the current prompt.

## Stack & Architecture

- **Framework**: Next.js 15 (App Router, React 19, TypeScript strict)
- **Database**: PostgreSQL via Prisma ORM — all DB access **must** go through `lib/prisma.ts`
- **Styling**: Tailwind CSS v4 + Radix UI primitives + shadcn/ui components
- **Auth**: JWT-based admin auth via `lib/admin-auth.ts`
- **AI**: OpenAI / Groq via `lib/ai-service.ts`
- **Package manager**: pnpm

## Code Conventions

- Use TypeScript strict mode — avoid `any`, prefer explicit types
- All database queries go through `lib/` service files, never directly in components or route handlers
- API route handlers live in `app/api/**/route.ts` and must stay thin (delegate to `lib/`)
- Server components by default; add `'use client'` only when needed
- UI components go in `components/`; reusable logic goes in `lib/`
- Use `lib/utils.ts` for shared utility functions
- Environment variables: server vars stay in `lib/`, only `NEXT_PUBLIC_*` vars in client code
- Never hardcode secrets — always use `process.env.*`

## Security Rules

- Sanitize all user input before database writes
- Use parameterised queries (Prisma handles this automatically — do not use raw SQL without parameterisation)
- Admin routes must validate the JWT from `lib/admin-auth.ts`
- Never log sensitive data (passwords, tokens, personal data)
- API routes must validate request body shape before processing

## Naming Conventions

- React components: PascalCase (`NewsCard`, `AdminSidebar`)
- Hooks: camelCase with `use` prefix (`useNewsData`)
- Utility functions: camelCase (`formatDate`, `slugify`)
- Database models: match Prisma schema casing
- Files: kebab-case for components (`news-card.tsx`), camelCase for lib modules (`newsService.ts`)

## Commit Message Format (Conventional Commits)

```
feat(scope): description
fix(scope): description
chore(scope): description
docs(scope): description
refactor(scope): description
```

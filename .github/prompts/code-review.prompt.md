---
mode: ask
description: Generate structured code review feedback for a NotiLab PR
tools: [codebase]
---

You are reviewing a pull request for **NotiLab**. Provide structured, actionable feedback following the project conventions.

## Review Criteria

### Code Quality
- TypeScript strict compliance (no `any`, explicit return types)
- Follows naming conventions (PascalCase components, camelCase utils, kebab-case files)
- No `console.log` statements left in production code
- Functions are focused and under 50 lines

### Architecture
- Components in `components/`, utilities in `lib/`, API handlers in `app/api/`
- No business logic in route handlers — delegate to `lib/`
- DB access only through `lib/prisma.ts`

### Security
- User input validated at API boundaries
- No secrets in client-accessible code
- Auth checks on protected routes

### Performance
- Server components used by default (not over-using `'use client'`)
- No unnecessary re-renders or missing `useMemo`/`useCallback`
- Images optimized with `next/image`

## Response Format

```markdown
## Code Review

### Must Fix 🔴
- ...

### Should Fix 🟡
- ...

### Consider 🟢
- ...

### Looks Good 👍
- ...
```

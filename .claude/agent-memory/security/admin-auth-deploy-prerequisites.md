---
name: admin-auth-deploy-prerequisites
description: The admin auth hardening (2026-09-04) needs JWT_SECRET set in Vercel and an admin provisioned BEFORE it ships, or the console is totally locked out
metadata:
  type: project
---

The admin auth Critical fix removed the `"your-secret-key"` JWT fallback and the three
hardcoded accounts (all sharing the published bcrypt vector for the password
`password`). Consequence: the deploy has a hard ordering dependency.

Two prerequisites, both the user's to perform, in this order:

1. Set `JWT_SECRET` (>= 32 chars, `openssl rand -hex 32`) wherever the app runs.
   Until then `checkAdminAuth()` returns null for everyone, all six admin pages
   redirect to login, the four admin API routes 401, and the login route answers 503.
2. Create an admin account: `pnpm admin:provision --email <addr> --role SUPER_ADMIN
   --confirm-production-write`. Nothing in `prisma/seed.ts` ever creates a user with a
   password hash, so without this there is no account to log in as.

**Why:** Deploying the hardening before step 1 is a total admin outage, and before
step 2 there is no way back in even with a correct secret. The old hashes are
permanently public - treat admin@notilab.com, redator@notilab.com and
revisor@notilab.com as compromised regardless of what happens to them next.

**How to apply:** Before suggesting this branch ship, confirm both prerequisites are
done. Never run the provisioning script on the user's behalf - it writes to the shared
production Neon instance (see the user-level memory on local .env writes hitting prod).
Interim accepted risk: admin routes still do a bare null check with no role gating, so
any admin-role token has SUPER_ADMIN reach. The mitigation is operational - provision
exactly one SUPER_ADMIN. Real RBAC across the ten call sites is deferred and owned by
02-editorial-content, since which role may do what is a business call.

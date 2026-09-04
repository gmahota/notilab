# NotiLab - Deployment Guide

## Prerequisites

### Development Environment
\`\`\`bash
Node.js >= 18.0.0
npm >= 9.0.0
PostgreSQL >= 14.0
Redis >= 6.0 (optional)
\`\`\`

### Environment Variables
\`\`\`env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/notilab"

# Authentication
# JWT_SECRET is MANDATORY and has no fallback: with it unset, blank, or shorter
# than 32 characters, no admin session can be signed or verified — /api/admin/auth
# answers 503 and every admin page redirects to the login screen. Generate one:
#   openssl rand -hex 32
JWT_SECRET="<strong-random-secret, minimum 32 characters>"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# AI Services (optional)
OPENAI_API_KEY="sk-..."
GROQ_API_KEY="gsk_..."

# Email (optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Social Media APIs (optional)
TWITTER_API_KEY="..."
FACEBOOK_API_KEY="..."

# Agent Management API (optional — see docs/agent-api.md)
# With no key configured, /api/agent/* responds AGENT_API_DISABLED.
# Minimum 32 characters:  openssl rand -hex 32
NOTILAB_AGENT_API_KEY="..."
NOTILAB_AGENT_ID="abacus"
NOTILAB_AGENT_PERMISSIONS="readonly"   # readonly | editorial | seo | list of permissions
\`\`\`

## Local Installation

### 1. Clone and Install
\`\`\`bash
git clone <repository-url>
cd notilab
npm install
\`\`\`

### 2. Configure the Database
\`\`\`bash
# Generate the Prisma client
npx prisma generate

# Run migrations
npx prisma db push

# Initial seed (optional)
npm run seed
\`\`\`

### 3. Run the Project
\`\`\`bash
# Development
npm run dev

# Production
npm run build
npm start
\`\`\`

## Deploying to Vercel

### 1. Automatic Configuration
\`\`\`bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
\`\`\`

### 2. Configure Variables
In the Vercel dashboard:
- Settings → Environment Variables
- Add all the variables from `.env.example`

Required in **Production** — without them, parts of the system fail silently:

| Variable | Without it |
|---|---|
| `DATABASE_URL` | the site won't boot |
| `CRON_SECRET` | the six cron routes return 500 and nothing gets ingested |
| `GNEWS_API_KEY` / `NEWSAPI_KEY` | the providers return `[]` and ingestion ends with `fetched: 0` with no error |
| `OPENAI_API_KEY` or `GROQ_API_KEY` | AI enrichment fails article by article |
| `NEXT_PUBLIC_BASE_URL` | *optional* — see the note below; without it the origin comes from Vercel's system variable |

New variables only take effect in new builds: **after adding them, a redeploy is required**.

#### Agent Management API (external agents)

Optional and **disabled by default**. Without `NOTILAB_AGENT_API_KEY` (or
`NOTILAB_AGENT_API_KEYS`), all `/api/agent/*` endpoints respond
`AGENT_API_DISABLED` — a deployment nobody handed a credential to is not operable.

| Variable | Default | Purpose |
|---|---|---|
| `NOTILAB_AGENT_API_KEY` | — | agent key. Minimum 32 characters |
| `NOTILAB_AGENT_ID` | `default` | identity in audit lines (`agent:<id>`) |
| `NOTILAB_AGENT_PERMISSIONS` | `readonly` | `readonly`, `editorial`, `seo`, or a list of permissions |
| `NOTILAB_AGENT_API_KEYS` | — | JSON array, for multiple agents with different permissions |
| `NOTILAB_AGENT_RATE_LIMIT` | `120` | requests per window, per agent |
| `NOTILAB_AGENT_RATE_WINDOW_MS` | `60000` | window duration |
| `NOTILAB_AGENT_CONFIRMATION_SECRET` | constant | HMAC key for human confirmation tokens |

None of these are `NEXT_PUBLIC_*`, so none of them reach the browser bundle. Omitting
`NOTILAB_AGENT_PERMISSIONS` grants **less**, never more: an oversight
leaves the agent read-only.

Full contract, tools, error codes, and audit: `docs/agent-api.md`.

#### The public origin (share links, referral, digest)

Resolved in a single place, `lib/base-url.ts`, in this order: `NEXT_PUBLIC_BASE_URL` →
`NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → fallback.
The middle two are
[system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
that Vercel sets on its own, as long as **Enable access to System Environment Variables**
is active in Settings → Environment Variables. They contain the project's production
domain (the shortest custom domain, or the `.vercel.app` one if there isn't one) and **not**
`VERCEL_URL`, which is that deployment's URL and changes on every deploy.

Setting `NEXT_PUBLIC_BASE_URL` by hand is only necessary outside Vercel (the manual VPS
deploy further below) or to force a domain different from the production one. Since any
`NEXT_PUBLIC_*` is inlined into the bundle at build time, changing it requires a new build — a
redeploy of the previous build won't pick it up.

### 3. Configure the Database
Recommended: **Neon** or **Supabase**
- Create a PostgreSQL database
- Copy the connection string
- Add it as `DATABASE_URL`

### 4. Cron Jobs

The six cron routes are declared in `vercel.json`. Two points that aren't obvious:

**Crons only exist if `vercel.json` is present in the production deployment.** There's nothing
to configure in the dashboard — Vercel reads the list from the file on every production deploy. An
older deployment that lacks `vercel.json` runs with zero registered crons.

**`CRON_SECRET` is required.** All routes under `app/api/cron/*` return 500 without it
(see `app/api/cron/sync-news/route.ts`). Set it in Settings → Environment Variables; Vercel
automatically injects `Authorization: Bearer $CRON_SECRET` on the invocations.

**Each route declares `maxDuration = 60`.** The default function limit is short and
`sync-news` spends ~11s just waiting between provider queries; without this the execution is
killed midway and nothing is persisted. 60s is the ceiling on the Hobby plan.

#### Schedules and the Hobby plan limit

The Hobby plan accepts at most **one run per day** per cron, with ±59 min precision
([docs](https://vercel.com/docs/cron-jobs/usage-and-pricing)). Sub-daily expressions like
`*/30 * * * *` **fail the deployment**, they aren't simply ignored.

The steps are chained (`sync → AI → ranking → digest → send`), and with ±59 min of
imprecision a short interval doesn't guarantee ordering: a step scheduled for 06:00 might
fire at 06:59, and the next one scheduled for 06:30 might fire at 06:30, out of order.
Hence the **2h intervals** — in the worst case there's ~1h left between the end of one step and the start of the
next. Times are UTC and work backward from the digest send, to
arrive in the morning in Maputo (UTC+2):

| Cron | UTC | Maputo | Why |
|---|---|---|---|
| `sync-news` | 20:00 | 22:00 | previous night's ingestion; 12 GNews requests/day, within the free tier |
| `process-ai-news` | 22:00 | 00:00 | enriches what sync brought in |
| `recalculate-ranking` | 00:00 | 02:00 | needs the AI importance scores |
| `generate-digest` | 02:00 | 04:00 | builds the edition from the ranked feed |
| `send-digest` | 05:00 | 07:00 | morning delivery |
| `send-messaging` | 07:00 | 09:00 | WhatsApp/Telegram after email |

#### `publish-scheduled` — exists, but is not registered

`app/api/cron/publish-scheduled/route.ts` fulfills the schedules created by
the Agent Management API (`schedule_article`). **It is deliberately left out of
`vercel.json`.** The other six routes read, enrich, or send; this one puts
news on the public site without anyone reviewing it, which is the central risk identified
in `AGENTS.md`. Turning on that automation is an operational decision, made once and
deliberately — not a side effect of a commit.

While it isn't registered, a schedule is a recorded intent that nothing
executes (the tool's own description warns the agent of this).

To turn it on — mind the Hobby 1×/day ceiling described above:

```json
{ "path": "/api/cron/publish-scheduled", "schedule": "0 8 * * *" }
```

It publishes only articles already `APPROVED`, applies the same review gate as
any other caller, closes each schedule (fulfilled or failed), and writes
an audit entry attributed to `system:cron`.

**Consequence to accept:** on Hobby, site content is only updated 1× per day. For
the 15–30 min freshness the product assumes, you need to move to Pro (which allows
minute-level scheduling) or trigger the routes from an external scheduler — a scheduled
GitHub Actions workflow calling the endpoints with `CRON_SECRET` works around the limit without changing plans.

## Manual Deploy (VPS/Server)

### 1. Prepare the Server
\`\`\`bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm postgresql nginx

# Configure PostgreSQL
sudo -u postgres createdb notilab
sudo -u postgres createuser notilab_user
\`\`\`

### 2. Deploy the Application
\`\`\`bash
# Clone the repository
git clone <repository-url>
cd notilab

# Install dependencies
npm ci --production

# Build the application
npm run build

# Configure PM2 (optional)
npm install -g pm2
pm2 start npm --name "notilab" -- start
\`\`\`

### 3. Configure Nginx
\`\`\`nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
\`\`\`

## Production Settings

### Performance
\`\`\`javascript
// next.config.mjs
export default {
  experimental: {
    serverComponentsExternalPackages: ['prisma']
  },
  images: {
    domains: ['your-domain.com'],
    formats: ['image/webp', 'image/avif']
  }
}
\`\`\`

### Security
\`\`\`env
# Production
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
JWT_SECRET=<strong-random-secret>
\`\`\`

#### First administrator

There are no default staff accounts. After `JWT_SECRET` is set, create one explicitly —
the script prints its plan and writes nothing without `--apply`:

\`\`\`bash
NOTILAB_ADMIN_EMAIL=you@example.com \
NOTILAB_ADMIN_PASSWORD='<a long random password>' \
NOTILAB_ADMIN_ROLE=SUPER_ADMIN \
pnpm admin:provision --apply
\`\`\`

Order matters: with no secret, a correct login still cannot be issued a session; with no
account, a correct secret has nobody to sign in as. See ADMIN_GUIDE.md § Credentials.

## Monitoring

### Health Checks
- **Endpoint**: `/api/health`
- **Status**: 200 = OK, 500 = Error
- **Metrics**: Database, Redis, APIs

### Logs
\`\`\`bash
# PM2 logs
pm2 logs notilab

# Vercel logs
vercel logs

# Docker logs
docker logs notilab-container
\`\`\`

## Backup and Recovery

### Database
\`\`\`bash
# Backup
pg_dump notilab > backup_$(date +%Y%m%d).sql

# Restore
psql notilab < backup_20240115.sql
\`\`\`

### Files
\`\`\`bash
# Backup uploads
tar -czf uploads_backup.tar.gz public/uploads/

# Restore
tar -xzf uploads_backup.tar.gz
\`\`\`

## Troubleshooting

### Common Issues
1. **Build fails**: Check the Node.js version
2. **Database error**: Check the connection string
3. **404 in production**: Check the build output
4. **Slow performance**: Check database indexes

### Debug
\`\`\`bash
# Detailed logs
DEBUG=* npm run dev

# Check the build
npm run build
npm run start

# Test database
npx prisma studio

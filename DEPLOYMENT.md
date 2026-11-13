# NotiLab — Deployment Guide

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
JWT_SECRET="your-super-secret-jwt-key-here"
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
NOTILAB_AGENT_PERMISSIONS="readonly"   # readonly | editorial | seo | permission list
\`\`\`

> ⚠️ `JWT_SECRET` is not optional in practice. `lib/admin-auth.ts` currently falls back to the literal `"your-secret-key"` when it is unset, which means any deployment missing this variable signs and accepts admin tokens that anyone can forge. Tracked as **ROADMAP #23**; until that lands, treat setting `JWT_SECRET` to a strong random value as mandatory in every environment.

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

### 1. Automatic Setup
\`\`\`bash
# Install the Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
\`\`\`

### 2. Configure Variables
In the Vercel dashboard:
- Settings → Environment Variables
- Add every variable from `.env.example`

Required in **Production** — without them, parts of the system fail silently:

| Variable | Without it |
|---|---|
| `DATABASE_URL` | the site does not start |
| `CRON_SECRET` | the six cron routes return 500 and nothing is ingested |
| `GNEWS_API_KEY` / `NEWSAPI_KEY` | the providers return `[]` and ingestion ends with `fetched: 0` and no error |
| `OPENAI_API_KEY` or `GROQ_API_KEY` | AI enrichment fails article by article |
| `NEXT_PUBLIC_BASE_URL` | *optional* — see the note below; without it the origin comes from Vercel's system variable |

New variables only take effect in new builds: **after adding them you need a redeploy**.

#### Agent Management API (external agents)

Optional and **off by default**. Without `NOTILAB_AGENT_API_KEY` (or `NOTILAB_AGENT_API_KEYS`), every `/api/agent/*` endpoint responds `AGENT_API_DISABLED` — a deployment nobody gave a credential to is not operable.

| Variable | Default | Purpose |
|---|---|---|
| `NOTILAB_AGENT_API_KEY` | — | the agent's key. Minimum 32 characters |
| `NOTILAB_AGENT_ID` | `default` | identity in audit rows (`agent:<id>`) |
| `NOTILAB_AGENT_PERMISSIONS` | `readonly` | `readonly`, `editorial`, `seo`, or a permission list |
| `NOTILAB_AGENT_API_KEYS` | — | JSON array, for several agents with different permissions |
| `NOTILAB_AGENT_RATE_LIMIT` | `120` | requests per window, per agent |
| `NOTILAB_AGENT_RATE_WINDOW_MS` | `60000` | window duration |
| `NOTILAB_AGENT_CONFIRMATION_SECRET` | constant | HMAC key for human-confirmation tokens |

None is `NEXT_PUBLIC_*`, so none reaches the browser bundle. Omitting `NOTILAB_AGENT_PERMISSIONS` grants **less**, never more: forgetting it leaves the agent read-only.

Full contract, tools, error codes and auditing: `docs/agent-api.md`.

#### The public origin (share links, referral, digest)

Resolved in a single place, `lib/base-url.ts`, in this order: `NEXT_PUBLIC_BASE_URL` → `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → fallback. The middle two are [system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables) that Vercel sets on its own, provided **Enable access to System Environment Variables** is active under Settings → Environment Variables. They hold the project's *production* domain (the shortest custom domain, or the `.vercel.app` one if there is none) and **not** `VERCEL_URL`, which is the URL of that particular deployment and changes on every deploy.

Setting `NEXT_PUBLIC_BASE_URL` by hand is only necessary off Vercel (the manual VPS deploy further down) or to force a domain other than production. Since any `NEXT_PUBLIC_*` is inlined into the bundle at build time, changing it requires a fresh build — redeploying the previous build will not pick it up.

### 3. Configure the Database
Recommended: **Neon** or **Supabase**
- Create a PostgreSQL database
- Copy the connection string
- Add it as `DATABASE_URL`

### 4. Cron Jobs

The six cron routes are declared in `vercel.json`. Two points that are not obvious:

**The crons only exist if `vercel.json` is in the production deployment.** There is nothing to configure in the dashboard — Vercel reads the list from the file on each production deploy. An older deployment without `vercel.json` runs with zero crons registered.

**`CRON_SECRET` is mandatory.** Every route under `app/api/cron/*` returns 500 without it (see `app/api/cron/sync-news/route.ts`). Set it in Settings → Environment Variables; Vercel automatically injects `Authorization: Bearer $CRON_SECRET` into the invocations.

**Each route declares `maxDuration = 60`.** The default function limit is short and `sync-news` spends ~11s just waiting between provider queries; without this the execution is killed mid-run and nothing is persisted. 60s is the ceiling on the Hobby plan.

#### Cadences and the Hobby plan limit

The Hobby plan accepts at most **one execution per day** per cron, with ±59 min precision ([docs](https://vercel.com/docs/cron-jobs/usage-and-pricing)). Sub-daily expressions such as `*/30 * * * *` **fail the deployment**; they are not merely ignored.

The stages are chained (`sync → AI → ranking → digest → send`), and with ±59 min of imprecision a short interval does not guarantee ordering: a stage scheduled for 06:00 may fire at 06:59 while the next one scheduled for 06:30 fires at 06:30, out of order. Hence the **2h intervals** — in the worst case about 1h remains between the end of one stage and the start of the next. Times are UTC and work backwards from the digest send, so it arrives in the morning in Maputo (UTC+2):

| Cron | UTC | Maputo | Why |
|---|---|---|---|
| `sync-news` | 20:00 | 22:00 | previous night's ingestion; 12 GNews requests/day, within the free tier |
| `process-ai-news` | 22:00 | 00:00 | enriches whatever the sync brought in |
| `recalculate-ranking` | 00:00 | 02:00 | needs the AI importance scores |
| `generate-digest` | 02:00 | 04:00 | assembles the edition from the ranked feed |
| `send-digest` | 05:00 | 07:00 | morning delivery |
| `send-messaging` | 07:00 | 09:00 | WhatsApp/Telegram after the email |

#### `publish-scheduled` — it exists, but it is not registered

`app/api/cron/publish-scheduled/route.ts` fulfils the schedules created by the Agent Management API (`schedule_article`). It is **deliberately left out of `vercel.json`.** The other six routes read, enrich or send; this one puts articles on the public site with nobody watching, which is the central risk identified in `AGENTS.md`. Enabling that automation is an operational decision, taken once and consciously — not a side effect of a commit.

While it is unregistered, a schedule is recorded intent that nothing executes (the tool's own description warns the agent of this).

To enable it — mind the 1×/day Hobby ceiling described above:

```json
{ "path": "/api/cron/publish-scheduled", "schedule": "0 8 * * *" }
```

It publishes only articles already `APPROVED`, applies the same review gate as any other caller, closes each schedule (fulfilled or failed) and writes audit rows attributed to `system:cron`.

**A consequence to accept:** on Hobby the site's content is only updated once a day. For the 15–30 min freshness the product assumes, you need to move to Pro (which allows per-minute cadence) or trigger the routes from an external scheduler — a scheduled GitHub Actions workflow calling the endpoints with `CRON_SECRET` works around the limit without changing plan.

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

## Production Configuration

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

### Common Problems
1. **Build fails**: check the Node.js version
2. **Database error**: check the connection string
3. **404 in production**: check the build output
4. **Slow performance**: check the database indexes

### Debug
\`\`\`bash
# Verbose logs
DEBUG=* npm run dev

# Check the build
npm run build
npm run start

# Test the database
npx prisma studio
\`\`\`

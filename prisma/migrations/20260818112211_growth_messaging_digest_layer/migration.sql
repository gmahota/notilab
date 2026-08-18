-- Baseline catch-up migration.
--
-- Everything below already existed in prisma/schema.prisma but had no
-- migration: the schema was evolved with `prisma db push` (see package.json
-- `db:push`) instead of `prisma migrate dev`, so `_prisma_migrations` stopped
-- at 20260321193926_init while the models kept growing. Generated with
-- `prisma migrate diff` from the schema as of the init migration to HEAD, so it
-- contains no hand-written SQL.
--
-- IMPORTANT — environments that were already `db push`-ed (the Neon dev branch
-- has all 28 tables) will fail here with "relation already exists". Mark it as
-- applied there instead of running it:
--
--   pnpm exec prisma migrate resolve --applied 20260321193926_init  # if needed
--   pnpm exec prisma migrate resolve --applied <this migration name>
--
-- Only databases still at the init baseline should actually execute this.

-- AlterTable
ALTER TABLE "news" ADD COLUMN     "rankingScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "article_ai" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "shareText" TEXT;

-- CreateTable
CREATE TABLE "digest_issues" (
    "id" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "articleIds" TEXT[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digest_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digest_deliveries" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digest_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_subscriptions" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "categories" TEXT[],
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_deliveries" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "articleIds" TEXT[],
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "telegramMsgId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messaging_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_streaks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3),
    "streakFrozenUntil" TIMESTAMP(3),
    "totalDaysActive" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_streaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "event" TEXT NOT NULL,
    "articleId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "articleId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "snippet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_shares" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "sharedByUserId" TEXT,
    "channel" TEXT NOT NULL,
    "snippet" TEXT,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "newUserCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_visits" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "visitorUserId" TEXT,
    "isNewUser" BOOLEAN NOT NULL DEFAULT false,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "channelId" TEXT,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "articleIds" TEXT[],
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_experiments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "variants" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiment_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "digest_deliveries_issueId_email_key" ON "digest_deliveries"("issueId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "messaging_subscriptions_channel_channelId_key" ON "messaging_subscriptions"("channel", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "user_streaks_userId_key" ON "user_streaks"("userId");

-- CreateIndex
CREATE INDEX "user_events_userId_event_idx" ON "user_events"("userId", "event");

-- CreateIndex
CREATE INDEX "user_events_event_createdAt_idx" ON "user_events"("event", "createdAt");

-- CreateIndex
CREATE INDEX "share_history_articleId_idx" ON "share_history"("articleId");

-- CreateIndex
CREATE INDEX "share_history_userId_idx" ON "share_history"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "article_shares_code_key" ON "article_shares"("code");

-- CreateIndex
CREATE INDEX "article_shares_articleId_idx" ON "article_shares"("articleId");

-- CreateIndex
CREATE INDEX "article_shares_sharedByUserId_idx" ON "article_shares"("sharedByUserId");

-- CreateIndex
CREATE INDEX "share_visits_shareId_idx" ON "share_visits"("shareId");

-- CreateIndex
CREATE INDEX "share_visits_visitorUserId_idx" ON "share_visits"("visitorUserId");

-- CreateIndex
CREATE INDEX "notification_logs_userId_type_idx" ON "notification_logs"("userId", "type");

-- CreateIndex
CREATE INDEX "notification_logs_sentAt_idx" ON "notification_logs"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "growth_experiments_name_key" ON "growth_experiments"("name");

-- CreateIndex
CREATE INDEX "experiment_assignments_userId_idx" ON "experiment_assignments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "experiment_assignments_userId_experimentId_key" ON "experiment_assignments"("userId", "experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "news_sourceUrl_key" ON "news"("sourceUrl");

-- AddForeignKey
ALTER TABLE "digest_deliveries" ADD CONSTRAINT "digest_deliveries_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "digest_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_subscriptions" ADD CONSTRAINT "messaging_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_deliveries" ADD CONSTRAINT "messaging_deliveries_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "messaging_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_visits" ADD CONSTRAINT "share_visits_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "article_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "growth_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;


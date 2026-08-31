-- NOW V2 Story layer (see docs/memory/database.md § Story layer).
--
-- Additive only: creates two enums and five tables, and adds two nullable
-- columns (news.storyId, user_events.storyId). Nothing is dropped, nothing
-- existing becomes NOT NULL, so no existing row is invalidated and the
-- pre-V2 code keeps working against the same database after it is applied.

-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('DEVELOPING', 'CONFIRMED', 'UPDATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "StorySourceType" AS ENUM ('NEWS', 'OFFICIAL', 'DOCUMENT', 'SOCIAL');

-- AlterTable
ALTER TABLE "news" ADD COLUMN     "storyId" TEXT;

-- AlterTable
ALTER TABLE "user_events" ADD COLUMN     "storyId" TEXT;

-- CreateTable
CREATE TABLE "stories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "whyItMatters" TEXT,
    "narrative" TEXT,
    "context" TEXT,
    "whatsNext" TEXT,
    "categoryId" TEXT NOT NULL,
    "location" TEXT,
    "topics" TEXT[],
    "status" "StoryStatus" NOT NULL DEFAULT 'DEVELOPING',
    "importanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "heroImageUrl" TEXT,
    "heroMediaType" TEXT,
    "heroCredit" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_sources" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "newsId" TEXT,
    "publisher" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "sourceType" "StorySourceType" NOT NULL DEFAULT 'NEWS',
    "reliabilityScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_key_facts" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "context" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "story_key_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_entities" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,

    CONSTRAINT "story_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_timeline_items" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "story_timeline_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stories_slug_key" ON "stories"("slug");

-- CreateIndex
CREATE INDEX "stories_status_publishedAt_idx" ON "stories"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "stories_categoryId_publishedAt_idx" ON "stories"("categoryId", "publishedAt");

-- CreateIndex
CREATE INDEX "stories_importanceScore_idx" ON "stories"("importanceScore");

-- CreateIndex
CREATE INDEX "story_sources_storyId_idx" ON "story_sources"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "story_sources_storyId_url_key" ON "story_sources"("storyId", "url");

-- CreateIndex
CREATE INDEX "story_key_facts_storyId_position_idx" ON "story_key_facts"("storyId", "position");

-- CreateIndex
CREATE INDEX "story_entities_normalized_idx" ON "story_entities"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "story_entities_storyId_normalized_key" ON "story_entities"("storyId", "normalized");

-- CreateIndex
CREATE INDEX "story_timeline_items_storyId_occurredAt_idx" ON "story_timeline_items"("storyId", "occurredAt");

-- CreateIndex
CREATE INDEX "news_storyId_idx" ON "news"("storyId");

-- CreateIndex
CREATE INDEX "user_events_storyId_event_idx" ON "user_events"("storyId", "event");

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_sources" ADD CONSTRAINT "story_sources_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_sources" ADD CONSTRAINT "story_sources_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "news"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_key_facts" ADD CONSTRAINT "story_key_facts_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_entities" ADD CONSTRAINT "story_entities_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_timeline_items" ADD CONSTRAINT "story_timeline_items_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;


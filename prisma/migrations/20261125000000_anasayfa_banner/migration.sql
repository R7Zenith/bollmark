-- Anasayfa banner yonetimi (yalniz ekleme). Plan: docs/planlar/ANASAYFA_BANNER_YONETIMI_PLANI.md
-- AlterTable
ALTER TABLE "EfsaneCumaSettings" ADD COLUMN     "homeBand" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "HomeSlide" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'IMAGE_ONLY',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "desktopImageUrl" TEXT NOT NULL DEFAULT '',
    "mobileImageUrl" TEXT,
    "desktopFocus" TEXT NOT NULL DEFAULT '50% 50%',
    "mobileFocus" TEXT NOT NULL DEFAULT '50% 50%',
    "altText" TEXT NOT NULL DEFAULT '',
    "href" TEXT,
    "eyebrow" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "buttonLabel" TEXT,
    "textAlign" TEXT NOT NULL DEFAULT 'LEFT',
    "textTone" TEXT NOT NULL DEFAULT 'LIGHT',
    "overlay" TEXT NOT NULL DEFAULT 'NONE',
    "showCountdown" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByEmail" TEXT,

    CONSTRAINT "HomeSlide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeSlide_sortOrder_idx" ON "HomeSlide"("sortOrder");


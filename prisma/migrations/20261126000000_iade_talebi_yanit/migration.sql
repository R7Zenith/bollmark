-- Iade talebi musteri yaniti (yalniz ekleme). Plan: docs/planlar/IADE_TALEBI_SISTEMI_PLANI.md 4.1
-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "customerReply" TEXT,
ADD COLUMN     "customerReplyAt" TIMESTAMP(3);

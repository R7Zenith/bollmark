-- Efsane Cuma sepet kampanyasi (yalniz ekleme, kullanici onayli 2026-11-23).
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "campaignDiscountCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "campaignLabel" TEXT,
ADD COLUMN     "campaignOriginalUnitCents" INTEGER;

-- CreateTable
CREATE TABLE "EfsaneCumaSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "kalpPause" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "updatedByEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EfsaneCumaSettings_pkey" PRIMARY KEY ("id")
);


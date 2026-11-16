-- HepsiJET entegrasyonu (docs/planlar/HEPSIJET_ENTEGRASYON_PLANI.md bolum 4).
-- Yalniz eklemeli, nullable sutunlar; mevcut kayitlar degismez.
ALTER TABLE "Shipment" ADD COLUMN     "hjCancelledAt" TIMESTAMP(3),
ADD COLUMN     "hjLastError" TEXT,
ADD COLUMN     "hjLastSyncAt" TIMESTAMP(3),
ADD COLUMN     "hjSentAt" TIMESTAMP(3),
ADD COLUMN     "hjStatus" TEXT,
ADD COLUMN     "hjStatusMessage" TEXT;

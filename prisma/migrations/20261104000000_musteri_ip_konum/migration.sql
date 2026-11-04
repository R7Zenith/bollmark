-- Musteri detay sayfasi: siparis ve giris/kayit IP + konum (yalniz ekleme).
-- AlterTable
ALTER TABLE "Order" ADD COLUMN "clientIp" TEXT,
ADD COLUMN "ipCity" TEXT,
ADD COLUMN "ipRegion" TEXT,
ADD COLUMN "ipCountry" TEXT;

-- AlterTable
ALTER TABLE "CustomerDevice" ADD COLUMN "ip" TEXT,
ADD COLUMN "ipCity" TEXT,
ADD COLUMN "ipRegion" TEXT,
ADD COLUMN "ipCountry" TEXT;

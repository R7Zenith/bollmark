import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { ClientIpInfo } from "@/lib/client-ip";

// Kotuye kullanim kontrolu icin cihaz ve IP gorulmeleri (KALP_TOPLA_PLANI.md
// 5.4, Y2, Y3). bm_cihaz: birinci taraf, islevsel, rastgele kimlik, 1 yil.
// Eslesme kontrolleri yalniz DEVICE_IP_SALT ile tuzlanmis SHA-256 ozetini
// kullanir; ham IP ve konum yalniz admin musteri detayinda gosterilir.
export const DEVICE_COOKIE = "bm_cihaz";

export const DEVICE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365
};

const DEVICE_ID_PATTERN = /^[0-9a-f-]{36}$/;

// Cerezdeki kimlik gecerliyse onu, degilse yeni bir kimlik dondurur.
export function resolveDeviceId(cookieValue: string | undefined): { deviceId: string; isNew: boolean } {
  if (cookieValue && DEVICE_ID_PATTERN.test(cookieValue)) return { deviceId: cookieValue, isNew: false };
  return { deviceId: randomUUID(), isNew: true };
}

export function hashIp(ip: string | null, salt = process.env.DEVICE_IP_SALT): string | null {
  if (!ip || !salt) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

// Best-effort: kayit/giris islemini asla engellemez (Y2: cihaz/IP kurallari
// uyeligi engellemez).
export async function recordDevice(params: {
  customerId: string;
  deviceId: string;
  ip: string | null;
  ipInfo: ClientIpInfo;
  event: "SIGNUP" | "LOGIN";
}) {
  const { ipInfo } = params;
  await prisma.customerDevice
    .create({
      data: {
        customerId: params.customerId,
        deviceId: params.deviceId,
        ipHash: hashIp(params.ip),
        ip: ipInfo.ip,
        ipCity: ipInfo.city,
        ipRegion: ipInfo.region,
        ipCountry: ipInfo.country,
        event: params.event
      }
    })
    .catch((e) => console.error("Cihaz kaydı yazılamadı (yoksayıldı):", e));
}

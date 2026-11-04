import { headers as requestHeaders } from "next/headers";
import { geolocation, ipAddress } from "@vercel/functions";

export interface ClientIpInfo {
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
}

// Istemci IP'si ve Vercel konum basliklari (x-vercel-ip-city/-country-region/
// -country). IP: x-real-ip, yoksa x-forwarded-for'un ilk degeri. Sehir adi
// geolocation() icinde decodeURIComponent ile cozulur. Localhost'ta konum
// basliklari gelmez, alanlar null kalir. Basliklar verilmezse next/headers.
export async function getClientIpInfo(source?: Headers): Promise<ClientIpInfo> {
  const headers = source ?? (await requestHeaders());
  const geo = geolocation({ headers });
  const ip = ipAddress(headers)?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  return { ip, city: geo.city ?? null, region: geo.countryRegion ?? null, country: geo.country ?? null };
}

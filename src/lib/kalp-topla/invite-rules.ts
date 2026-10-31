// Davetin saf kurallari (KALP_TOPLA_PLANI.md 5.5, T8, Y2). Istemci de kullanir:
// prisma ya da sunucu modulu import edilmez.
import { BONUS_WAITING_DAYS } from "./bonus";

export const INVITE_COOKIE = "bm_davet";
const INVITE_COOKIE_DAYS = 7;

// Form gizli alan olarak okuyabilsin diye httpOnly degil (T8). Icerik yalniz kod
// ve urun kimligidir; sunucu ikisini de kayitta ve dogrulamada yeniden kontrol eder.
export const INVITE_COOKIE_OPTIONS = {
  httpOnly: false,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * INVITE_COOKIE_DAYS
};

const INVITE_VALUE_PATTERN = /^([2-9A-HJKMNP-Z]{8})(?:\.([A-Za-z0-9_-]{1,40}))?$/;

export function formatInviteValue(code: string, productId: string | null): string {
  return productId ? `${code}.${productId}` : code;
}

export function parseInviteValue(value: string | null | undefined): { code: string; productId: string | null } | null {
  const match = value ? INVITE_VALUE_PATTERN.exec(value) : null;
  return match ? { code: match[1], productId: match[2] ?? null } : null;
}

export type ReviewReason = "SAME_DEVICE" | "SAME_DEVICE_AS_INVITER";

// Y2: yalniz cihaz incelemeye dusurur; ayni IP burada yoktur, yalniz isarettir.
export function reviewReasons(input: {
  otherAccountsOnDevice: number;
  sameDeviceMaxAccounts: number;
  inviterSeenOnDevice: boolean;
}): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  if (input.otherAccountsOnDevice >= input.sameDeviceMaxAccounts) reasons.push("SAME_DEVICE");
  if (input.inviterSeenOnDevice) reasons.push("SAME_DEVICE_AS_INVITER");
  return reasons;
}

// Plan 8.1: davet edene yalniz kisaltilmis ad gosterilir ("A*** K.").
export function maskName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/).filter(Boolean);
  if (!first) return "Üye";
  const last = rest.at(-1);
  return `${first[0]}***${last ? ` ${last[0]}.` : ""}`;
}

// Kalplerim > davet gecmisi (plan 6.4).
export function inviteHistoryLabel(
  status: string,
  credits: { status: string; points: number }[]
): string {
  if (status === "PENDING_VERIFICATION") return "Doğrulama bekliyor";
  if (status === "UNDER_REVIEW") return "İncelemede";
  if (status === "CANCELLED") return "İptal";
  const sum = (...statuses: string[]) =>
    credits.filter((c) => statuses.includes(c.status)).reduce((total, c) => total + c.points, 0);
  const added = sum("APPLIED", "ROUND_CLOSED");
  const waiting = sum("WAITING");
  if (added > 0 && waiting > 0) return `+${added} eklendi, +${waiting} bekliyor`;
  if (added > 0) return `+${added} eklendi`;
  if (waiting > 0) return "Bekleyen bonus";
  if (sum("VOID_WITHDRAWN") > 0) return "Düştü";
  if (sum("EXPIRED") > 0) return "Süresi doldu";
  return "İptal";
}

export function inviteShareText(url: string): string {
  return `Bollmark'ta üye ol, beğendiğimiz ürünlerin indirimini birlikte açalım: ${url}`;
}

// Davet kutusu 3. adim (plan 5.6.1): bonus bu urune yalniz burada aktif kalp varsa gider.
export function inviteBonusStep(bonus: number, activeHeartHere: boolean): string {
  if (activeHeartHere) return `Bu ürünün barına +${bonus} kalp eklenir.`;
  return `+${bonus} kalp, dolmaya en yakın barına eklenir. Aktif kalbin yoksa ${BONUS_WAITING_DAYS} gün içinde vereceğin ilk kalbin barına eklenir.`;
}

// Yalniz resmi paylasim linki: kullanicinin kendi WhatsApp'ini acar.
export function whatsappShareUrl(url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(inviteShareText(url))}`;
}

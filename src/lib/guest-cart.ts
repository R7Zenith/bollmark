// Misafir sepeti kimligi (bkz. GuestCart modeli, api/sepet/misafir).
export const GUEST_CART_COOKIE = "bm_misafir";

export const GUEST_CART_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 90
};

const GUEST_ID_PATTERN = /^[0-9a-f-]{36}$/;

export function readGuestId(value: string | undefined): string | null {
  return value && GUEST_ID_PATTERN.test(value) ? value : null;
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { cancelCoupon, extendCoupon } from "@/lib/kalp-topla/admin-coupons";

function actor(session: Awaited<ReturnType<typeof requireAdmin>>) {
  return { actorEmail: session.user?.email ?? "", actorRole: session.user?.role ?? "ADMIN" };
}

function back(customerId: string, result: string): never {
  const page = `/admin/musteriler/${customerId}`;
  revalidatePath(page);
  redirect(`${page}?sonuc=${result}`);
}

export async function cancelCouponAction(formData: FormData) {
  const session = await requireAdmin();
  const customerId = String(formData.get("customerId") ?? "");
  const done = await cancelCoupon(String(formData.get("id") ?? ""), customerId, actor(session));
  back(customerId, done ? "iptal" : "degismis");
}

export async function extendCouponAction(formData: FormData) {
  const session = await requireAdmin();
  const customerId = String(formData.get("customerId") ?? "");
  const value = String(formData.get("expiresAt") ?? "");
  back(customerId, await extendCoupon(String(formData.get("id") ?? ""), customerId, value, actor(session)));
}

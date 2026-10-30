"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { approveInvite, cancelInvite } from "@/lib/kalp-topla/invite";

const PAGE = "/admin/kalp-topla/davetler";

function actor(session: Awaited<ReturnType<typeof requireAdmin>>) {
  return { actorEmail: session.user?.email ?? "", actorRole: session.user?.role ?? "ADMIN" };
}

function back(formData: FormData, result: string): never {
  const filtre = String(formData.get("filtre") ?? "");
  revalidatePath(PAGE);
  redirect(`${PAGE}?sonuc=${result}${filtre ? `&filtre=${encodeURIComponent(filtre)}` : ""}`);
}

export async function approveInviteAction(formData: FormData) {
  const session = await requireAdmin();
  const done = await approveInvite(String(formData.get("id") ?? ""), actor(session));
  back(formData, done ? "onaylandi" : "degismis");
}

export async function cancelInviteAction(formData: FormData) {
  const session = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  const done = await cancelInvite(String(formData.get("id") ?? ""), note, actor(session));
  back(formData, done ? "iptal" : "degismis");
}

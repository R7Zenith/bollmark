import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import Link from "next/link";
import { Info } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/admin/card";
import { SettingsFeedback } from "@/components/admin/settings-feedback";

async function changePassword(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/admin/login");

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  const user = await prisma.adminUser.findUnique({ where: { email: session!.user!.email! } });
  if (!user) redirect("/admin/ayarlar?hata=kullanici-bulunamadi");

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) redirect("/admin/ayarlar?hata=mevcut-sifre-yanlis");
  if (newPassword.length < 8) redirect("/admin/ayarlar?hata=sifre-kisa");
  if (newPassword !== confirmPassword) redirect("/admin/ayarlar?hata=sifre-eslesmiyor");

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.adminUser.update({ where: { id: user.id }, data: { passwordHash } });
  redirect("/admin/ayarlar?basarili=hesap");
}

async function updateStoreSettings(formData: FormData) {
  "use server";
  const storeName = String(formData.get("storeName") || "").trim();
  const contactEmail = String(formData.get("contactEmail") || "").trim();
  const contactPhone = String(formData.get("contactPhone") || "").trim();
  const defaultShippingCents = Math.round(Number(formData.get("defaultShipping") || 0) * 100);

  await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", storeName, contactEmail, contactPhone, defaultShippingCents },
    update: { storeName, contactEmail, contactPhone, defaultShippingCents }
  });

  revalidatePath("/admin/ayarlar");
  redirect("/admin/ayarlar?basarili=magaza");
}

async function updateAbandonedCartSettings(formData: FormData) {
  "use server";
  const abandonedCartReminderEnabled = formData.get("abandonedCartReminderEnabled") === "on";
  const hoursRaw = Number(formData.get("abandonedCartReminderHours") || 1);
  const abandonedCartReminderHours = Math.min(72, Math.max(1, Math.round(hoursRaw) || 1));

  await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", abandonedCartReminderEnabled, abandonedCartReminderHours },
    update: { abandonedCartReminderEnabled, abandonedCartReminderHours }
  });

  revalidatePath("/admin/ayarlar");
  redirect("/admin/ayarlar?basarili=sepet-hatirlatma");
}

export default async function AdminSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  await requireAdmin();
  const { basarili, hata } = await searchParams;
  const session = await getServerSession(authOptions);

  const [adminUser, storeSettings] = await Promise.all([
    session?.user?.email
      ? prisma.adminUser.findUnique({ where: { email: session.user.email } })
      : Promise.resolve(null),
    prisma.storeSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {}
    })
  ]);

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold text-admin-text">Ayarlar</h1>

      <SettingsFeedback basarili={basarili} hata={hata} />

      <Card title="Hesap">
        <div className="mb-5 space-y-1 text-sm">
          <p className="text-admin-text">
            <span className="text-admin-text-muted">İsim: </span>
            {adminUser?.name}
          </p>
          <p className="text-admin-text">
            <span className="text-admin-text-muted">E-posta: </span>
            {adminUser?.email}
          </p>
        </div>

        <form action={changePassword} className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">Şifre Değiştir</p>
          <input
            name="currentPassword"
            type="password"
            required
            placeholder="Mevcut şifre"
            className="w-full rounded-md border border-admin-border px-4 py-2.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              name="newPassword"
              type="password"
              required
              minLength={8}
              placeholder="Yeni şifre (en az 8 karakter)"
              className="rounded-md border border-admin-border px-4 py-2.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
            />
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              placeholder="Yeni şifre (tekrar)"
              className="rounded-md border border-admin-border px-4 py-2.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
            />
          </div>
          <button className="rounded-md bg-admin-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
            Şifreyi Güncelle
          </button>
        </form>
      </Card>

      <Card title="Mağaza Bilgileri">
        <form action={updateStoreSettings} className="space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">
              Mağaza Adı
            </label>
            <input
              name="storeName"
              defaultValue={storeSettings.storeName}
              className="mt-1 w-full rounded-md border border-admin-border px-4 py-2.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">
                İletişim E-postası
              </label>
              <input
                name="contactEmail"
                type="email"
                defaultValue={storeSettings.contactEmail}
                className="mt-1 w-full rounded-md border border-admin-border px-4 py-2.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">
                İletişim Telefonu
              </label>
              <input
                name="contactPhone"
                defaultValue={storeSettings.contactPhone}
                className="mt-1 w-full rounded-md border border-admin-border px-4 py-2.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">
              Varsayılan Kargo Ücreti (TL)
            </label>
            <input
              name="defaultShipping"
              type="number"
              step="0.01"
              defaultValue={(storeSettings.defaultShippingCents / 100).toFixed(2)}
              className="mt-1 w-full max-w-[200px] rounded-md border border-admin-border px-4 py-2.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
            />
          </div>
          <button className="rounded-md bg-admin-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
            Mağaza Bilgilerini Kaydet
          </button>
        </form>
      </Card>

      <Card title="Terk Edilmiş Sepet Hatırlatması">
        <form action={updateAbandonedCartSettings} className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-admin-text">
            <input
              type="checkbox"
              name="abandonedCartReminderEnabled"
              defaultChecked={storeSettings.abandonedCartReminderEnabled}
              className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
            />
            Otomatik hatırlatma e-postası aktif
          </label>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">
              Sepet en az kaç saat boş kalınca hatırlatma gönderilsin
            </label>
            <input
              name="abandonedCartReminderHours"
              type="number"
              min={1}
              max={72}
              defaultValue={storeSettings.abandonedCartReminderHours}
              className="mt-1 w-full max-w-[160px] rounded-md border border-admin-border px-4 py-2.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
            />
          </div>
          <button className="rounded-md bg-admin-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
            Hatırlatma Ayarlarını Kaydet
          </button>
        </form>
        <div className="mt-4 flex gap-3 rounded-md bg-admin-bg p-4 text-sm text-admin-text-muted">
          <Info size={18} className="mt-0.5 flex-shrink-0 text-admin-accent" />
          <p>
            Bu kontrol günde 1 kez (saat 08:00&apos;de) otomatik çalışır, yani &quot;saat&quot; kesin bir gönderim
            zamanı değil, bir eşiktir. Terk edilmiş sepetleri tek tek görmek, istatistiklerini incelemek ve
            beklemeden elle hatırlatma göndermek için{" "}
            <Link href="/admin/terk-edilmis-sepetler" className="font-medium text-admin-accent hover:underline">
              Terk Edilmiş Sepetler
            </Link>{" "}
            sayfasına gidin.
          </p>
        </div>
      </Card>

      <Card title="Önizleme Şifresi">
        <div className="flex gap-3 rounded-md bg-admin-bg p-4 text-sm text-admin-text-muted">
          <Info size={18} className="mt-0.5 flex-shrink-0 text-admin-accent" />
          <p>
            Mağaza önizleme şifresi (<code className="rounded bg-white px-1 py-0.5">PREVIEW_PASSWORD</code>) bir
            Vercel ortam değişkenidir ve bu panelden görüntülenip değiştirilemez. Değiştirmek için Vercel
            dashboard&apos;undan Settings → Environment Variables kısmını kullanıp, ardından yeniden deploy
            tetiklemeniz gerekir.
          </p>
        </div>
      </Card>
    </div>
  );
}

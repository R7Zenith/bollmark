import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { adminRoleLabel, adminRoles, type AdminRole } from "@/lib/roles";
import { Card } from "@/components/admin/card";
import { PersonelRow } from "@/components/admin/personel-row";
import { PersonelFeedback } from "@/components/admin/personel-feedback";

const PATH = "/admin/personel";

async function createPersonel(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const roleRaw = String(formData.get("role") || "");
  const password = String(formData.get("password") || "");

  if (!name) redirect(`${PATH}?hata=isim-gerekli`);
  if (!email || !email.includes("@")) redirect(`${PATH}?hata=eposta-gerekli`);
  if (password.length < 8) redirect(`${PATH}?hata=sifre-kisa`);
  const role: AdminRole = (adminRoles as readonly string[]).includes(roleRaw) ? (roleRaw as AdminRole) : "PERSONEL";

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) redirect(`${PATH}?hata=eposta-kullanimda`);

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.create({ data: { name, email, role, passwordHash } });
  redirect(`${PATH}?basarili=eklendi`);
}

async function updatePersonel(id: string, selfEmail: string | undefined, formData: FormData) {
  "use server";
  const target = await prisma.adminUser.findUnique({ where: { id } });
  if (!target) redirect(`${PATH}?hata=bulunamadi`);
  if (target.email === selfEmail) redirect(`${PATH}?hata=kendi-kaydin`);

  const name = String(formData.get("name") || "").trim();
  const roleRaw = String(formData.get("role") || "");
  if (!name) redirect(`${PATH}?hata=isim-gerekli`);
  const role: AdminRole = (adminRoles as readonly string[]).includes(roleRaw) ? (roleRaw as AdminRole) : target.role as AdminRole;

  await prisma.adminUser.update({ where: { id }, data: { name, role } });
  redirect(`${PATH}?basarili=guncellendi`);
}

async function toggleActivePersonel(id: string, selfEmail: string | undefined, formData: FormData) {
  "use server";
  const target = await prisma.adminUser.findUnique({ where: { id } });
  if (!target) redirect(`${PATH}?hata=bulunamadi`);
  if (target.email === selfEmail) redirect(`${PATH}?hata=kendi-kaydin`);

  const isActive = formData.get("isActive") === "true";
  await prisma.adminUser.update({ where: { id }, data: { isActive } });
  redirect(`${PATH}?basarili=durum-guncellendi`);
}

async function resetPersonelPassword(id: string, formData: FormData) {
  "use server";
  const password = String(formData.get("password") || "");
  if (password.length < 8) redirect(`${PATH}?hata=sifre-kisa`);

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.update({ where: { id }, data: { passwordHash } });
  redirect(`${PATH}?basarili=sifre-sifirlandi`);
}

export default async function AdminPersonelPage({
  searchParams
}: {
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  const session = await requireAdmin();
  const { basarili, hata } = await searchParams;
  const selfEmail = session.user?.email ?? undefined;

  const personel = await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-admin-text">Personel</h1>

      <PersonelFeedback basarili={basarili} hata={hata} />

      <Card title="Yeni Personel" className="mt-6">
        <form action={createPersonel} className="grid grid-cols-2 gap-3">
          <input
            name="name"
            required
            placeholder="Ad Soyad"
            className="rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="E-posta"
            className="rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          />
          <select
            name="role"
            defaultValue="PERSONEL"
            className="rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          >
            {adminRoles.map((r) => (
              <option key={r} value={r}>
                {adminRoleLabel[r]}
              </option>
            ))}
          </select>
          <input
            name="password"
            required
            minLength={8}
            placeholder="Geçici şifre (en az 8 karakter)"
            className="rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          />
          <button
            type="submit"
            className="col-span-2 rounded-md bg-admin-accent px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Personel Ekle
          </button>
        </form>
      </Card>

      <ul className="mt-6 divide-y divide-admin-border rounded-lg border border-admin-border bg-admin-surface">
        {personel.map((p) => (
          <PersonelRow
            key={p.id}
            id={p.id}
            name={p.name}
            email={p.email}
            role={(adminRoles as readonly string[]).includes(p.role) ? (p.role as AdminRole) : "ADMIN"}
            isActive={p.isActive}
            isSelf={p.email === selfEmail}
            updateAction={updatePersonel.bind(null, p.id, selfEmail)}
            toggleActiveAction={toggleActivePersonel.bind(null, p.id, selfEmail)}
            resetPasswordAction={resetPersonelPassword.bind(null, p.id)}
          />
        ))}
        {personel.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-admin-text-muted">Henüz personel yok.</li>
        )}
      </ul>
    </div>
  );
}

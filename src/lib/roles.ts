export const adminRoles = ["ADMIN", "PERSONEL"] as const;
export type AdminRole = (typeof adminRoles)[number];

export const adminRoleLabel: Record<AdminRole, string> = {
  ADMIN: "Tam Yetkili",
  PERSONEL: "Sipariş Hazırlama"
};

// PERSONEL rolunun erisebilecegi tek kok yol grubu - siparis ve kargo.
// Bunun disindaki her /admin/* yolu sadece ADMIN'e acik.
export const personelAllowedPaths = ["/admin", "/admin/siparisler", "/admin/kargolar"];

export function isPathAllowedForRole(role: string, pathname: string): boolean {
  if (role === "ADMIN") return true;
  // "/admin" (panel ana sayfasi) sadece tam eslesince izinli - aksi halde
  // startsWith("/admin/") her /admin/* yolunu yanlislikla izinli sayardi.
  return personelAllowedPaths.some((p) =>
    p === "/admin" ? pathname === p : pathname === p || pathname.startsWith(`${p}/`)
  );
}

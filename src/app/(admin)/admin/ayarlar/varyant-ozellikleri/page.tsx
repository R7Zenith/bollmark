import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { revalidateCatalog } from "@/lib/revalidate-catalog";
import { requireAdmin } from "@/lib/require-admin";
import { Card } from "@/components/admin/card";
import { VariantAttributeCard } from "@/components/admin/variant-attribute-card";
import { VariantAttributesToggleAll } from "@/components/admin/variant-attributes-toggle-all";
import { VariantAttributesFeedback } from "@/components/admin/variant-attributes-feedback";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { VariantValueHexField } from "@/components/admin/variant-value-hex-field";
import { VariantValueCreateFields } from "@/components/admin/variant-value-create-fields";
import { VariantValueNameEditor } from "@/components/admin/variant-value-name-editor";
import { logAudit } from "@/lib/audit-log";

const PATH = "/admin/ayarlar/varyant-ozellikleri";

function fail(reason: string): never {
  redirect(`${PATH}?hata=${reason}`);
}

function ok(reason: string): never {
  redirect(`${PATH}?basarili=${reason}`);
}

async function createAttribute(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  if (!name) fail("isim-bos");

  const existing = await prisma.variantAttribute.findUnique({ where: { name } });
  if (existing) fail("isim-tekrar");

  const last = await prisma.variantAttribute.findFirst({ orderBy: { position: "desc" } });
  await prisma.variantAttribute.create({ data: { name, position: (last?.position ?? -1) + 1 } });
  revalidatePath(PATH);
  ok("ozellik-eklendi");
}

async function deleteAttribute(id: string) {
  "use server";
  try {
    await prisma.variantAttribute.delete({ where: { id } });
  } catch {
    fail("kaydedilemedi");
  }
  revalidatePath(PATH);
  revalidateCatalog();
  ok("ozellik-silindi");
}

async function moveAttribute(id: string, direction: "up" | "down") {
  "use server";
  const attributes = await prisma.variantAttribute.findMany({ orderBy: { position: "asc" } });
  const index = attributes.findIndex((a) => a.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= attributes.length) {
    ok("siralandi");
  }
  const a = attributes[index];
  const b = attributes[swapIndex];
  await prisma.$transaction([
    prisma.variantAttribute.update({ where: { id: a.id }, data: { position: b.position } }),
    prisma.variantAttribute.update({ where: { id: b.id }, data: { position: a.position } })
  ]);
  revalidatePath(PATH);
  ok("siralandi");
}

async function createValue(attributeId: string, formData: FormData) {
  "use server";
  const value = String(formData.get("value") || "").trim();
  const hexColorRaw = String(formData.get("hexColor") || "").trim();
  const hexColor = hexColorRaw ? hexColorRaw : null;
  if (!value) fail("deger-bos");

  const existing = await prisma.variantAttributeValue.findUnique({
    where: { attributeId_value: { attributeId, value } }
  });
  if (existing) fail("deger-tekrar");

  const last = await prisma.variantAttributeValue.findFirst({
    where: { attributeId },
    orderBy: { position: "desc" }
  });
  await prisma.variantAttributeValue.create({
    data: { attributeId, value, hexColor, position: (last?.position ?? -1) + 1 }
  });
  revalidatePath(PATH);
  ok("deger-eklendi");
}

async function updateValueHex(id: string, formData: FormData) {
  "use server";
  const hexColorRaw = String(formData.get("hexColor") || "").trim();
  await prisma.variantAttributeValue.update({
    where: { id },
    data: { hexColor: hexColorRaw || null }
  });
  revalidatePath(PATH);
  revalidateCatalog();
  ok("deger-guncellendi");
}

// Deger adini degistirir. Yeni ad ayni ozellikte zaten varsa (ve formdan
// merge=1 geldiyse) iki deger birlestirilir: varyant ve renk galerisi
// baglantilari mevcut degere tasinir, eski deger silinir. SKU'lara dokunulmaz.
async function renameValue(attributeId: string, id: string, formData: FormData) {
  "use server";
  const session = await requireAdmin();
  const value = String(formData.get("value") || "").trim();
  if (!value) fail("deger-bos");

  const current = await prisma.variantAttributeValue.findUnique({ where: { id } });
  if (!current) fail("kaydedilemedi");
  if (current.value === value) ok("deger-guncellendi");

  const target = await prisma.variantAttributeValue.findUnique({
    where: { attributeId_value: { attributeId, value } }
  });

  const actor = { actorEmail: session.user?.email ?? "bilinmiyor", actorRole: session.user?.role ?? "ADMIN" };

  if (target) {
    if (formData.get("merge") !== "1") fail("deger-tekrar");
    try {
      await prisma.$transaction(async (tx) => {
        // Ayni varyant iki degere birden bagliysa eski baglanti silinir
        // (@@unique([variantId, valueId]) cakismasi).
        await tx.productVariantOption.deleteMany({
          where: { valueId: id, variant: { options: { some: { valueId: target.id } } } }
        });
        await tx.productVariantOption.updateMany({ where: { valueId: id }, data: { valueId: target.id } });
        await tx.productOptionImage.updateMany({ where: { valueId: id }, data: { valueId: target.id } });
        await tx.variantAttributeValue.delete({ where: { id } });
      });
    } catch {
      fail("kaydedilemedi");
    }
    logAudit({
      ...actor,
      action: "VARYANT_DEGERI_BIRLESTIRILDI",
      targetType: "VariantAttributeValue",
      targetId: target.id,
      detail: `"${current.value}" değeri "${value}" değeriyle birleştirildi.`
    });
    revalidatePath(PATH);
    revalidateCatalog();
    ok("deger-birlestirildi");
  }

  await prisma.variantAttributeValue.update({ where: { id }, data: { value } });
  logAudit({
    ...actor,
    action: "VARYANT_DEGERI_YENIDEN_ADLANDIRILDI",
    targetType: "VariantAttributeValue",
    targetId: id,
    detail: `"${current.value}" → "${value}"`
  });
  revalidatePath(PATH);
  revalidateCatalog();
  ok("deger-yeniden-adlandirildi");
}

async function deleteValue(id: string) {
  "use server";
  try {
    await prisma.variantAttributeValue.delete({ where: { id } });
  } catch {
    fail("kaydedilemedi");
  }
  revalidatePath(PATH);
  revalidateCatalog();
  ok("deger-silindi");
}

async function moveValue(attributeId: string, id: string, direction: "up" | "down") {
  "use server";
  const values = await prisma.variantAttributeValue.findMany({
    where: { attributeId },
    orderBy: { position: "asc" }
  });
  const index = values.findIndex((v) => v.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= values.length) {
    ok("siralandi");
  }
  const a = values[index];
  const b = values[swapIndex];
  await prisma.$transaction([
    prisma.variantAttributeValue.update({ where: { id: a.id }, data: { position: b.position } }),
    prisma.variantAttributeValue.update({ where: { id: b.id }, data: { position: a.position } })
  ]);
  revalidatePath(PATH);
  revalidateCatalog();
  ok("siralandi");
}

const inputClass =
  "w-full rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";
const iconBtnClass =
  "rounded border border-admin-border p-1 text-admin-text-muted hover:bg-admin-bg hover:text-admin-text disabled:opacity-30 disabled:pointer-events-none";

export default async function VariantAttributesPage({
  searchParams
}: {
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  await requireAdmin();
  const { basarili, hata } = await searchParams;

  const attributes = await prisma.variantAttribute.findMany({
    orderBy: { position: "asc" },
    include: {
      values: {
        orderBy: { position: "asc" },
        include: { _count: { select: { variantLinks: true } } }
      }
    }
  });

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-admin-text">Varyant Özellikleri</h1>
        <p className="mt-1 text-sm text-admin-text-muted">
          Beden, Renk gibi ürün varyant özelliklerini ve alabilecekleri değerleri buradan yönetin. Ürün
          düzenleme sayfasında varyant oluştururken bu değerler kullanılır.
        </p>
      </div>

      <VariantAttributesFeedback basarili={basarili} hata={hata} />

      {attributes.length > 0 && (
        <div className="flex justify-end">
          <VariantAttributesToggleAll />
        </div>
      )}

      <Card title="Özellik Ekle">
        <form action={createAttribute} className="flex gap-3">
          <input name="name" placeholder="örn. Beden, Renk, Kalıp" required className={inputClass} />
          <button className="flex shrink-0 items-center gap-1.5 rounded-md bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            <Plus size={15} /> Ekle
          </button>
        </form>
      </Card>

      {attributes.length === 0 ? (
        <p className="text-sm text-admin-text-muted">Henüz bir varyant özelliği tanımlanmadı.</p>
      ) : (
        attributes.map((attribute, attrIndex) => {
          const isColorAttribute = attribute.name.toLocaleLowerCase("tr") === "renk";
          const moveAttrUp = moveAttribute.bind(null, attribute.id, "up");
          const moveAttrDown = moveAttribute.bind(null, attribute.id, "down");
          const deleteAttr = deleteAttribute.bind(null, attribute.id);
          const createVal = createValue.bind(null, attribute.id);

          return (
            <VariantAttributeCard
              key={attribute.id}
              attributeId={attribute.id}
              title={attribute.name}
              valueCount={attribute.values.length}
              action={
                <div className="flex items-center gap-1.5">
                  <form action={moveAttrUp}>
                    <button className={iconBtnClass} disabled={attrIndex === 0} aria-label="Yukarı taşı">
                      <ArrowUp size={14} />
                    </button>
                  </form>
                  <form action={moveAttrDown}>
                    <button
                      className={iconBtnClass}
                      disabled={attrIndex === attributes.length - 1}
                      aria-label="Aşağı taşı"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </form>
                  <form action={deleteAttr}>
                    <ConfirmSubmitButton
                      confirmMessage={`"${attribute.name}" özelliğini ve altındaki tüm değerleri silmek istediğinize emin misiniz? Bu değerleri kullanan varyantlardaki bağlantılar da kaldırılır.`}
                      className="rounded border border-red-200 p-1 text-red-600 hover:bg-red-600 hover:text-white"
                    >
                      <Trash2 size={14} />
                    </ConfirmSubmitButton>
                  </form>
                </div>
              }
            >
              <div className="space-y-2">
                {attribute.values.length === 0 ? (
                  <p className="text-sm text-admin-text-muted">Henüz değer eklenmedi.</p>
                ) : (
                  attribute.values.map((value, valIndex) => {
                    const moveValUp = moveValue.bind(null, attribute.id, value.id, "up");
                    const moveValDown = moveValue.bind(null, attribute.id, value.id, "down");
                    const deleteVal = deleteValue.bind(null, value.id);
                    const updateHex = updateValueHex.bind(null, value.id);
                    const usageCount = value._count.variantLinks;

                    return (
                      <div
                        key={value.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-admin-border px-3 py-2"
                      >
                        {isColorAttribute && (
                          <span
                            className="h-5 w-5 shrink-0 rounded-full border border-admin-border"
                            style={{ backgroundColor: value.hexColor || "transparent" }}
                            title={value.hexColor ?? ""}
                          />
                        )}
                        <VariantValueNameEditor
                          action={renameValue.bind(null, attribute.id, value.id)}
                          value={value.value}
                          siblingValues={attribute.values.map((v) => v.value)}
                          usageCount={usageCount}
                          iconBtnClass={iconBtnClass}
                        />
                        {usageCount > 0 && (
                          <span className="text-xs text-admin-text-muted">{usageCount} varyantta kullanılıyor</span>
                        )}
                        {isColorAttribute && (
                          <form action={updateHex}>
                            <VariantValueHexField
                              name="hexColor"
                              colorName={value.value}
                              defaultValue={value.hexColor || "#000000"}
                            />
                          </form>
                        )}
                        <div className="flex items-center gap-1.5">
                          <form action={moveValUp}>
                            <button className={iconBtnClass} disabled={valIndex === 0} aria-label="Yukarı taşı">
                              <ArrowUp size={13} />
                            </button>
                          </form>
                          <form action={moveValDown}>
                            <button
                              className={iconBtnClass}
                              disabled={valIndex === attribute.values.length - 1}
                              aria-label="Aşağı taşı"
                            >
                              <ArrowDown size={13} />
                            </button>
                          </form>
                          <form action={deleteVal}>
                            <ConfirmSubmitButton
                              confirmMessage={
                                usageCount > 0
                                  ? `"${value.value}" değeri ${usageCount} varyantta kullanılıyor. Yine de silmek istediğinize emin misiniz? Bu varyantlardaki "${attribute.name}" bilgisi kaldırılacak.`
                                  : `"${value.value}" değerini silmek istediğinize emin misiniz?`
                              }
                              className="rounded border border-red-200 p-1 text-red-600 hover:bg-red-600 hover:text-white"
                            >
                              <Trash2 size={13} />
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </div>
                    );
                  })
                )}

                <form action={createVal} className="flex flex-wrap items-center gap-2 pt-1">
                  <VariantValueCreateFields isColorAttribute={isColorAttribute} />
                  <button className="flex shrink-0 items-center gap-1.5 rounded-md border border-admin-border px-3 py-2 text-sm font-medium text-admin-text hover:bg-admin-bg">
                    <Plus size={14} /> Değer Ekle
                  </button>
                </form>
              </div>
            </VariantAttributeCard>
          );
        })
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/admin/card";
import { VariantAttributesFeedback } from "@/components/admin/variant-attributes-feedback";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { ColorAutoSubmitInput } from "@/components/admin/color-auto-submit-input";

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
  ok("deger-guncellendi");
}

async function deleteValue(id: string) {
  "use server";
  try {
    await prisma.variantAttributeValue.delete({ where: { id } });
  } catch {
    fail("kaydedilemedi");
  }
  revalidatePath(PATH);
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
            <Card
              key={attribute.id}
              title={attribute.name}
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
                        className="flex items-center gap-3 rounded-md border border-admin-border px-3 py-2"
                      >
                        {isColorAttribute && (
                          <span
                            className="h-5 w-5 shrink-0 rounded-full border border-admin-border"
                            style={{ backgroundColor: value.hexColor || "transparent" }}
                            title={value.hexColor ?? ""}
                          />
                        )}
                        <span className="flex-1 text-sm text-admin-text">{value.value}</span>
                        {usageCount > 0 && (
                          <span className="text-xs text-admin-text-muted">{usageCount} varyantta kullanılıyor</span>
                        )}
                        {isColorAttribute && (
                          <form action={updateHex} className="flex items-center gap-1.5">
                            <ColorAutoSubmitInput
                              name="hexColor"
                              defaultValue={value.hexColor || "#000000"}
                              className="h-7 w-9 cursor-pointer rounded border border-admin-border p-0.5"
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

                <form action={createVal} className="flex gap-2 pt-1">
                  <input name="value" placeholder="Yeni değer" required className={inputClass} />
                  {isColorAttribute && (
                    <input
                      type="color"
                      name="hexColor"
                      defaultValue="#000000"
                      className="h-9 w-11 cursor-pointer rounded border border-admin-border p-0.5"
                    />
                  )}
                  <button className="flex shrink-0 items-center gap-1.5 rounded-md border border-admin-border px-3 py-2 text-sm font-medium text-admin-text hover:bg-admin-bg">
                    <Plus size={14} /> Değer Ekle
                  </button>
                </form>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/admin/button";
import { DescriptionEditor } from "@/components/admin/description-editor";
import { useToast } from "@/components/admin/toast";
import {
  approveDraft,
  discardDraft,
  restoreOriginalDescription
} from "@/app/(admin)/admin/urunler/[id]/ai-description-actions";

const DRAFT_FIELD = "descriptionDraft";

// Açıklama editörünü (children) sarar: taslak varsa mevcut açıklamanın yanında
// düzenlenebilir taslak ve Kullan/Vazgeç. Taslaklar scripts/ai-taslak-aktar.ts
// ile kaydedilir; ANTHROPIC_API_KEY olmadığı için "üret" butonu yok. Ürün
// formunun içinde durduğu için butonlar type="button"; taslak editörünün gizli
// alanı forma dahildir, yani "Kaydet" taslaktaki düzenlemeyi de saklar.
export function AiDescriptionPanel({
  productId,
  draft,
  canRestoreOriginal,
  children
}: {
  productId: string;
  draft: string | null;
  canRestoreOriginal: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const draftRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"approve" | "discard" | "restore" | null>(null);

  async function run(
    kind: NonNullable<typeof busy>,
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    successMessage: string
  ) {
    setBusy(kind);
    try {
      const result = await action();
      if (result.ok) {
        showToast(successMessage, "success");
        router.refresh();
      } else {
        showToast(result.error, "error");
      }
    } catch {
      showToast("Bir hata oluştu.", "error");
    } finally {
      setBusy(null);
    }
  }

  function handleApprove() {
    const input = draftRef.current?.querySelector<HTMLInputElement>(`input[name="${DRAFT_FIELD}"]`);
    run("approve", () => approveDraft(productId, input?.value ?? ""), "Taslak açıklama olarak kaydedildi, sitede yayında.");
  }

  function handleRestore() {
    if (!window.confirm("Sitede görünen açıklama tedarikçinin orijinal metniyle değiştirilsin mi?")) return;
    run("restore", () => restoreOriginalDescription(productId), "Orijinal metne dönüldü.");
  }

  return (
    <div>
      {/* Ana editör taslak gelince/gidince yeniden kurulmasın diye hep aynı konumda. */}
      <div className={draft ? "grid grid-cols-1 gap-4 md:grid-cols-2" : ""}>
        <div>
          {draft && <p className="mt-2 text-xs text-admin-text-muted">Mevcut açıklama (sitede görünen)</p>}
          {children}
        </div>
        {draft && (
          <div ref={draftRef}>
            <p className="mt-2 text-xs text-admin-text-muted">AI taslağı (onay bekliyor, düzenleyebilirsiniz)</p>
            <DescriptionEditor key={draft} name={DRAFT_FIELD} defaultValue={draft} />
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" size="sm" disabled={busy !== null} onClick={handleApprove}>
                {busy === "approve" && <Loader2 size={14} className="animate-spin" />} Kullan
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy !== null}
                onClick={() => run("discard", () => discardDraft(productId), "Taslak silindi.")}
              >
                {busy === "discard" && <Loader2 size={14} className="animate-spin" />} Vazgeç
              </Button>
            </div>
          </div>
        )}
      </div>
      {canRestoreOriginal && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={handleRestore}
          className="mt-3 text-xs text-admin-text-muted underline hover:text-admin-text disabled:opacity-50"
        >
          Orijinal metne dön
        </button>
      )}
    </div>
  );
}

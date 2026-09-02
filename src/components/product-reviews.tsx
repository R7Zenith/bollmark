"use client";

import { useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { StarRating } from "@/components/star-rating";
import { MultiImageField, type ImageEntry } from "@/components/admin/multi-image-field";

export interface ReviewView {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  imageUrls: string[];
  createdAtLabel: string;
}

export function ProductReviews({
  productId,
  avgRating,
  count,
  reviews
}: {
  productId: string;
  avgRating: number | null;
  count: number;
  reviews: ReviewView[];
}) {
  const { data: session } = useSession();
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState(session?.user?.name ?? "");
  const [email, setEmail] = useState(session?.user?.email ?? "");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/yorumlar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          customerName: name,
          customerEmail: email,
          rating,
          comment,
          imageUrls: images.map((i) => i.url).filter(Boolean)
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Yorum gönderilemedi, lütfen tekrar deneyin.");
        return;
      }
      setSuccess(true);
      setComment("");
      setImages([]);
      setRating(5);
    } catch {
      setError("Bir sorun oluştu, lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-20 border-t border-line pt-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl">Yorumlar</h2>
          {count > 0 ? (
            <div className="mt-2 flex items-center gap-2">
              <StarRating value={Math.round(avgRating ?? 0)} />
              <span className="text-sm text-ink/60">
                {avgRating?.toFixed(1)} ({count} değerlendirme)
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink/60">Henüz değerlendirme yok.</p>
          )}
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="border border-ink px-5 py-2.5 text-sm uppercase tracking-wide hover:bg-ink hover:text-paper"
          >
            Yorum Yaz
          </button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="mt-8 max-w-xl space-y-4 border border-line bg-white p-6">
          {success ? (
            <p className="text-sm text-ink/70">
              Teşekkürler! Yorumunuz onaylandıktan sonra yayınlanacak.
            </p>
          ) : (
            <>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink/60">Puanınız</p>
                <div className="mt-1">
                  <StarRating value={rating} onChange={setRating} size={22} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ad Soyad"
                  className="border border-line px-4 py-2.5 text-sm"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  placeholder="E-posta"
                  className="border border-line px-4 py-2.5 text-sm"
                />
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
                minLength={5}
                rows={4}
                placeholder="Ürün hakkındaki görüşleriniz"
                className="w-full border border-line px-4 py-2.5 text-sm"
              />
              <div>
                <p className="text-xs uppercase tracking-wide text-ink/60">Fotoğraf (opsiyonel)</p>
                <div className="mt-2">
                  <MultiImageField images={images} onChange={setImages} addLabel="Fotoğraf Ekle" uploadEndpoint="/api/yorumlar/foto-yukle" />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-ink px-6 py-2.5 text-sm uppercase tracking-wide text-paper hover:bg-accent disabled:opacity-50"
                >
                  {submitting ? "Gönderiliyor..." : "Yorumu Gönder"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="border border-line px-6 py-2.5 text-sm uppercase tracking-wide hover:bg-ink hover:text-paper"
                >
                  Vazgeç
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {reviews.length > 0 && (
        <div className="mt-10 space-y-8">
          {reviews.map((r) => (
            <div key={r.id} className="border-t border-line pt-6 first:border-0 first:pt-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{r.customerName}</p>
                  <StarRating value={r.rating} size={13} />
                </div>
                <p className="text-xs text-ink/50">{r.createdAtLabel}</p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink/80">{r.comment}</p>
              {r.imageUrls.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {r.imageUrls.map((url) => (
                    <div key={url} className="relative h-20 w-20 overflow-hidden rounded bg-line">
                      <Image src={url} alt="" fill className="object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, Link2, Loader2, Pencil, Plus, RotateCcw, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/admin/button";
import { useToast } from "@/components/admin/toast";
import { MAX_UPLOAD_BYTES, resizeImageForUpload } from "@/lib/client-image-resize";

export type ImageEntry = { url: string; alt?: string; isCover?: boolean };

type PendingUpload = {
  key: string;
  file: File;
  previewUrl: string;
  status: "queued" | "uploading" | "done" | "error";
  url?: string;
  error?: string;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_CONCURRENT_UPLOADS = 3;

const iconButtonClass =
  "flex h-8 w-8 items-center justify-center rounded bg-black/60 text-white hover:bg-black/80 disabled:opacity-30";

// Gorsel listesini kucuk resim izgarasi olarak yonetir: coklu dosya secimi ve
// bilgisayardan surukle-birak ile toplu yukleme (en fazla 3 eszamanli), kartlari
// surukleyerek siralama, vitrin secimi, alt metin ve URL ile ekleme. Parent'a
// (onChange) sadece yuklemesi bitmis gorseller gider; bekleyenler bu bilesenin
// icinde tutulur ve yukleme surerken form gonderimi engellenir.
export function MultiImageField({
  images,
  onChange,
  addLabel = "Görsel Ekle",
  uploadEndpoint = "/api/admin/upload"
}: {
  images: ImageEntry[];
  onChange: (next: ImageEntry[]) => void;
  addLabel?: string;
  uploadEndpoint?: string;
}) {
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [urlBoxOpen, setUrlBoxOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [submitBlocked, setSubmitBlocked] = useState(false);
  const { showToast } = useToast();

  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const keyCounterRef = useRef(0);
  const queueRef = useRef<{ key: string; file: File }[]>([]);
  const activeRef = useRef(0);
  const removedKeysRef = useRef(new Set<string>());
  // Bu oturumda yuklenen URL'ler: kaydetmeden silinirse Blob'dan da silinir.
  const uploadedUrlsRef = useRef(new Set<string>());
  const previewUrlsRef = useRef(new Set<string>());

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // dnd-kit icin kararli id: ayni URL birden fazla kez varsa sira numarasiyla ayrilir.
  const occurrences = new Map<string, number>();
  const ids = images.map((img) => {
    const n = occurrences.get(img.url) ?? 0;
    occurrences.set(img.url, n + 1);
    return `${img.url}#${n}`;
  });
  const hasExplicitCover = images.some((img) => img.isCover === true);
  const busyCount = pending.filter((p) => p.status === "queued" || p.status === "uploading").length;

  function revokePreview(previewUrl: string) {
    URL.revokeObjectURL(previewUrl);
    previewUrlsRef.current.delete(previewUrl);
  }

  function deleteUploaded(url: string) {
    if (!uploadedUrlsRef.current.has(url)) return;
    uploadedUrlsRef.current.delete(url);
    fetch(uploadEndpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    }).catch(() => {});
  }

  async function uploadOne(key: string, file: File) {
    const fail = (error: string) =>
      setPending((prev) => prev.map((p) => (p.key === key ? { ...p, status: "error", error } : p)));
    try {
      const prepared = await resizeImageForUpload(file);
      if (prepared.size > MAX_UPLOAD_BYTES) {
        fail("Dosya çok büyük (en fazla 4.5 MB).");
        return;
      }
      const formData = new FormData();
      formData.append("file", prepared);
      const res = await fetch(uploadEndpoint, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.url !== "string") {
        fail(data.error || "Yükleme başarısız oldu.");
        return;
      }
      uploadedUrlsRef.current.add(data.url);
      if (removedKeysRef.current.has(key)) {
        deleteUploaded(data.url);
        return;
      }
      setPending((prev) => prev.map((p) => (p.key === key ? { ...p, status: "done", url: data.url } : p)));
    } catch {
      fail("Yükleme başarısız oldu.");
    }
  }

  function pump() {
    while (activeRef.current < MAX_CONCURRENT_UPLOADS && queueRef.current.length > 0) {
      const job = queueRef.current.shift()!;
      activeRef.current++;
      setPending((prev) => prev.map((p) => (p.key === job.key ? { ...p, status: "uploading" } : p)));
      uploadOne(job.key, job.file).finally(() => {
        activeRef.current--;
        pump();
      });
    }
  }

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => ACCEPTED_TYPES.includes(f.type));
    if (files.length === 0) return;
    const added: PendingUpload[] = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      return { key: `u${++keyCounterRef.current}`, file, previewUrl, status: "queued" };
    });
    setSubmitBlocked(false);
    setPending((prev) => [...prev, ...added]);
    queueRef.current.push(...added.map((p) => ({ key: p.key, file: p.file })));
    pump();
  }

  function retry(item: PendingUpload) {
    setPending((prev) => prev.map((p) => (p.key === item.key ? { ...p, status: "queued", error: undefined } : p)));
    queueRef.current.push({ key: item.key, file: item.file });
    pump();
  }

  function removePending(item: PendingUpload) {
    removedKeysRef.current.add(item.key);
    queueRef.current = queueRef.current.filter((job) => job.key !== item.key);
    if (item.url) deleteUploaded(item.url);
    revokePreview(item.previewUrl);
    setPending((prev) => prev.filter((p) => p.key !== item.key));
  }

  // Bir yukleme grubu tamamen bitince (kuyruk bos), basarili olanlari secim
  // sirasiyla listenin sonuna ekle. Hatalilar "Tekrar dene" icin kalir.
  useEffect(() => {
    if (pending.some((p) => p.status === "queued" || p.status === "uploading")) return;
    const done = pending.filter((p) => p.status === "done" && p.url);
    if (done.length === 0) return;
    onChange([...images, ...done.map((p) => ({ url: p.url!, alt: "" }))]);
    done.forEach((p) => revokePreview(p.previewUrl));
    setPending((prev) => prev.filter((p) => p.status !== "done"));
  }, [pending, images, onChange]);

  useEffect(() => {
    const previews = previewUrlsRef.current;
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  // Yukleme surerken formun gonderilmesini engelle (yarim yuklenen gorseller kaybolmasin).
  useEffect(() => {
    if (busyCount === 0) return;
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const onSubmit = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      setSubmitBlocked(true);
      showToast(`${busyCount} görsel hâlâ yükleniyor, bitince kaydedin.`, "error");
    };
    form.addEventListener("submit", onSubmit, true);
    return () => form.removeEventListener("submit", onSubmit, true);
  }, [busyCount, showToast]);

  function removeAt(index: number) {
    deleteUploaded(images[index].url);
    onChange(images.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    onChange(arrayMove(images, index, target));
  }

  function makeCover(index: number) {
    onChange(images.map((img, i) => ({ ...img, isCover: i === index })));
  }

  function updateAlt(index: number, alt: string) {
    onChange(images.map((img, i) => (i === index ? { ...img, alt } : img)));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(images, oldIndex, newIndex));
  }

  function addUrls() {
    const urls = urlDraft
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^https?:\/\//i.test(line));
    if (urls.length > 0) onChange([...images, ...urls.map((url) => ({ url, alt: "" }))]);
    setUrlDraft("");
    setUrlBoxOpen(false);
  }

  const editingIndex = editingId ? ids.indexOf(editingId) : -1;
  const isEmpty = images.length === 0 && pending.length === 0;

  return (
    <div
      ref={rootRef}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(false);
        addFiles(e.dataTransfer.files);
      }}
      className={`space-y-3 rounded-md border-2 border-dashed p-2 transition-colors ${
        dragOver ? "border-admin-accent bg-admin-accent/5" : "border-transparent"
      }`}
    >
      {isEmpty ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`flex w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-8 text-sm text-admin-text-muted hover:border-admin-accent hover:text-admin-accent ${
            dragOver ? "border-admin-accent" : "border-admin-border"
          }`}
        >
          <Plus size={20} />
          <span>
            Fotoğrafları buraya sürükleyin veya <strong>{addLabel}</strong>&apos;e basın
          </span>
        </button>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {images.map((img, i) => (
                <SortableImageCard
                  key={ids[i]}
                  id={ids[i]}
                  url={img.url}
                  index={i}
                  isLast={i === images.length - 1}
                  isCover={img.isCover === true || (!hasExplicitCover && i === 0)}
                  isEditing={editingId === ids[i]}
                  onMakeCover={() => makeCover(i)}
                  onMove={(dir) => move(i, dir)}
                  onEditAlt={() => setEditingId(editingId === ids[i] ? null : ids[i])}
                  onRemove={() => removeAt(i)}
                />
              ))}
              {pending.map((item) => (
                <PendingCard key={item.key} item={item} onRetry={() => retry(item)} onRemove={() => removePending(item)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editingIndex >= 0 && (
        <label className="block text-xs text-admin-text-muted">
          {editingIndex + 1}. görselin alt metni
          <input
            autoFocus
            value={images[editingIndex].alt ?? ""}
            onChange={(e) => updateAlt(editingIndex, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setEditingId(null);
              }
            }}
            placeholder="Alt metin (opsiyonel)"
            className="mt-1 w-full rounded border border-admin-border px-2 py-1.5 text-xs text-admin-text focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          />
        </label>
      )}

      {submitBlocked && busyCount > 0 && (
        <p className="text-xs text-red-600">{busyCount} görsel hâlâ yükleniyor, bitince kaydedin.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Plus size={14} /> {addLabel}
        </Button>
        <button
          type="button"
          onClick={() => setUrlBoxOpen((v) => !v)}
          className="inline-flex min-h-8 items-center gap-1 text-xs text-admin-accent hover:underline"
        >
          <Link2 size={14} /> URL ile ekle
        </button>
        {!isEmpty && (
          <span className="text-xs text-admin-text-muted">Sıralamak için kartları sürükleyin.</span>
        )}
      </div>

      {urlBoxOpen && (
        <div className="space-y-2">
          <textarea
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            rows={3}
            placeholder={"https://... (her satıra bir URL)"}
            className="w-full rounded border border-admin-border px-2 py-1.5 text-xs focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={addUrls}>
              Ekle
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setUrlBoxOpen(false)}>
              Vazgeç
            </Button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function SortableImageCard({
  id,
  url,
  index,
  isLast,
  isCover,
  isEditing,
  onMakeCover,
  onMove,
  onEditAlt,
  onRemove
}: {
  id: string;
  url: string;
  index: number;
  isLast: boolean;
  isCover: boolean;
  isEditing: boolean;
  onMakeCover: () => void;
  onMove: (direction: -1 | 1) => void;
  onEditAlt: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      // Karti aktivator olarak isaretlemek, icindeki butonlarda Enter/Space'in
      // klavyeyle surukleme baslatmasini engeller.
      ref={(node) => {
        setNodeRef(node);
        setActivatorNodeRef(node);
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`group relative aspect-square cursor-grab touch-manipulation overflow-hidden rounded border bg-admin-surface active:cursor-grabbing ${
        isDragging ? "z-10 scale-105 border-admin-accent shadow-lg" : isEditing ? "border-admin-accent" : "border-admin-border"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />

      <div className="absolute left-1 top-1 flex items-center gap-1">
        <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{index + 1}</span>
        {isCover && (
          <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white">Vitrin</span>
        )}
      </div>

      <div className="absolute inset-x-1 bottom-1 flex justify-between transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button type="button" onClick={onMakeCover} className={iconButtonClass} aria-label="Vitrin Fotoğrafı Yap" title="Vitrin Fotoğrafı Yap">
          <Star size={14} className={isCover ? "text-amber-400" : ""} fill={isCover ? "currentColor" : "none"} />
        </button>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className={iconButtonClass} aria-label="Sola taşı" title="Sola taşı">
          <ArrowLeft size={14} />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={isLast} className={iconButtonClass} aria-label="Sağa taşı" title="Sağa taşı">
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="absolute right-1 top-1 flex gap-1 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button type="button" onClick={onEditAlt} className={iconButtonClass} aria-label="Alt metni düzenle" title="Alt metni düzenle">
          <Pencil size={14} />
        </button>
        <button type="button" onClick={onRemove} className={`${iconButtonClass} hover:bg-red-600`} aria-label="Görseli sil" title="Görseli sil">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function PendingCard({ item, onRetry, onRemove }: { item: PendingUpload; onRetry: () => void; onRemove: () => void }) {
  const isError = item.status === "error";
  return (
    <div
      className={`relative aspect-square overflow-hidden rounded border ${isError ? "border-2 border-red-500" : "border-admin-border"}`}
      title={item.error}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.previewUrl} alt="" className={`h-full w-full object-cover ${isError ? "opacity-40" : "opacity-60"}`} />
      {isError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1 text-center">
          <span className="line-clamp-2 text-[10px] font-medium text-red-700">{item.error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-8 items-center gap-1 rounded bg-red-600 px-2 text-xs text-white hover:bg-red-700"
          >
            <RotateCcw size={12} /> Tekrar dene
          </button>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-admin-accent" />
        </div>
      )}
      <button type="button" onClick={onRemove} className={`${iconButtonClass} absolute right-1 top-1`} aria-label="Kaldır" title="Kaldır">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

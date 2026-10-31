"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useSession } from "next-auth/react";
import { useKalpDurum } from "./use-kalp-durum";

// Bildirim zili (KALP_TOPLA_PLANI.md 6.7): yalniz uyede, INVISIBLE durumda gizli.
type Item = { id: string; title: string; body: string; link: string | null; readAt: string | null };

const XL_QUERY = "(min-width: 1280px)";

function subscribeXl(listener: () => void) {
  const query = window.matchMedia(XL_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export function BildirimZili({ desktop }: { desktop: boolean }) {
  const isXl = useSyncExternalStore(subscribeXl, () => window.matchMedia(XL_QUERY).matches, () => null);
  const { data: session } = useSession();
  const state = useKalpDurum();
  if (isXl !== desktop || !session?.user || !state) return null;
  return <Zil />;
}

function Zil() {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const load = async () => {
    const res = await fetch("/api/bildirimler?ozet=1", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { items: Item[]; unread: number };
    setItems(data.items);
    setUnread(data.unread);
  };

  useEffect(() => {
    let alive = true;
    fetch("/api/bildirimler?ozet=1", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { items: Item[]; unread: number }) : null))
      .then((data) => {
        if (!alive || !data) return;
        setItems(data.items);
        setUnread(data.unread);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    await load();
    await fetch("/api/bildirimler", { method: "POST" }).catch(() => undefined);
    setUnread(0);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Bildirimler, ${unread} okunmamış` : "Bildirimler"}
        aria-expanded={open}
        onClick={toggle}
        className="relative inline-flex h-10 w-10 items-center justify-center hover:text-clay"
      >
        <Bell className="h-5 w-5 xl:h-6 xl:w-6" strokeWidth={1.5} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-sale px-1 text-[10px] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-4 top-[76px] z-50 overflow-hidden rounded-xl border border-line bg-cream text-ink shadow-lg xl:absolute xl:inset-x-auto xl:right-0 xl:top-full xl:mt-2 xl:w-[360px]">
          <p className="border-b border-line px-4 py-3 text-sm font-medium">Bildirimler</p>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink/70">Henüz bildirimin yok.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.link ?? "/hesap/kalplerim"}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 hover:bg-ink/[0.024] ${item.readAt ? "" : "bg-[#FFF1F4]"}`}
                  >
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-ink/70">{item.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/hesap/bildirimler"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-4 py-3 text-center text-xs underline underline-offset-4"
          >
            Tümünü gör
          </Link>
        </div>
      )}
    </div>
  );
}

// Hesabim > Bildirimler acilinca hepsi okundu olur.
export function BildirimlerOkundu() {
  useEffect(() => {
    fetch("/api/bildirimler", { method: "POST" }).catch(() => undefined);
  }, []);
  return null;
}

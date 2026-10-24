"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";
import { saveConsent, type ConsentState, type StoredConsent } from "@/lib/consent";

// Buton dili cart-drawer.tsx'teki Release "pill" butonlariyla ayni.
// "Tumunu Reddet" ve "Tumunu Kabul Et" bilerek BIREBIR ayni sinifi kullanir -
// biri digerinden baskin olmamali (KVKK rıza rehberi).
const PILL =
  "flex h-[44px] items-center justify-center rounded-[50px] border border-ink px-6 text-[10px] uppercase tracking-[1px] transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const PILL_FILLED = `${PILL} bg-ink text-cream hover:bg-transparent hover:text-ink`;
const PILL_OUTLINE = `${PILL} bg-transparent text-ink hover:bg-ink hover:text-cream`;

const ACCEPT_ALL: ConsentState = { analytics: true, marketing: true };
const REJECT_ALL: ConsentState = { analytics: false, marketing: false };

const CATEGORIES: { key: keyof ConsentState | "necessary"; title: string; description: string }[] = [
  {
    key: "necessary",
    title: "Zorunlu çerezler",
    description:
      "Oturumunuzun açık kalması, güvenli ödeme ve çerez tercihinizin hatırlanması için gereklidir. Bu çerezler kapatılamaz."
  },
  {
    key: "analytics",
    title: "Analitik çerezler",
    description:
      "Google Analytics ile sayfaların ve ürünlerin nasıl kullanıldığını ölçerek siteyi geliştirmemize yardımcı olur. Onay verirseniz bu kapsamdaki veriler yurt dışında bulunan Google'a aktarılır."
  },
  {
    key: "marketing",
    title: "Pazarlama çerezleri",
    description:
      "Meta Pixel ile reklamlarımızın etkisini ölçmek ve Meta (Facebook/Instagram) üzerinde size ilgili ürün ve kampanyaları göstermek için kullanılır. Onay verirseniz bu kapsamdaki veriler yurt dışında bulunan Meta Platforms'a aktarılır."
  }
];

export default function CookieBanner({
  showBar,
  current,
  preferencesOpen,
  onPreferencesOpenChange
}: {
  showBar: boolean;
  current: StoredConsent | null;
  preferencesOpen: boolean;
  onPreferencesOpenChange: (open: boolean) => void;
}) {
  const choose = (state: ConsentState) => {
    saveConsent(state);
    onPreferencesOpenChange(false);
  };

  return (
    <>
      {showBar && (
        <ConsentBar
          onAcceptAll={() => choose(ACCEPT_ALL)}
          onRejectAll={() => choose(REJECT_ALL)}
          onManage={() => onPreferencesOpenChange(true)}
        />
      )}
      <PreferencesPanel
        open={preferencesOpen}
        initial={current ?? REJECT_ALL}
        onClose={() => onPreferencesOpenChange(false)}
        onSave={choose}
      />
    </>
  );
}

function ConsentBar({
  onAcceptAll,
  onRejectAll,
  onManage
}: {
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onManage: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Bant fixed oldugu icin sayfayi kaydirmaz (layout shift yok); body'nin
  // altina bant yuksekligi kadar bosluk verilir ki sayfanin en alti (footer)
  // bandin arkasinda kalmasin.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      document.body.style.paddingBottom = `${element.offsetHeight}px`;
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.body.style.paddingBottom = "";
    };
  }, []);

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Çerez bildirimi"
      className="fixed inset-x-0 bottom-0 z-[45] border-t border-line bg-cream motion-safe:animate-consent-in"
    >
      <div className="flex flex-col gap-3 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:flex-row md:items-center md:justify-between md:gap-10 xl:px-9">
        {/* Boyutlar globals.css'teki .storefront .text-xs / .text-sm ile ayni;
            sinif adi bilerek ham deger - o kurallar md: varyantini ezerdi. */}
        <p className="text-[0.8125rem] md:flex-1 leading-[1.125rem] text-ink md:text-[0.9375rem] md:leading-[1.375rem]">
          Size daha iyi bir alışveriş deneyimi sunabilmek için çerezlerden yararlanıyoruz. Zorunlu çerezler sitenin
          çalışması için her zaman kullanılır; analitik (Google Analytics) ve pazarlama (Meta - Facebook/Instagram) çerezleri ise yalnızca
          onayınızla etkinleştirilir.
          Ayrıntılı bilgi için{" "}
          <Link href="/cerez-politikasi" className="underline underline-offset-2">
            Çerez Politikası
          </Link>
          &apos;nı inceleyebilir, tercihlerinizi dilediğiniz zaman değiştirebilirsiniz.
        </p>
        <div className="grid shrink-0 grid-cols-2 gap-2 md:flex md:gap-3">
          <button type="button" onClick={onManage} className={`${PILL_OUTLINE} order-last col-span-2 md:order-first`}>
            Tercihleri Yönet
          </button>
          <button type="button" onClick={onRejectAll} className={`${PILL_FILLED} md:w-[168px]`}>
            Tümünü Reddet
          </button>
          <button type="button" onClick={onAcceptAll} className={`${PILL_FILLED} md:w-[168px]`}>
            Tümünü Kabul Et
          </button>
        </div>
      </div>
    </div>
  );
}

// Gorunum info-drawer.tsx'teki sagdan cekmeceyle ayni (ayni panel, baslik ve
// 450ms gecis); ek olarak odak tuzagi, Esc ile kapanma ve kapaninca odagin
// acan butona donmesi var.
function PreferencesPanel({
  open,
  initial,
  onClose,
  onSave
}: {
  open: boolean;
  initial: ConsentState;
  onClose: () => void;
  onSave: (state: ConsentState) => void;
}) {
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      setShouldRender(true);
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    setVisible(false);
    if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    returnFocusRef.current = null;
    const timeout = setTimeout(() => setShouldRender(false), 450);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!shouldRender || !open) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [shouldRender, open]);

  if (!shouldRender) return null;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]");
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[800]" onKeyDown={handleKeyDown}>
      <button
        type="button"
        aria-label="Kapat"
        tabIndex={-1}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-[450ms] ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // Easing basta negatif ilerleme urettigi icin visibility gecisin ilk
        // anlarinda "hidden" kalir ve panel odak alamaz - odak gecis bitince verilir.
        onTransitionEnd={(event) => {
          if (visible && event.target === event.currentTarget && event.propertyName === "transform") {
            closeRef.current?.focus();
          }
        }}
        className={`absolute inset-y-0 right-0 z-[801] flex h-full w-[28rem] max-w-full flex-col bg-cream transition-[transform,visibility] duration-[450ms] ease-[cubic-bezier(0.74,-0.01,0.26,1)] ${
          visible ? "visible translate-x-0" : "invisible translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <h2 id={titleId} className="text-[21px] font-normal leading-[21px] tracking-[-0.84px]">
            Çerez Tercihleri
          </h2>
          <button ref={closeRef} type="button" aria-label="Kapat" onClick={onClose} className="p-1">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        <PreferencesForm initial={initial} onSave={onSave} />
      </div>
    </div>,
    document.body
  );
}

// Panel her acilista yeniden mount edilir, secim o anki kayitli tercihle
// (yoksa hepsi kapali - onceden isaretli kutu yok) baslar.
function PreferencesForm({ initial, onSave }: { initial: ConsentState; onSave: (state: ConsentState) => void }) {
  const [selection, setSelection] = useState<ConsentState>({ analytics: initial.analytics, marketing: initial.marketing });

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <p className="text-sm text-stone">
          Hangi çerezlere izin verdiğinizi buradan seçebilirsiniz. Tercihinizi daha sonra sayfanın altındaki Çerez
          Tercihleri bağlantısından değiştirebilirsiniz. Ayrıntılar için{" "}
          <Link href="/cerez-politikasi" className="text-ink underline underline-offset-2">
            Çerez Politikası
          </Link>
          .
        </p>
        <ul className="mt-6 border-b border-line">
          {CATEGORIES.map((category) => {
            const locked = category.key === "necessary";
            const checked = locked || selection[category.key as keyof ConsentState];
            return (
              <li key={category.key} className="border-t border-line py-5">
                <div className="flex items-center justify-between gap-4">
                  <p id={`consent-${category.key}`} className="text-sm font-medium text-ink">
                    {category.title}
                  </p>
                  <div className="flex items-center gap-3">
                    {locked && <span className="text-xs text-stone">Her zaman açık</span>}
                    <Switch
                      checked={checked}
                      disabled={locked}
                      labelledBy={`consent-${category.key}`}
                      describedBy={`consent-${category.key}-desc`}
                      onChange={(value) =>
                        setSelection((prev) => ({ ...prev, [category.key as keyof ConsentState]: value }))
                      }
                    />
                  </div>
                </div>
                <p id={`consent-${category.key}-desc`} className="mt-2 text-sm text-stone">
                  {category.description}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-line px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <button type="button" onClick={() => onSave(selection)} className={PILL_OUTLINE}>
          Seçimlerimi Kaydet
        </button>
        <button type="button" onClick={() => onSave(ACCEPT_ALL)} className={PILL_FILLED}>
          Tümünü Kabul Et
        </button>
      </div>
    </>
  );
}

function Switch({
  checked,
  disabled,
  labelledBy,
  describedBy,
  onChange
}: {
  checked: boolean;
  disabled: boolean;
  labelledBy: string;
  describedBy: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[40px] shrink-0 rounded-full border border-ink transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-ink" : "bg-cream"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-[3px] h-[14px] w-[14px] rounded-full transition-[left,background-color] duration-300 ${
          checked ? "left-[21px] bg-cream" : "left-[3px] bg-ink"
        }`}
      />
    </button>
  );
}

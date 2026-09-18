"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// cart-drawer.tsx'teki mount/shouldRender/visible uc asamali animasyon
// deseninin ayni pattern'i - Bollmark'ta iki bagimsiz sagdan cekmece
// (Iade & Degisim, Urun Bakim Talimati) icin genellestirildi. cart-drawer.tsx
// kendi state'ini useCart'tan aliyor, bu component basit local acik/kapali
// state'i disaridan prop olarak aliyor.
export function InfoDrawer({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      document.body.style.overflow = "hidden";
    } else {
      setVisible(false);
      document.body.style.overflow = "";
      const timeout = setTimeout(() => setShouldRender(false), 450);
      return () => clearTimeout(timeout);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!shouldRender) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [shouldRender]);

  if (!shouldRender || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[800]">
      <button
        type="button"
        aria-label="Kapat"
        className={`absolute inset-0 bg-black/50 ${visible ? "" : "invisible"}`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-y-0 right-0 z-[801] flex h-full w-[28rem] max-w-full flex-col bg-cream transition-[transform,visibility] duration-[450ms] ease-[cubic-bezier(0.74,-0.01,0.26,1)] ${
          visible ? "visible translate-x-0" : "invisible translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <p className="text-[21px] font-normal leading-[21px] tracking-[-0.84px]">{title}</p>
          <button type="button" aria-label="Kapat" onClick={onClose} className="p-1">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6 pt-0">{children}</div>
      </div>
    </div>,
    document.body
  );
}

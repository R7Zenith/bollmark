import Link from "next/link";
import { Heart } from "lucide-react";
import { EFSANE_PATH, KALP_PAUSE_NOTE } from "@/lib/efsane-cuma";

// Efsane Cuma arasinda kalp dugmesi ve bar yerine gosterilen not.
export function KalpAraNotu({ className = "" }: { className?: string }) {
  return (
    <div role="status" className={`flex items-start gap-2 rounded-xl bg-[#FFF1F4] px-4 py-3 text-sm text-ink ${className}`}>
      <Heart size={14} className="mt-0.5 shrink-0 fill-sale text-sale" aria-hidden="true" />
      <p>
        {KALP_PAUSE_NOTE}{" "}
        <Link href={EFSANE_PATH} className="underline underline-offset-2">
          Muhteşem Kasım
        </Link>
      </p>
    </div>
  );
}

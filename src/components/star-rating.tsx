"use client";

import { Star } from "lucide-react";

export function StarRating({
  value,
  onChange,
  size = 16
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
}) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-0.5">
      {stars.map((s) => (
        <button
          key={s}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(s)}
          className={onChange ? "cursor-pointer" : "cursor-default"}
          aria-label={`${s} yıldız`}
        >
          <Star size={size} fill={s <= value ? "currentColor" : "none"} className={s <= value ? "text-accent" : "text-ink/30"} />
        </button>
      ))}
    </div>
  );
}

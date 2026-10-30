// Kalp Topla "Nasil calisir?" penceresinin 3 adimi. Gorseller satir ici SVG;
// animasyonlar globals.css'te (.kt-*), uc sahne tek 6 sn'lik donguyle sirayla oynar.
import type { CSSProperties } from "react";

const HEART =
  "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z";
const HEART_SCALE = 16 / 24;
export const COUPON_SHAPE =
  "M34 36h92a4 4 0 0 1 4 4v12a8 8 0 0 0 0 16v12a4 4 0 0 1-4 4H34a4 4 0 0 1-4-4V68a8 8 0 0 0 0-16V40a4 4 0 0 1 4-4Z";
const CONFETTI = ["#E8315B", "#F59E0B", "#14B8A6", "#7C5CFC", "#FFC83D", "#FF7A59"];
const STEP_BG = ["bg-[#FFE4EA]", "bg-[#FFF0C2]", "bg-sale"];

// Bar: 5 kalp. filled kadari dolu; animated indeksleri verilen sinifla sonradan dolar.
function Hearts({
  y,
  filled,
  animated = {},
  fillClass = "fill-sale",
  stagger = false
}: {
  y: number;
  filled: number;
  animated?: Record<number, string>;
  fillClass?: string;
  stagger?: boolean;
}) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(${32 + i * 20} ${y}) scale(${HEART_SCALE})`}>
          <path d={HEART} className="fill-none stroke-ink/25" strokeWidth={2} />
          {(i < filled || animated[i]) && (
            <path
              d={HEART}
              className={`${fillClass} ${animated[i] ?? ""}`}
              style={stagger ? { animationDelay: `${i * 50}ms` } : undefined}
            />
          )}
        </g>
      ))}
    </>
  );
}

// Merkezden disari sacilan konfeti. Yon CSS degiskeniyle keyframe'e gider.
function Burst({ cx, cy, count, radius, className }: { cx: number; cy: number; count: number; radius: number; className: string }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const distance = radius * (i % 2 ? 1 : 0.68);
        const style = {
          "--dx": `${(Math.cos(angle) * distance).toFixed(1)}px`,
          "--dy": `${(Math.sin(angle) * distance).toFixed(1)}px`,
          fill: CONFETTI[i % CONFETTI.length]
        } as CSSProperties;
        return i % 3 === 0 ? (
          <rect key={i} x={-2.5} y={-2.5} width={5} height={5} rx={1} className={className} style={style} />
        ) : (
          <circle key={i} r={i % 3 === 1 ? 3 : 2} className={className} style={style} />
        );
      })}
    </g>
  );
}

function Person({ x, className }: { x: number; className: string }) {
  return (
    <g className={className}>
      <circle cx={x} cy={26} r={8} />
      <path d={`M${x - 14} 54c0-10 6-15 14-15s14 5 14 15Z`} />
    </g>
  );
}

function SceneHeart() {
  return (
    <>
      <path
        d="M66 16l10-6q4 4 8 0l10 6 8 12-9 5-3-4v33H70V29l-3 4-9-5z"
        className="fill-[#E8315B] stroke-[#B91C45]"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Hearts y={78} filled={2} animated={{ 2: "kt-heart-tap" }} />
      <circle cx={80} cy={85} r={14} className="kt-ripple fill-none stroke-sale" strokeWidth={2.5} />
      <Burst cx={80} cy={85} count={12} radius={36} className="kt-burst-a" />
    </>
  );
}

function SceneInvite({ bonus }: { bonus: number }) {
  return (
    <>
      <Person x={36} className="fill-ink" />
      <Person x={124} className="fill-[#F59E0B]" />
      <path d="M54 32h52" className="fill-none stroke-ink/40" strokeWidth={1.5} strokeDasharray="3 4" />
      <path d="M0-8 16 0 0 8l3-8Z" className="kt-plane fill-sale" />
      <g className="kt-friend-in">
        <circle cx={136} cy={20} r={8} className="fill-[#14B8A6]" />
        <path d="m132.5 20 2.5 2.5 4.5-5" className="fill-none stroke-cream" strokeWidth={2} strokeLinecap="round" />
      </g>
      <Burst cx={124} cy={32} count={12} radius={32} className="kt-burst-b" />
      <text x={124} y={72} textAnchor="middle" className="kt-plus fill-sale text-[20px] font-bold">
        +{bonus}
      </text>
      <Hearts y={78} filled={3} animated={{ 3: "kt-heart-bonus", 4: "kt-heart-bonus-late" }} />
    </>
  );
}

function SceneCoupon({ percent, hours }: { percent: number; hours: number }) {
  return (
    <>
      <g className="kt-rays">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d="M80 60l-7-90h14Z" className="fill-[#FFC83D]" transform={`rotate(${i * 30} 80 60)`} />
        ))}
      </g>
      <Hearts
        y={8}
        filled={5}
        animated={{ 0: "kt-heart-jump", 1: "kt-heart-jump", 2: "kt-heart-jump", 3: "kt-heart-jump", 4: "kt-heart-jump" }}
        fillClass="fill-cream"
        stagger
      />
      <g className="kt-lock">
        <path d="M71 56v-8a9 9 0 0 1 18 0v8" className="kt-shackle fill-none stroke-cream" strokeWidth={3} />
        <rect x={66} y={55} width={28} height={23} rx={4} className="fill-cream" />
        <circle cx={80} cy={66} r={3} className="fill-sale" />
      </g>
      <circle cx={80} cy={60} r={30} className="kt-flash fill-cream" />
      <g className="kt-coupon">
        <path d={COUPON_SHAPE} className="fill-[#FFC83D]" />
        <text x={80} y={64} textAnchor="middle" className="fill-ink text-[26px] font-bold">
          %{percent}
        </text>
        <text x={80} y={77} textAnchor="middle" className="fill-ink text-[10px] font-medium">
          {hours} saat
        </text>
      </g>
      <Burst cx={80} cy={60} count={20} radius={72} className="kt-burst-c" />
    </>
  );
}

function Step({
  index,
  title,
  children,
  scene
}: {
  index: number;
  title: string;
  children: React.ReactNode;
  scene: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-4 sm:block">
      <div className={`kt-step-${index} ${STEP_BG[index - 1]} w-[116px] shrink-0 overflow-hidden rounded-xl sm:w-full`}>
        <svg viewBox="0 0 160 104" aria-hidden="true" className="block h-auto w-full">
          {scene}
        </svg>
      </div>
      <div className="sm:mt-3">
        <p className="text-sm font-medium text-ink">
          {index}. {title}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink/70">{children}</p>
      </div>
    </li>
  );
}

export function KalpNasilCalisir({
  inviteBonus,
  discountPercent,
  couponHours
}: {
  inviteBonus: number;
  discountPercent: number;
  couponHours: number;
}) {
  return (
    <ol className="grid gap-4 sm:grid-cols-3 sm:gap-5">
      <Step index={1} title="Kalp ver" scene={<SceneHeart />}>
        Üye ol, beğendiğin ürünün kilidine katıl.
      </Step>
      <Step index={2} title="Bar birlikte dolar" scene={<SceneInvite bonus={inviteBonus} />}>
        Başka üyeler de kalp verdikçe bar dolar. Hızlandırmak istersen arkadaşını çağır, +{inviteBonus} kalp eklesin.
      </Step>
      <Step index={3} title={`%${discountPercent}'ni kap`} scene={<SceneCoupon percent={discountPercent} hours={couponHours} />}>
        Bar dolunca kuponun hesabına gelir, {couponHours} saat geçerli.
      </Step>
    </ol>
  );
}

import type { Metadata } from "next";
import { Fraunces, Work_Sans } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--bm-gate-font-display"
});

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--bm-gate-font-body"
});

export const metadata: Metadata = {
  title: "BOLLMARK — Çok yakında",
  description:
    "Yeni sitemizi sizin için dikiyoruz. Bollmark, gündelik giyimde sade ve kendine has bir alışveriş deneyimiyle yakında burada."
};

const FIGURES = [
  { tx: 30, ty: 0, delay: 0 },
  { tx: 115, ty: 4, delay: 0.15 },
  { tx: 200, ty: -2, delay: 0.3 },
  { tx: 285, ty: 3, delay: 0.45 },
  { tx: 370, ty: 0, delay: 0.6 }
];

function Figure({ tx, ty, delay, index }: { tx: number; ty: number; delay: number; index: number }) {
  const side = index % 2 === 0 ? "left" : "right";
  const bagColor = side === "left" ? "var(--brass)" : "var(--clay)";
  const handPath = side === "left" ? "M10 58 Q -2 66, -1 82" : "M30 58 Q 42 66, 41 82";
  const bagTranslate = side === "left" ? "-1,82" : "41,82";

  return (
    <g transform={`translate(${tx},${ty})`}>
      <g className="fig" style={{ animationDelay: `${delay}s` }}>
        <circle cx="20" cy="34" r="12" stroke="var(--paper-dim)" strokeWidth="2.2" />
        <path d="M20 46 C 12 58, 12 82, 16 100" stroke="var(--paper-dim)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M20 46 C 28 58, 28 82, 24 100" stroke="var(--paper-dim)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M16 100 l -5 14" stroke="var(--paper-dim)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M24 100 l 6 14" stroke="var(--paper-dim)" strokeWidth="2.2" strokeLinecap="round" />
        <path d={handPath} stroke="var(--paper-dim)" strokeWidth="2.2" strokeLinecap="round" />
        <g transform={`translate(${bagTranslate})`}>
          <g className="bag" style={{ animationDelay: `${delay}s` }}>
            <rect x="-9" y="0" width="18" height="17" rx="2" stroke={bagColor} strokeWidth="2" />
            <path d="M-5 0 Q -5 -8, 0 -8 Q 5 -8, 5 0" stroke={bagColor} strokeWidth="2" />
          </g>
        </g>
      </g>
    </g>
  );
}

export default function YapimAsamasindaPage() {
  return (
    <div className={`${fraunces.variable} ${workSans.variable} gate`}>
      <style>{`
        .gate {
          --ink:#14171f;
          --ink-2:#1b1f29;
          --paper:#f3eee4;
          --paper-dim:#c9c2b3;
          --brass:#b08d57;
          --clay:#c1665a;
          --line:#33384a;
          position:relative;
          min-height:100vh;
          overflow:hidden;
          background: radial-gradient(120% 90% at 50% -10%, #1d2230 0%, var(--ink) 55%);
          color: var(--paper);
          font-family: var(--bm-gate-font-body), sans-serif;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:6vw;
        }
        .gate, .gate *{ box-sizing:border-box; }
        .gate .tag{
          position:absolute;
          top:32px;
          right:38px;
          display:flex;
          align-items:center;
          gap:8px;
          padding:8px 14px 8px 10px;
          border:1px solid var(--line);
          border-radius:3px;
          background:var(--ink-2);
          transform:rotate(3deg);
          animation:bmGateSwing 6s ease-in-out infinite;
          transform-origin:top center;
        }
        .gate .tag::before{
          content:"";
          width:7px; height:7px;
          border-radius:50%;
          border:1.5px solid var(--paper-dim);
          display:block;
        }
        .gate .tag span{
          font-size:11px;
          letter-spacing:.14em;
          text-transform:uppercase;
          color:var(--paper-dim);
        }
        @keyframes bmGateSwing{
          0%,100%{ transform:rotate(3deg); }
          50%{ transform:rotate(-2deg); }
        }
        @media (prefers-reduced-motion: reduce){
          .gate .tag{ animation:none; }
        }
        .gate main{
          text-align:center;
          max-width:640px;
        }
        .gate .eyebrow{
          font-size:12px;
          letter-spacing:.32em;
          text-transform:uppercase;
          color:var(--brass);
          margin-bottom:22px;
        }
        .gate h1{
          font-family: var(--bm-gate-font-display), serif;
          font-optical-sizing:auto;
          font-weight:500;
          font-size:clamp(48px, 11vw, 96px);
          letter-spacing:.02em;
          line-height:.95;
          color:var(--paper);
          margin:0;
        }
        .gate .stitch{
          width:120px;
          height:1px;
          margin:30px auto;
          background-image:repeating-linear-gradient(90deg, var(--line) 0 8px, transparent 8px 14px);
        }
        .gate p.tagline{
          font-size:16px;
          line-height:1.65;
          color:var(--paper-dim);
          font-weight:400;
          max-width:420px;
          margin:0 auto;
        }
        .gate p.tagline strong{
          color:var(--clay);
          font-weight:500;
        }
        .gate footer{
          position:absolute;
          bottom:28px;
          left:0; right:0;
          text-align:center;
          font-size:11px;
          letter-spacing:.18em;
          text-transform:uppercase;
          color:var(--line);
          margin:0;
        }
        .gate .queue{
          width:100%;
          max-width:380px;
          margin:38px auto 6px;
        }
        .gate .queue svg{ width:100%; height:auto; display:block; }
        .gate .queue .fig{
          animation:bmGateBob 1.6s ease-in-out infinite;
          transform-origin:50% 100%;
          transform-box:fill-box;
        }
        .gate .queue .bag{
          animation:bmGateSwingBag 1.6s ease-in-out infinite;
          transform-origin:50% 0%;
          transform-box:fill-box;
        }
        @keyframes bmGateBob{
          0%,100%{ transform:translateY(0); }
          50%{ transform:translateY(-5px); }
        }
        @keyframes bmGateSwingBag{
          0%,100%{ transform:rotate(-6deg); }
          50%{ transform:rotate(6deg); }
        }
        .gate .queue-caption{
          font-size:11px;
          letter-spacing:.14em;
          text-transform:uppercase;
          color:var(--line);
          text-align:center;
          margin-top:6px;
        }
      `}</style>

      <div className="tag">
        <span>Yapım aşamasında</span>
      </div>

      <main>
        <div className="eyebrow">Bollmark</div>
        <h1>
          Çok
          <br />
          yakında
        </h1>
        <div className="stitch" />
        <p className="tagline">
          Yeni sitemizi sizin için dikiyoruz. <strong>Bollmark</strong>, gündelik giyimde sade ve
          kendine has bir alışveriş deneyimiyle yakında burada.
        </p>

        <div className="queue">
          <svg viewBox="0 0 420 130" fill="none">
            <path
              d="M8 118 Q 60 122 120 118 T 230 119 T 340 117 T 412 119"
              stroke="var(--line)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {FIGURES.map((figure, index) => (
              <Figure key={figure.tx} {...figure} index={index} />
            ))}
          </svg>
          <div className="queue-caption">alışveriş sırasında bekliyoruz</div>
        </div>
      </main>

      <footer>bollmark.com</footer>
    </div>
  );
}

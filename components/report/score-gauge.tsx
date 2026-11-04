import type { Tone } from "@/lib/format";
import { TONE_HEX } from "@/lib/format";

const MIN = 300;
const MAX = 900;

function point(cx: number, cy: number, r: number, f: number) {
  const a = Math.PI - f * Math.PI;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
}

function arc(cx: number, cy: number, r: number, f0: number, f1: number) {
  const [x0, y0] = point(cx, cy, r, f0);
  const [x1, y1] = point(cx, cy, r, f1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function ScoreGauge({ score, tone, label }: { score: number; tone: Tone; label: string }) {
  const f = Math.max(0, Math.min(1, (score - MIN) / (MAX - MIN)));
  const cx = 120;
  const cy = 116;
  const r = 100;
  const [kx, ky] = point(cx, cy, r, f);
  return (
    <div className="relative mx-auto w-full max-w-[260px]">
      <svg viewBox="0 0 240 132" className="w-full" role="img" aria-label={`${label}: ${score} out of ${MAX}`}>
        <path d={arc(cx, cy, r, 0, 1)} fill="none" stroke="#ececef" strokeWidth="12" strokeLinecap="round" />
        {f > 0.001 && <path d={arc(cx, cy, r, 0, f)} fill="none" stroke={TONE_HEX[tone]} strokeWidth="12" strokeLinecap="round" />}
        <circle cx={kx} cy={ky} r="8" fill="#fff" stroke={TONE_HEX[tone]} strokeWidth="3" />
        <text x={cx - r} y={cy + 14} textAnchor="middle" className="fill-zinc-400 text-[10px]">
          {MIN}
        </text>
        <text x={cx + r} y={cy + 14} textAnchor="middle" className="fill-zinc-400 text-[10px]">
          {MAX}
        </text>
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center" aria-hidden="true">
        <div className="text-[44px] font-semibold leading-none tracking-[-0.03em] tnum">{score}</div>
      </div>
    </div>
  );
}

"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtMonth, inr, inrCompact } from "@/lib/format";
import type { MonthRow } from "@/lib/types";

export const SERIES = ["#3350d6", "#7c8fe9", "#b3c0f5", "#1e2a6e", "#71717a", "#a1a1aa", "#d4d4d8", "#52525b"];

const AXIS = { fontSize: 12, fill: "#71717a" };

type TipItem = { name?: string; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> };

function TooltipCard({
  active,
  payload,
  label,
  format = (v: number) => inr(v),
  labelFormat,
}: {
  active?: boolean;
  payload?: TipItem[];
  label?: string | number;
  format?: (v: number) => string;
  labelFormat?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[160px] rounded-lg border border-line bg-white px-3 py-2.5 text-[13px] shadow-[0_4px_16px_-4px_rgba(16,24,40,0.12)]">
      {label != null && <p className="mb-1.5 font-medium text-ink">{labelFormat ? labelFormat(String(label)) : label}</p>}
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-zinc-600">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-medium tnum">{typeof p.value === "number" ? format(p.value) : p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CashflowChart({ data }: { data: MonthRow[] }) {
  const hasBalance = data.some((d) => d.closing_balance != null);
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#efeff1" />
          <XAxis dataKey="month" tickFormatter={fmtMonth} tick={AXIS} tickLine={false} axisLine={{ stroke: "#e6e7ea" }} />
          <YAxis yAxisId="flow" tickFormatter={inrCompact} tick={AXIS} tickLine={false} axisLine={false} width={52} />
          {hasBalance && <YAxis yAxisId="bal" orientation="right" tickFormatter={inrCompact} tick={AXIS} tickLine={false} axisLine={false} width={52} />}
          <Tooltip cursor={{ fill: "#f4f4f5" }} content={<TooltipCard labelFormat={fmtMonth} />} />
          <Bar yAxisId="flow" dataKey="income" name="Money in" fill="#3350d6" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Bar yAxisId="flow" dataKey="expense" name="Money out" fill="#c9d1f6" radius={[3, 3, 0, 0]} maxBarSize={28} />
          {hasBalance && (
            <Line yAxisId="bal" dataKey="closing_balance" name="Closing balance" type="monotone" stroke="#0b0c0e" strokeWidth={1.75} dot={{ r: 2.5, fill: "#0b0c0e" }} activeDot={{ r: 4 }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, label }: { data: { name: string; value: number }[]; label: string }) {
  return (
    <div className="h-[220px] w-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={68} outerRadius={104} paddingAngle={1} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell key={i} fill={SERIES[i % SERIES.length]} />
            ))}
          </Pie>
          <Tooltip content={<TooltipCard format={(v) => `${inr(v)}/mo`} />} />
        </PieChart>
      </ResponsiveContainer>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function HistogramChart({
  data,
  xKey,
  yKey,
  colors,
  yLabel,
  tickFormat,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  colors?: string[];
  yLabel: string;
  tickFormat?: (v: string) => string;
}) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke="#efeff1" />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: "#e6e7ea" }} interval={0} tickFormatter={tickFormat} />
          <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={40} />
          <Tooltip cursor={{ fill: "#f4f4f5" }} content={<TooltipCard format={(v) => String(v)} />} />
          <Bar dataKey={yKey} name={yLabel} radius={[3, 3, 0, 0]} fill="#3350d6">
            {colors && data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CalibrationChart({ data }: { data: { bin_pred: number; bin_obs: number; n: number }[] }) {
  const max = Math.max(0.05, ...data.map((d) => Math.max(d.bin_pred, d.bin_obs))) * 1.08;
  const diag = [
    { x: 0, y: 0 },
    { x: max, y: max },
  ];
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart margin={{ top: 8, right: 12, bottom: 16, left: 0 }}>
          <CartesianGrid stroke="#efeff1" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, max]}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: "#e6e7ea" }}
            label={{ value: "Predicted default rate", position: "insideBottom", offset: -10, fontSize: 12, fill: "#71717a" }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, max]}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as { x: number; y: number; n?: number } | undefined;
              if (!active || !p || p.n == null) return null;
              return (
                <div className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] shadow-sm">
                  <p className="tnum">Predicted {(p.x * 100).toFixed(1)}%</p>
                  <p className="tnum">Observed {(p.y * 100).toFixed(1)}%</p>
                  <p className="text-zinc-500 tnum">n = {p.n.toLocaleString("en-IN")}</p>
                </div>
              );
            }}
          />
          <Line data={diag} dataKey="y" stroke="#a1a1aa" strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} name="Perfect calibration" />
          <Line
            data={data.map((d) => ({ x: d.bin_pred, y: d.bin_obs, n: d.n }))}
            dataKey="y"
            stroke="#3350d6"
            strokeWidth={2}
            dot={{ r: 3.5, fill: "#3350d6" }}
            name="Model"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HBarChart({
  data,
  format,
  height,
  reference,
  domain,
}: {
  data: { label: string; value: number }[];
  format: (v: number) => string;
  height?: number;
  reference?: number;
  domain?: [number, number];
}) {
  const h = height ?? Math.max(160, data.length * 30 + 24);
  return (
    <div className="w-full" style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid horizontal={false} stroke="#efeff1" />
          <XAxis type="number" domain={domain ?? [0, "auto"]} allowDataOverflow tickFormatter={format} tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" tick={{ ...AXIS, fill: "#3f3f46" }} tickLine={false} axisLine={false} width={180} />
          <Tooltip cursor={{ fill: "#f4f4f5" }} content={<TooltipCard format={format} />} />
          {reference != null && <ReferenceLine x={reference} stroke="#a1a1aa" strokeDasharray="4 4" />}
          <Bar dataKey="value" name="Value" fill="#3350d6" radius={[0, 3, 3, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

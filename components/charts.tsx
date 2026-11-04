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

/** Apple system colours, in the order used by Screen Time–style category breakdowns. */
export const SERIES = ["var(--accent)", "#30b0c7", "#5856d6", "#34c759", "#ff9500", "#ff2d55", "#af52de", "#8e8e93"];

const AXIS = { fontSize: 12, fill: "var(--faint)" };
const GRID = "var(--sep)";
const CURSOR = { fill: "var(--fill-2)" };

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
    <div className="min-w-[170px] rounded-xl bg-panel px-3.5 py-2.5 text-[13px] shadow-sheet">
      {label != null && <p className="mb-1.5 font-semibold text-fg">{labelFormat ? labelFormat(String(label)) : label}</p>}
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold text-fg tnum">{typeof p.value === "number" ? format(p.value) : p.value}</span>
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
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="month" tickFormatter={fmtMonth} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis yAxisId="flow" tickFormatter={inrCompact} tick={AXIS} tickLine={false} axisLine={false} width={52} />
          {hasBalance && <YAxis yAxisId="bal" orientation="right" tickFormatter={inrCompact} tick={AXIS} tickLine={false} axisLine={false} width={52} />}
          <Tooltip cursor={CURSOR} content={<TooltipCard labelFormat={fmtMonth} />} />
          <Bar yAxisId="flow" dataKey="income" name="Money in" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Bar yAxisId="flow" dataKey="expense" name="Money out" fill="var(--series-3)" radius={[4, 4, 0, 0]} maxBarSize={26} />
          {hasBalance && (
            <Line yAxisId="bal" dataKey="closing_balance" name="Closing balance" type="monotone" stroke="var(--green)" strokeWidth={2.25} dot={false} activeDot={{ r: 4, fill: "var(--green)", stroke: "var(--panel)", strokeWidth: 2 }} />
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
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={68} outerRadius={104} paddingAngle={1.5} cornerRadius={3} stroke="var(--panel)" strokeWidth={2} isAnimationActive={false}>
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
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={0} tickFormatter={tickFormat} />
          <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={40} />
          <Tooltip cursor={CURSOR} content={<TooltipCard format={(v) => String(v)} />} />
          <Bar dataKey={yKey} name={yLabel} radius={[5, 5, 0, 0]} fill="var(--accent)" maxBarSize={56}>
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
          <CartesianGrid stroke={GRID} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, max]}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            label={{ value: "Predicted default rate", position: "insideBottom", offset: -10, fontSize: 12, fill: "var(--faint)" }}
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
                <div className="rounded-xl bg-panel px-3.5 py-2.5 text-[13px] text-fg shadow-sheet">
                  <p className="tnum">Predicted {(p.x * 100).toFixed(1)}%</p>
                  <p className="tnum">Observed {(p.y * 100).toFixed(1)}%</p>
                  <p className="text-muted tnum">n = {p.n.toLocaleString("en-IN")}</p>
                </div>
              );
            }}
          />
          <Line data={diag} dataKey="y" stroke="var(--faint)" strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} name="Perfect calibration" />
          <Line
            data={data.map((d) => ({ x: d.bin_pred, y: d.bin_obs, n: d.n }))}
            dataKey="y"
            stroke="var(--accent)"
            strokeWidth={2.25}
            dot={{ r: 3.5, fill: "var(--accent)", stroke: "var(--panel)", strokeWidth: 1.5 }}
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
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" domain={domain ?? [0, "auto"]} allowDataOverflow tickFormatter={format} tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" tick={{ ...AXIS, fill: "var(--fg-2)" }} tickLine={false} axisLine={false} width={180} />
          <Tooltip cursor={CURSOR} content={<TooltipCard format={format} />} />
          {reference != null && <ReferenceLine x={reference} stroke="var(--faint)" strokeDasharray="4 4" />}
          <Bar dataKey="value" name="Value" fill="var(--accent)" radius={[0, 5, 5, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

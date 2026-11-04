import {staticFile} from 'remotion';

export type Metrics = {
  /** Logistic scorecard ROC-AUC on the held-out test set. */
  rocAuc: number;
  /** Kolmogorov–Smirnov statistic (0–1). */
  ks: number;
  /** Brier score (lower is better). */
  brier: number;
  /** ROC-AUC restricted to thin-file applicants (no prior credits). */
  thinFileAuc: number;
  /** Gradient boosting benchmark ROC-AUC, if reported. */
  gbRocAuc: number | null;
};

export type MetricsSource = 'model.json' | 'placeholder';

/** Placeholder values used when ../public/model.json has not been produced yet. */
export const FALLBACK_METRICS: Metrics = {
  rocAuc: 0.78,
  ks: 0.45,
  brier: 0.17,
  thinFileAuc: 0.74,
  gbRocAuc: 0.79,
};

type Flat = Record<string, number>;

const flatten = (value: unknown, prefix: string, out: Flat): Flat => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    out[prefix.toLowerCase()] = value;
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
};

const GB = /gb|gradient|boost|xgb|lgbm|hgb/;
const LR = /logistic|scorecard|(^|[._])lr([._]|$)/;
const SPLIT_EXCLUDE = /train|cv_std|std/;

const pick = (flat: Flat, include: RegExp, exclude?: RegExp, prefer?: RegExp): number | undefined => {
  const keys = Object.keys(flat).filter((k) => include.test(k) && !(exclude && exclude.test(k)));
  if (keys.length === 0) return undefined;
  const preferred = prefer ? keys.find((k) => prefer.test(k)) : undefined;
  return flat[preferred ?? keys[0]];
};

/**
 * Tolerant parser: accepts flat ({roc_auc, ks, brier, thin_file_auc}) or nested
 * per-model ({logistic: {...}, gradient_boosting: {...}}) metric layouts.
 */
export const parseMetrics = (raw: unknown): Metrics | null => {
  const flat = flatten(raw, '', {});
  const excludeLrAuc = new RegExp(`thin|pr_?auc|${GB.source}|${SPLIT_EXCLUDE.source}`);
  const rocAuc = pick(flat, /auc/, excludeLrAuc, LR);
  if (rocAuc === undefined) return null;
  const ks = pick(flat, /(^|[._])ks([._]|$)|ks_stat|kolmogorov/, new RegExp(`${GB.source}|${SPLIT_EXCLUDE.source}`), LR);
  const brier = pick(flat, /brier/, new RegExp(`${GB.source}|${SPLIT_EXCLUDE.source}`), LR);
  const thinFileAuc = pick(flat, /thin.*auc|auc.*thin/, new RegExp(`${GB.source}|${SPLIT_EXCLUDE.source}`), LR);
  const gbRocAuc = pick(flat, new RegExp(`(${GB.source}).*auc|auc.*(${GB.source})`), /thin|pr_?auc|train|std/);
  return {
    rocAuc,
    ks: ks ?? FALLBACK_METRICS.ks,
    brier: brier ?? FALLBACK_METRICS.brier,
    thinFileAuc: thinFileAuc ?? FALLBACK_METRICS.thinFileAuc,
    gbRocAuc: gbRocAuc ?? null,
  };
};

/** Loads metrics from video/public/model.json (synced from ../public/model.json). */
export const loadMetrics = async (): Promise<{metrics: Metrics; metricsSource: MetricsSource}> => {
  try {
    const res = await fetch(staticFile('model.json'));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {metrics?: unknown};
    const parsed = parseMetrics(json.metrics ?? json);
    if (parsed) return {metrics: parsed, metricsSource: 'model.json'};
  } catch {
    // fall through to placeholders
  }
  return {metrics: FALLBACK_METRICS, metricsSource: 'placeholder'};
};

/** True if video/public/demo.png exists. */
export const hasDemoScreenshot = async (): Promise<boolean> => {
  try {
    const res = await fetch(staticFile('demo.png'), {method: 'HEAD'});
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('image');
  } catch {
    return false;
  }
};

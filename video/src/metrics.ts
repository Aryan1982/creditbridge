import {staticFile} from 'remotion';

/** The subset of engine/models/model_card.json the video displays. */
export type Metrics = {
  risk: {
    /** 5-fold out-of-fold ROC-AUC of the deployed scorecard. */
    auc: number;
    ks: number;
    gini: number;
    /** Gradient-boosting benchmark AUC, if reported. */
    gbmAuc: number | null;
  };
  categorizer: {
    /** Accuracy on held-out, never-seen merchants. */
    accuracy: number;
    macroF1: number;
  };
  data: {
    applicants: number;
    transactions: number;
    synthetic: boolean;
  };
  /** Real-data check on a public credit dataset (Statlog German Credit), if present. */
  external: {
    dataset: string;
    altAuc: number;
    bureauAuc: number;
    thinAltAuc: number | null;
    thinBureauAuc: number | null;
    thinN: number | null;
  } | null;
  /** Approval rates by simulated gender (audit only, never a model input). */
  fairness: {female: number; male: number} | null;
  /** Stated limitations, verbatim from the model card. */
  limitations: string[];
};

export type MetricsSource = 'model_card.json' | 'placeholder';

/** Placeholder values used when model_card.json has not been synced. Shown with a "Placeholder" badge. */
export const FALLBACK_METRICS: Metrics = {
  risk: {auc: 0.72, ks: 0.33, gini: 0.44, gbmAuc: 0.72},
  categorizer: {accuracy: 0.86, macroF1: 0.8},
  data: {applicants: 6000, transactions: 2_850_000, synthetic: true},
  external: {
    dataset: 'Statlog German Credit (OpenML credit-g, 1,000 real applicants)',
    altAuc: 0.75,
    bureauAuc: 0.62,
    thinAltAuc: 0.68,
    thinBureauAuc: 0.34,
    thinN: 89,
  },
  fairness: null,
  limitations: ['The risk model is trained on simulated statements; it must be re-fitted and validated on real repayment outcomes before lending decisions.'],
};

type Obj = Record<string, unknown>;

const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Parses the v2 model card shape (risk.auc/ks/gini, categorizer.accuracy/macro_f1, external_validation). */
export const parseModelCard = (raw: unknown): Metrics | null => {
  const card = obj(raw);
  const risk = obj(card?.risk);
  const cat = obj(card?.categorizer);
  const auc = num(risk?.auc);
  const ks = num(risk?.ks);
  const gini = num(risk?.gini);
  const accuracy = num(cat?.accuracy);
  const macroF1 = num(cat?.macro_f1);
  if (auc === null || ks === null || gini === null || accuracy === null || macroF1 === null) return null;

  const data = obj(card?.data);
  const ext = obj(card?.external_validation);
  const thin = obj(ext?.thin_file);
  const altAuc = num(ext?.alt_only_auc);
  const bureauAuc = num(ext?.bureau_only_auc);

  const byGender = (Array.isArray(obj(card?.fairness)?.by_gender) ? (obj(card?.fairness)?.by_gender as unknown[]) : []).map(obj);
  const female = num(byGender.find((r) => r?.gender === 'F')?.approval_rate);
  const male = num(byGender.find((r) => r?.gender === 'M')?.approval_rate);

  return {
    risk: {auc, ks, gini, gbmAuc: num(obj(obj(risk?.benchmark)?.hist_gradient_boosting)?.auc)},
    categorizer: {accuracy, macroF1},
    data: {
      applicants: num(data?.n_applicants) ?? FALLBACK_METRICS.data.applicants,
      transactions: num(data?.n_transactions) ?? FALLBACK_METRICS.data.transactions,
      synthetic: data?.synthetic !== false,
    },
    external:
      altAuc !== null && bureauAuc !== null
        ? {
            dataset: typeof ext?.dataset === 'string' ? ext.dataset : 'External dataset',
            altAuc,
            bureauAuc,
            thinAltAuc: num(thin?.alt_only_auc),
            thinBureauAuc: num(thin?.bureau_only_auc),
            thinN: num(thin?.n),
          }
        : null,
    fairness: female !== null && male !== null ? {female, male} : null,
    limitations: Array.isArray(card?.limitations)
      ? card.limitations.filter((l): l is string => typeof l === 'string')
      : FALLBACK_METRICS.limitations,
  };
};

/** Loads metrics from video/public/model_card.json (synced from ../engine/models/model_card.json). */
export const loadMetrics = async (): Promise<{metrics: Metrics; metricsSource: MetricsSource}> => {
  try {
    const res = await fetch(staticFile('model_card.json'));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = parseModelCard(await res.json());
    if (parsed) return {metrics: parsed, metricsSource: 'model_card.json'};
  } catch {
    // fall through to placeholders
  }
  return {metrics: FALLBACK_METRICS, metricsSource: 'placeholder'};
};

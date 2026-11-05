export type Status = "pass" | "warn" | "fail";
export type Decision = "approve" | "review" | "decline";
export type Band = "A" | "B" | "C" | "D" | "E";
export type Lang = "en" | "hi" | "te";

export interface Sample {
  id: string;
  name: string;
  persona: string;
  description: string;
  format: "csv" | "pdf" | "aa_json";
  tampered: boolean;
  loan?: LoanRequest;
  file?: string;
  variant_of?: string | null;
}

export interface EvidenceRow {
  date: string;
  narration: string;
  /** Signed: positive = credit, negative = debit. */
  amount: number;
  note?: string;
}

export interface IntegrityCheck {
  id: string;
  /** Phrased as the passing condition. */
  label: string;
  /** Phrased as the failure; shown when status is warn or fail. */
  problem?: string | null;
  status: Status;
  detail: string;
  critical?: boolean;
  evidence: EvidenceRow[];
}

export interface Integrity {
  status: Status;
  score: number;
  checks: IntegrityCheck[];
}

export interface IncomeSource {
  name: string;
  type: string;
  monthly_avg: number;
  count: number;
}

export interface MonthRow {
  month: string;
  income: number;
  expense: number;
  closing_balance: number | null;
}

export interface Reason {
  key: string;
  label: string;
  value_display: string;
  impact: number;
  direction: "helps" | "hurts";
  detail: string;
}

export interface Feature {
  key: string;
  label: string;
  value: number;
  value_display: string;
  impact: number;
}

export interface Improvement {
  key: string;
  label: string;
  current: string;
  target: string;
  score_after: number;
}

export interface Txn {
  date: string;
  narration: string;
  debit: number;
  credit: number;
  balance: number | null;
  category: string;
  category_label: string;
  confidence: number;
  flags: string[];
}

export interface Report {
  applicant: {
    name: string;
    persona: string | null;
    bank: string | null;
    months_covered: number;
    start_date: string;
    end_date: string;
    transaction_count: number;
  };
  integrity: Integrity;
  income: {
    monthly_avg: number;
    monthly_median: number;
    stability: number;
    primary_type: string;
    sources: IncomeSource[];
    monthly: MonthRow[];
  };
  spending: {
    categories: { category: string; label: string; monthly_avg: number; share: number }[];
    essentials_share: number;
    discretionary_share: number;
  };
  obligations: {
    existing_emi_monthly: number;
    lenders: string[];
    bounces: number;
    foir: number;
  };
  risk: {
    pd: number;
    score: number;
    band: Band;
    decision: Decision;
    reasons: Reason[];
    /** Present when an authenticity failure downgraded the decision. */
    decision_note?: string;
  };
  features: Feature[];
  affordability: {
    max_emi: number;
    requested_emi: number;
    recommended_amount: number;
    tenure_months: number;
    rate_pct: number;
    within_limit: boolean;
  };
  improvements: Improvement[];
  transactions: Txn[];
  summary: Record<Lang, string>;
}

export interface LoanRequest {
  amount: number;
  tenure_months: number;
  purpose: string;
}

export interface PortfolioApplicant {
  id: string;
  name: string;
  persona: string;
  score: number;
  band: Band;
  decision: Decision;
  pd: number;
  integrity_status: Status;
  max_emi: number;
  requested_emi: number;
  format?: Sample["format"];
  tampered?: boolean;
  integrity_score?: number;
  loan_amount?: number;
  recommended_amount?: number;
}

export interface Portfolio {
  applicants: PortfolioApplicant[];
  summary: PortfolioSummary;
}

/** Server-computed portfolio KPIs (api/index.py `portfolio`). */
export interface PortfolioSummary {
  applicants: number;
  decisions: Record<Decision, number>;
  approval_rate: number;
  avg_score: number | null;
  avg_pd: number | null;
  /** Applicants whose statement failed integrity. */
  integrity_flagged: number;
  requested_total: number;
  approved_total: number;
  expected_loss_approved: number;
}

export interface ModelCard {
  version: string;
  data: Record<string, unknown> & {
    description?: string;
    n_applicants?: number;
    n_transactions?: number;
    synthetic?: boolean;
  };
  categorizer: {
    model: string;
    accuracy: number;
    macro_f1: number;
    eval: string;
    per_class: { category: string; f1: number; support: number; label?: string }[];
  } & Record<string, unknown>;
  risk: {
    model: string;
    benchmark: Record<string, unknown>;
    auc: number;
    ks: number;
    gini: number;
    brier: number;
    calibration: { bin_pred: number; bin_obs: number; n: number }[];
    by_persona: { persona: string; auc: number; n: number; approval_rate: number }[];
    ablations: { name: string; auc: number }[];
    feature_importance: { key: string; label: string; importance: number }[];
  } & Record<string, unknown>;
  fairness: {
    by_gender?: Record<string, unknown>[];
    by_persona?: Record<string, unknown>[];
    notes?: string;
  } & Record<string, unknown>;
  external_validation: {
    dataset: string;
    alt_only_auc: number;
    bureau_only_auc: number;
    thin_file?: Record<string, unknown>;
  } & Record<string, unknown>;
  limitations: string[];
}

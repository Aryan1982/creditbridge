import type { LoanRequest, Report } from "./types";

const KEY = "creditbridge.report.v2";

export interface StoredReport {
  report: Report;
  loan: LoanRequest;
  source: { kind: "upload" | "aa" | "sample"; label: string; sampleId?: string };
  createdAt: string;
}

/** Fallback when sessionStorage is unavailable: survives client-side navigation, not a reload. */
let memory: StoredReport | null = null;

/**
 * Stores the applicant's own report. Returns false when it could only be kept in memory
 * (storage disabled or full), in which case it will not survive a page reload.
 */
export function saveReport(value: StoredReport): boolean {
  memory = value;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Shape check for data read back from storage, which may be stale or from an older build. */
function isStoredReport(v: unknown): v is StoredReport {
  if (!isObj(v) || !isObj(v.report) || !isObj(v.loan) || !isObj(v.source) || typeof v.createdAt !== "string") return false;
  const r = v.report;
  return (
    isObj(r.applicant) &&
    typeof r.applicant.transaction_count === "number" &&
    isObj(r.integrity) &&
    Array.isArray(r.integrity.checks) &&
    isObj(r.income) &&
    Array.isArray(r.income.monthly) &&
    Array.isArray(r.income.sources) &&
    isObj(r.spending) &&
    Array.isArray(r.spending.categories) &&
    isObj(r.obligations) &&
    isObj(r.risk) &&
    typeof r.risk.score === "number" &&
    Array.isArray(r.risk.reasons) &&
    isObj(r.affordability) &&
    Array.isArray(r.improvements) &&
    Array.isArray(r.transactions) &&
    isObj(r.summary) &&
    typeof v.loan.amount === "number" &&
    typeof v.source.label === "string"
  );
}

export function loadReport(): StoredReport | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isStoredReport(parsed)) return parsed;
      sessionStorage.removeItem(KEY);
    }
  } catch {
    /* storage disabled or corrupt JSON: fall back to memory */
  }
  return memory;
}

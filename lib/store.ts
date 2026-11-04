import type { LoanRequest, Report } from "./types";

const KEY = "creditbridge.report.v2";

export interface StoredReport {
  report: Report;
  loan: LoanRequest;
  source: { kind: "upload" | "aa" | "sample"; label: string; sampleId?: string };
  createdAt: string;
}

export function saveReport(value: StoredReport): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage full or disabled: report just won't survive reload */
  }
}

export function loadReport(): StoredReport | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredReport) : null;
  } catch {
    return null;
  }
}

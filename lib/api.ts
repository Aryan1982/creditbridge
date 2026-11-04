import type { LoanRequest, ModelCard, Portfolio, Report, Sample } from "./types";

export class ApiError extends Error {}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Something went wrong (HTTP ${res.status}). Please try again.`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") message = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message);
  }
  return res.json() as Promise<T>;
}

export async function getSamples(): Promise<Sample[]> {
  return handle<Sample[]>(await fetch("/api/samples"));
}

export interface AnalyzeInput {
  file?: File;
  sampleId?: string;
  loan: LoanRequest;
}

export async function analyze({ file, sampleId, loan }: AnalyzeInput): Promise<Report> {
  const form = new FormData();
  if (file) form.append("file", file);
  if (sampleId) form.append("sample_id", sampleId);
  form.append("loan_amount", String(loan.amount));
  form.append("tenure_months", String(loan.tenure_months));
  form.append("purpose", loan.purpose);
  return handle<Report>(await fetch("/api/analyze", { method: "POST", body: form }));
}

export async function getPortfolio(): Promise<Portfolio> {
  return handle<Portfolio>(await fetch("/api/portfolio", { method: "POST" }));
}

export async function getModelCard(): Promise<ModelCard> {
  return handle<ModelCard>(await fetch("/api/model-card"));
}

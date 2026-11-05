import type { LoanRequest, ModelCard, Portfolio, Report, Sample } from "./types";

/** Largest statement the API accepts (kept under Vercel's 4.5 MB request-body limit). */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "4 MB";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const NETWORK_MESSAGE = "We couldn't reach the server. Check your connection and try again.";
const BAD_RESPONSE_MESSAGE = "The server sent an unexpected response. Please try again in a moment.";

function statusMessage(status: number): string {
  if (status === 413) return `This file is larger than ${MAX_UPLOAD_LABEL}. Please upload a smaller file — a CSV export is usually much smaller than a PDF.`;
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "The server ran into a problem. Please try again in a moment.";
  return `Something went wrong (HTTP ${status}). Please try again.`;
}

/** Single fetch wrapper: every failure surfaces as an ApiError with a user-facing message. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(NETWORK_MESSAGE);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(res.ok ? BAD_RESPONSE_MESSAGE : statusMessage(res.status), res.status);
  }

  if (!res.ok) {
    const detail = (body as { detail?: unknown } | null)?.detail;
    throw new ApiError(typeof detail === "string" && detail ? detail : statusMessage(res.status), res.status);
  }
  return body as T;
}

export function getSamples(): Promise<Sample[]> {
  return request<Sample[]>("/api/samples");
}

export interface AnalyzeInput {
  file?: File;
  sampleId?: string;
  loan: LoanRequest;
}

export function analyze({ file, sampleId, loan }: AnalyzeInput): Promise<Report> {
  const form = new FormData();
  if (file) form.append("file", file);
  if (sampleId) form.append("sample_id", sampleId);
  form.append("loan_amount", String(loan.amount));
  form.append("tenure_months", String(loan.tenure_months));
  form.append("purpose", loan.purpose);
  return request<Report>("/api/analyze", { method: "POST", body: form });
}

export function getPortfolio(): Promise<Portfolio> {
  return request<Portfolio>("/api/portfolio", { method: "POST" });
}

export function getModelCard(): Promise<ModelCard> {
  return request<ModelCard>("/api/model-card");
}

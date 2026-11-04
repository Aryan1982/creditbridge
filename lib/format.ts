import type { Band, Decision, Status } from "./types";

const inrFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function inr(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return inrFmt.format(Math.round(n));
}

/** ₹1.2L / ₹3.4Cr style, for chart axes and dense UI. */
export function inrCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const short = (v: number) => String(+v.toFixed(v >= 10 ? 0 : 1));
  if (abs >= 1e7) return `${sign}₹${short(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${short(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${short(abs / 1e3)}k`;
  return `${sign}₹${Math.round(abs)}`;
}

export function pct(x: number | null | undefined, digits = 0): string {
  if (x == null || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function num(x: number | null | undefined, digits = 3): string {
  if (x == null || Number.isNaN(x)) return "—";
  return x.toFixed(digits);
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" });

function parseISO(d: string): Date {
  // Treat YYYY-MM-DD as a calendar date, not UTC midnight.
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return dateFmt.format(parseISO(d));
}

export function fmtShortDate(d: string): string {
  return shortDateFmt.format(parseISO(d));
}

export function fmtMonth(m: string): string {
  return monthFmt.format(parseISO(`${m}-01`));
}

export function emi(principal: number, ratePct: number, months: number): number {
  const r = ratePct / 1200;
  if (r === 0) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PERSONAS: Record<string, string> = {
  gig_worker: "Gig worker",
  salaried: "Salaried",
  student: "Student",
  farmer: "Farmer",
  shopkeeper: "Shopkeeper",
  homemaker: "Homemaker",
};

export function personaLabel(p: string | null | undefined): string {
  if (!p) return "—";
  return PERSONAS[p] ?? titleCase(p);
}

const CATEGORY_LABEL: Record<string, string> = {
  salary: "Salary",
  gig_income: "Gig income",
  business_income: "Business income",
  agri_income: "Farm income",
  family_transfer_in: "Family transfers in",
  refund_cashback: "Refunds & cashback",
  interest_in: "Interest",
  rent: "Rent",
  groceries: "Groceries",
  utilities: "Utilities & bills",
  mobile_recharge: "Mobile recharge",
  fuel_transport: "Fuel & transport",
  food_delivery: "Food delivery",
  shopping: "Shopping",
  healthcare: "Healthcare",
  education: "Education",
  emi_loan: "Loan EMIs",
  loan_app: "Instant loan apps",
  insurance: "Insurance",
  investment_savings: "Savings & investments",
  betting_gaming: "Betting & gaming",
  cash_withdrawal: "Cash withdrawals",
  bank_charges: "Bank charges",
  bounce_charge: "Bounce charges",
  transfer_out: "Transfers out",
  transfer_in_other: "Other transfers in",
  other: "Other",
};

export function categoryLabel(c: string): string {
  return CATEGORY_LABEL[c] ?? titleCase(c);
}

export const DECISION_LABEL: Record<Decision, string> = {
  approve: "Approved",
  review: "Manual review",
  decline: "Declined",
};

export const STATUS_LABEL: Record<Status, string> = {
  pass: "Verified",
  warn: "Needs attention",
  fail: "Failed",
};

export type Tone = "positive" | "caution" | "negative" | "neutral" | "accent";

export function decisionTone(d: Decision): Tone {
  return d === "approve" ? "positive" : d === "review" ? "caution" : "negative";
}

export function statusTone(s: Status): Tone {
  return s === "pass" ? "positive" : s === "warn" ? "caution" : "negative";
}

export function bandTone(b: Band): Tone {
  return b === "A" || b === "B" ? "positive" : b === "C" ? "caution" : "negative";
}

/** CSS colour for each tone; resolves per light/dark appearance. */
export const TONE_COLOR: Record<Tone, string> = {
  positive: "var(--green)",
  caution: "var(--yellow)",
  negative: "var(--red)",
  neutral: "var(--faint)",
  accent: "var(--accent)",
};

export const FLAG_LABEL: Record<string, string> = {
  round_trip: "Circular transfer",
  balance_mismatch: "Balance mismatch",
  duplicate: "Duplicate",
  duplicate_id: "Duplicate reference",
  duplicate_row: "Duplicate entry",
  salary_outlier: "Unusual salary credit",
  date_gap: "Date gap",
  out_of_order: "Out of order",
  bounce: "Bounce",
  loan_app: "Loan app",
  betting: "Betting",
};

export function flagLabel(f: string): string {
  return FLAG_LABEL[f] ?? titleCase(f);
}

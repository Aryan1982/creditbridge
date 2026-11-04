import type { Metadata } from "next";
import { LenderConsole } from "@/components/lender/lender-console";

export const metadata: Metadata = {
  title: "Lender console",
  description: "Portfolio view of applicants scored from bank statement cash flow.",
};

export default function LenderPage() {
  return <LenderConsole />;
}

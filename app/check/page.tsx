import type { Metadata } from "next";
import { CheckFlow } from "@/components/check/check-flow";

export const metadata: Metadata = {
  title: "Check eligibility",
  description: "Connect a bank statement and see your loan eligibility in under a minute.",
};

export default function CheckPage() {
  return <CheckFlow />;
}

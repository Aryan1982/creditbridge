import type { Metadata } from "next";
import { ModelCardView } from "@/components/model/model-card-view";

export const metadata: Metadata = {
  title: "Model card",
  description: "Performance, calibration, fairness and limitations of the CreditBridge models.",
};

export default function ModelPage() {
  return <ModelCardView />;
}

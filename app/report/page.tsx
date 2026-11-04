import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportView } from "@/components/report/report-view";

export const metadata: Metadata = {
  title: "Your report",
};

export default function ReportPage() {
  return (
    <Suspense>
      <ReportView />
    </Suspense>
  );
}

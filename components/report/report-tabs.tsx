"use client";

import { useState } from "react";
import { T } from "@/lib/i18n";
import type { Lang, Report } from "@/lib/types";
import { TabPanel, Tabs } from "@/components/tabs";
import { CashflowTab } from "./cashflow-tab";
import { IncomeTab } from "./income-tab";
import { SpendingTab } from "./spending-tab";
import { TransactionsTab } from "./transactions-tab";
import { IntegrityTab } from "./integrity-tab";
import { StatusIcon } from "@/components/ui";

type TabId = "cashflow" | "income" | "spending" | "transactions" | "authenticity";

export function ReportTabs({ report, lang }: { report: Report; lang: Lang }) {
  const [tab, setTab] = useState<TabId>("cashflow");
  const t = T[lang].tabs;
  const flagged = report.transactions.filter((x) => x.flags.length > 0).length;
  return (
    <section aria-label="Details" className="space-y-1">
      <Tabs
        label="Report details"
        value={tab}
        onChange={(id) => setTab(id as TabId)}
        tabs={[
          { id: "cashflow", label: <span lang={lang}>{t.cashflow}</span> },
          { id: "income", label: <span lang={lang}>{t.income}</span> },
          { id: "spending", label: <span lang={lang}>{t.spending}</span> },
          { id: "transactions", label: <span lang={lang}>{t.transactions}</span>, count: report.transactions.length },
          {
            id: "authenticity",
            label: (
              <span className="flex items-center gap-1.5" lang={lang}>
                <StatusIcon status={report.integrity.status} className="h-3.5! w-3.5!" />
                {t.authenticity}
              </span>
            ),
          },
        ]}
      />
      <TabPanel key={tab} id={tab}>
        {tab === "cashflow" && <CashflowTab report={report} />}
        {tab === "income" && <IncomeTab report={report} />}
        {tab === "spending" && <SpendingTab report={report} />}
        {tab === "transactions" && <TransactionsTab transactions={report.transactions} flaggedCount={flagged} />}
        {tab === "authenticity" && <IntegrityTab integrity={report.integrity} />}
      </TabPanel>
    </section>
  );
}

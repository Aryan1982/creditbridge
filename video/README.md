# CreditBridge — demo video (Remotion)

90 s, 1920×1080, 30 fps pitch/demo video for CreditBridge v2 (cash-flow underwriting from bank
statements and Account Aggregator data). Composition id: `CreditBridge`.

## Storyboard

| Scene | Content |
| --- | --- |
| Hook | 190M Indian adults are credit-invisible; banks say no |
| Problem | Thin-file applicant rejected by the bureau, while their bank statement shows income, rent, insurance, savings |
| Solution | CreditBridge: cash-flow underwriting from PDF/CSV statements or the RBI Account Aggregator |
| Walkthrough | Pan/zoom with callouts over real screenshots of the live app: landing → `/check` sample profiles → Account Aggregator consent → analysis progress → `/report` decision (with Hindi/Telugu summaries) → cash-flow tab → authenticity tab on the edited sample `priya_salaried-edited` → `/lender` → `/model` |
| How it works | Pipeline: parse → verify → categorise → cash flow → score → affordability (FOIR) → explain |
| Results | Risk AUC/KS/Gini, categorizer accuracy/macro F1, German Credit real-data check (alt vs bureau, thin-file) |
| Responsible AI | Gender not an input (audit only), authenticity checks, data not stored, limitation: simulated training data |
| Outro | Live URL, repo URL, page list |

Scene lengths are in `src/Video.tsx` → `SCENES`. Walkthrough camera keyframes, callouts and cursor paths
are in `src/walkthrough.ts`; the screenshot camera/callout renderer is `src/components/ShotScene.tsx`.

## Preview

```bash
cd video
npm install
npm run studio          # = sync-metrics + remotion studio
```

## Render

```bash
cd video
npm run render          # = sync-metrics + remotion render CreditBridge out/creditbridge.mp4
```

Override URLs at render time:

```bash
npx remotion render CreditBridge out/creditbridge.mp4 \
  --props='{"liveUrl":"https://your-live-url","repoUrl":"https://github.com/you/creditbridge"}'
```

## Metrics

`npm run sync-metrics` copies `../engine/models/model_card.json` (written by the training pipeline) to
`video/public/model_card.json` (gitignored). The Results and Responsible AI scenes read `risk.auc/ks/gini`,
`risk.benchmark.hist_gradient_boosting.auc`, `categorizer.accuracy/macro_f1`, `data.n_applicants/n_transactions`,
`external_validation` (incl. `thin_file`), `fairness.by_gender[].approval_rate` and `limitations`
(parser: `src/metrics.ts`). If the file is missing or malformed, the video falls back to placeholder values
and shows a "Placeholder values" badge.

## Screenshots

`public/shots/*.png` are captures of https://creditbridge-bay.vercel.app at a 1440×900 viewport,
devicePixelRatio 2 (images are 2880 px wide; heights are full page or clipped):

| File | Page / state |
| --- | --- |
| `landing.png` | `/`, hero through "How it works" |
| `check-samples.png` | `/check`, "Try a sample profile" with Ravi Kumar selected |
| `check-consent.png` | `/check`, Account Aggregator consent screen |
| `analysis.png` | `/check` analysis step mid-run (Ravi Kumar) |
| `report.png` | `/report` for `ravi_gig` (₹40,000 over 12 months) — decision hero, reasons, cash-flow tab |
| `summary-hi.png`, `summary-te.png` | the same report summary with the Hindi / Telugu toggle |
| `report-edited.png` | `/report` for `priya_salaried-edited`, Statement authenticity tab |
| `lender.png` | `/lender` portfolio console |
| `model.png` | `/model`, overview through feature importance |

Callout boxes in `src/walkthrough.ts` are element bounding rects measured from the live DOM at capture
time (CSS px). If the UI changes, recapture the screenshots and re-measure those boxes. Charts were
captured with `prefers-reduced-motion: reduce` so Recharts draws without its entry animation.

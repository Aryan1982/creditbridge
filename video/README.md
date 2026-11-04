# CreditBridge — demo video (Remotion)

~75 s, 1920×1080, 30 fps pitch/demo video. Composition id: `CreditBridge`.

Scenes: Hook → Problem → Solution → How it works → Results → Demo → Responsible AI → Outro
(durations in `src/Video.tsx` → `SCENES`).

## Preview

```bash
cd video
npm install
npm run studio          # = sync-metrics + npx remotion studio
```

## Render

```bash
cd video
npm run render          # = sync-metrics + npx remotion render CreditBridge out/creditbridge.mp4
```

Override URLs at render time:

```bash
npx remotion render CreditBridge out/creditbridge.mp4 \
  --props='{"liveUrl":"https://your-live-url","repoUrl":"https://github.com/you/creditbridge"}'
```

## Metrics

`npm run sync-metrics` copies `../public/model.json` (written by the training pipeline) into
`video/public/model.json`. The Results scene reads its `metrics` key (ROC-AUC, KS, Brier, thin-file AUC,
optional gradient-boosting AUC). If the file is missing, the video uses placeholder values and shows a
"Placeholder values" badge — re-run `npm run sync-metrics` after training.

## Demo screenshot

Put a screenshot of the live app at **`video/public/demo.png`** (ideally 1600 px+ wide). It is shown
inside the browser frame in the Demo scene. Without it, a labelled placeholder slot is rendered.

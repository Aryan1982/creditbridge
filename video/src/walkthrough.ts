import type {ShotSceneSpec} from './components/ShotScene';

/*
 * Product walkthrough over real screenshots of https://creditbridge-bay.vercel.app
 * (public/shots/*.png, 1440 CSS px wide at devicePixelRatio 2). Boxes are element
 * bounding rects measured from the live DOM at capture time, in CSS pixels.
 * Frame numbers are relative to each scene.
 */

export const LANDING: ShotSceneSpec = {
  kicker: 'Landing',
  path: '/',
  title: 'Borrowers check eligibility; lenders open the console.',
  shot: {file: 'landing.png', height: 1729},
  camera: [
    {at: 0, x: 720, y: 400, zoom: 1},
    {at: 50, x: 720, y: 400, zoom: 1},
    {at: 75, x: 900, y: 960, zoom: 1.15},
    {at: 100, x: 900, y: 960, zoom: 1.15},
    {at: 120, x: 720, y: 1500, zoom: 1.05},
  ],
  callouts: [
    {from: 8, to: 52, box: [152, 252, 590, 118], label: 'No credit history needed', place: 'bottom'},
    {from: 78, to: 108, box: [686, 860, 602, 192], label: '190M Indian adults without a usable credit history', place: 'top', spot: true},
    {from: 110, to: 135, box: [152, 1390, 1136, 242], label: 'Connect → verify → read cash flow → decide', place: 'top'},
  ],
};

export const SAMPLES: ShotSceneSpec = {
  kicker: 'Connect',
  path: '/check',
  title: 'Upload a PDF or CSV statement, or try a sample profile.',
  shot: {file: 'check-samples.png', height: 2616},
  camera: [
    {at: 0, x: 720, y: 560, zoom: 1},
    {at: 55, x: 720, y: 560, zoom: 1},
    {at: 85, x: 720, y: 2200, zoom: 1.15},
  ],
  callouts: [
    {from: 6, to: 46, box: [368, 367, 704, 128], label: 'Upload · Account Aggregator · sample profiles', place: 'top'},
    {from: 88, to: 120, box: [368, 2142, 704, 238], label: 'Deliberately edited statements, to test the checks', tone: 'warn', place: 'top', spot: true},
  ],
  cursor: [
    {at: 14, x: 1180, y: 760},
    {at: 38, x: 560, y: 640, click: true},
    {at: 54, x: 560, y: 640},
  ],
};

export const CONSENT: ShotSceneSpec = {
  kicker: 'Connect',
  path: '/check',
  title: 'Or share over the RBI Account Aggregator network.',
  shot: {file: 'check-consent.png', height: 1404},
  camera: [
    {at: 0, x: 720, y: 520, zoom: 1},
    {at: 18, x: 720, y: 520, zoom: 1},
    {at: 45, x: 720, y: 820, zoom: 1.4},
    {at: 90, x: 720, y: 820, zoom: 1.4},
    {at: 112, x: 720, y: 1060, zoom: 1.3},
  ],
  callouts: [
    {from: 46, to: 92, box: [457, 688, 526, 247], label: 'Purpose, data range and expiry, shown before consent', place: 'right'},
    {from: 92, to: 135, box: [457, 894, 526, 41], label: 'Data deleted after the decision', tone: 'good', place: 'top'},
  ],
  cursor: [
    {at: 96, x: 1160, y: 1120},
    {at: 120, x: 896, y: 1240, click: true},
    {at: 135, x: 896, y: 1240},
  ],
};

export const ANALYSIS: ShotSceneSpec = {
  kicker: 'Analyse',
  path: '/check',
  title: 'Read, verified, categorised and scored in seconds.',
  shot: {file: 'analysis.png', height: 900},
  camera: [
    {at: 0, x: 720, y: 450, zoom: 1},
    {at: 15, x: 720, y: 450, zoom: 1},
    {at: 45, x: 720, y: 470, zoom: 1.6},
  ],
  callouts: [{from: 48, to: 105, box: [496, 390, 448, 216], label: 'The real pipeline running on the statement', place: 'right'}],
};

export const DECISION: ShotSceneSpec = {
  kicker: 'Decide',
  path: '/report',
  title: 'A 300–900 score, an affordable EMI, and the reasons.',
  shot: {file: 'report.png', height: 2305},
  camera: [
    {at: 0, x: 720, y: 430, zoom: 1},
    {at: 50, x: 720, y: 430, zoom: 1},
    {at: 70, x: 1117, y: 420, zoom: 1.45},
    {at: 100, x: 1117, y: 420, zoom: 1.45},
    {at: 120, x: 700, y: 430, zoom: 1.35},
    {at: 165, x: 700, y: 430, zoom: 1.35},
    {at: 185, x: 720, y: 920, zoom: 1},
  ],
  callouts: [
    {from: 10, to: 55, box: [153, 229, 300, 408], label: 'Score 710 · band B · approved', tone: 'good', place: 'right'},
    {from: 72, to: 108, box: [979, 301, 276, 124], label: 'Requested EMI vs what cash flow can carry (FOIR)', place: 'left'},
    {from: 122, to: 168, box: [485, 293, 429, 166], label: 'Plain-language summary in English, Hindi, Telugu', place: 'top'},
    {from: 188, to: 225, box: [152, 686, 552, 716], label: 'Reason codes', place: 'top'},
    {from: 196, to: 225, box: [736, 756, 552, 203], label: 'Steps to improve: 710 → 736', tone: 'good', place: 'bottom'},
  ],
};

/** Hindi and Telugu renderings of the same summary, captured from the language toggle. */
export const SUMMARY_INSETS = [
  {file: 'summary-hi.png', label: 'हिंदी'},
  {file: 'summary-te.png', label: 'తెలుగు'},
] as const;
export const SUMMARY_INSETS_WINDOW = {from: 128, to: 168};

export const CASHFLOW: ShotSceneSpec = {
  kicker: 'Cash flow',
  path: '/report',
  title: 'Every transaction categorised; every month measured.',
  shot: {file: 'report.png', height: 2305},
  camera: [
    {at: 0, x: 720, y: 1745, zoom: 1},
    {at: 75, x: 720, y: 1745, zoom: 1},
    {at: 100, x: 720, y: 1790, zoom: 1.2},
  ],
  callouts: [
    {from: 8, to: 46, box: [152, 1451, 630, 38], label: 'Cash flow · income · spending · transactions · authenticity', place: 'bottom'},
    {from: 46, to: 84, box: [152, 1513, 1136, 86], label: 'Money in vs out, surplus months, lowest balance', place: 'bottom'},
    {from: 100, to: 135, box: [152, 1622, 1136, 413], label: 'Money in, money out, closing balance', place: 'top'},
  ],
};

export const AUTHENTICITY: ShotSceneSpec = {
  kicker: 'Verify',
  path: '/report',
  title: 'An edited PDF statement gets caught, with evidence.',
  shot: {file: 'report-edited.png', height: 2949},
  camera: [
    {at: 0, x: 720, y: 420, zoom: 1},
    {at: 45, x: 720, y: 420, zoom: 1},
    {at: 70, x: 720, y: 1760, zoom: 1.1},
    {at: 100, x: 720, y: 1760, zoom: 1.1},
    {at: 120, x: 720, y: 1930, zoom: 1.15},
    {at: 150, x: 720, y: 1930, zoom: 1.15},
    {at: 170, x: 720, y: 2160, zoom: 1.15},
    {at: 200, x: 720, y: 2160, zoom: 1.15},
    {at: 218, x: 720, y: 2420, zoom: 1.15},
  ],
  callouts: [
    {from: 8, to: 48, box: [153, 229, 1134, 45], label: 'Sample: priya_salaried-edited.pdf', tone: 'bad', place: 'bottom'},
    {from: 72, to: 104, box: [177, 1723, 275, 42], label: 'Failed · 4 of 7 checks passed', tone: 'bad', place: 'right'},
    {from: 122, to: 154, box: [153, 1816, 1134, 181], label: 'Running balance doesn’t add up', tone: 'bad', place: 'top', spot: true},
    {from: 172, to: 204, box: [153, 1997, 1134, 293], label: 'PDF re-saved in an editor after the bank issued it', tone: 'bad', place: 'top', spot: true},
    {from: 218, to: 255, box: [153, 2291, 1134, 236], label: 'Salary credit 63% above usual', tone: 'bad', place: 'top', spot: true},
  ],
};

export const LENDER: ShotSceneSpec = {
  kicker: 'For lenders',
  path: '/lender',
  title: 'A portfolio view with authenticity per applicant.',
  shot: {file: 'lender.png', height: 1777},
  camera: [
    {at: 0, x: 720, y: 430, zoom: 1},
    {at: 75, x: 720, y: 430, zoom: 1},
    {at: 100, x: 720, y: 1090, zoom: 1.1},
  ],
  callouts: [
    {from: 8, to: 44, box: [152, 233, 1136, 126], label: 'Applicants, approval rate, flagged statements, average score', place: 'bottom'},
    {from: 44, to: 80, box: [721, 234, 283, 124], label: '2 statements failed authenticity', tone: 'bad', place: 'bottom', spot: true},
    {from: 102, to: 165, box: [153, 1023, 1134, 64], label: 'Edited PDF → manual review', tone: 'bad', place: 'top'},
    {from: 116, to: 165, box: [153, 1150, 1134, 64], label: 'Round-tripped funds → manual review', tone: 'bad', place: 'bottom'},
  ],
};

export const MODEL: ShotSceneSpec = {
  kicker: 'Transparency',
  path: '/model',
  title: 'A public model card: metrics, fairness, limitations.',
  shot: {file: 'model.png', height: 2660},
  camera: [
    {at: 0, x: 720, y: 480, zoom: 1},
    {at: 55, x: 720, y: 480, zoom: 1},
    {at: 80, x: 840, y: 1870, zoom: 1.05},
  ],
  callouts: [
    {from: 8, to: 55, box: [392, 412, 896, 278], label: 'Risk AUC, KS, Gini, Brier · categorizer accuracy', place: 'bottom', spot: true},
    {from: 82, to: 135, box: [852, 1652, 436, 432], label: 'Ablations vs bureau-like signals', place: 'bottom'},
  ],
};

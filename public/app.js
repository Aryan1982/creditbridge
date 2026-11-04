// CreditBridge client: scores applicants with the exported scorecard (public/model.json).
const NAMES = {
  en: {checking_status:"Checking account",savings_status:"Savings",employment:"Employment length",residence_since:"Years at residence",property_magnitude:"Assets",housing:"Housing",job:"Job type",num_dependents:"Dependents",own_telephone:"Phone ownership",duration:"Loan duration (months)",credit_amount:"Loan amount",installment_commitment:"Instalment % of income",purpose:"Purpose",other_parties:"Guarantor",age:"Age",credit_history:"Credit history",existing_credits:"Existing credits",other_payment_plans:"Other payment plans"},
  hi: {checking_status:"चालू खाता",savings_status:"बचत",employment:"रोज़गार अवधि",residence_since:"निवास के वर्ष",property_magnitude:"संपत्ति",housing:"आवास",job:"नौकरी का प्रकार",num_dependents:"आश्रित",own_telephone:"फ़ोन",duration:"ऋण अवधि (महीने)",credit_amount:"ऋण राशि",installment_commitment:"आय में किस्त %",purpose:"उद्देश्य",other_parties:"गारंटर",age:"आयु",credit_history:"क्रेडिट इतिहास",existing_credits:"मौजूदा ऋण",other_payment_plans:"अन्य भुगतान योजनाएँ"},
  te: {checking_status:"చెకింగ్ ఖాతా",savings_status:"పొదుపు",employment:"ఉద్యోగ కాలం",residence_since:"నివాస సంవత్సరాలు",property_magnitude:"ఆస్తులు",housing:"నివాసం",job:"ఉద్యోగ రకం",num_dependents:"ఆధారితులు",own_telephone:"ఫోన్",duration:"రుణ కాలం (నెలలు)",credit_amount:"రుణ మొత్తం",installment_commitment:"ఆదాయంలో వాయిదా %",purpose:"ప్రయోజనం",other_parties:"హామీదారు",age:"వయస్సు",credit_history:"క్రెడిట్ చరిత్ర",existing_credits:"ప్రస్తుత రుణాలు",other_payment_plans:"ఇతర చెల్లింపు ప్రణాళికలు"},
};
const T = {
  en:{ok:"APPROVE",no:"REFER / DECLINE",pd:"Estimated default probability",up:"lowers risk",down:"raises risk",cf:"Change",to:"to",none:"Already approved — no changes needed.",reach:"→ projected score",stuck:"No single actionable change reaches approval; consider a smaller amount or a guarantor."},
  hi:{ok:"स्वीकृत",no:"समीक्षा / अस्वीकृत",pd:"अनुमानित डिफ़ॉल्ट संभावना",up:"जोखिम घटाता है",down:"जोखिम बढ़ाता है",cf:"बदलें",to:"से",none:"पहले से स्वीकृत — कोई बदलाव ज़रूरी नहीं।",reach:"→ अनुमानित स्कोर",stuck:"कोई एक बदलाव पर्याप्त नहीं; कम राशि या गारंटर पर विचार करें।"},
  te:{ok:"ఆమోదం",no:"సమీక్ష / తిరస్కరణ",pd:"అంచనా డిఫాల్ట్ సంభావ్యత",up:"ప్రమాదాన్ని తగ్గిస్తుంది",down:"ప్రమాదాన్ని పెంచుతుంది",cf:"మార్చండి",to:"కు",none:"ఇప్పటికే ఆమోదించబడింది — మార్పులు అవసరం లేదు.",reach:"→ అంచనా స్కోర్",stuck:"ఒక్క మార్పుతో ఆమోదం రాదు; తక్కువ మొత్తం లేదా హామీదారును పరిగణించండి."},
};
// Features an applicant can realistically change.
const ACTIONABLE = ["checking_status","savings_status","duration","credit_amount","installment_commitment","own_telephone","other_parties","other_payment_plans","property_magnitude"];
const DEFAULTS = {checking_status:"no checking",savings_status:"<100",employment:"1<=X<4",residence_since:2,property_magnitude:"real estate",housing:"own",job:"skilled",num_dependents:1,own_telephone:"none",duration:24,credit_amount:3500,installment_commitment:3,purpose:"radio/tv",other_parties:"none",age:24,credit_history:"no credits/all paid",existing_credits:1,other_payment_plans:"none"};

let M, lang = "en";
const $ = (id) => document.getElementById(id);
const sig = (z) => 1 / (1 + Math.exp(-z));
const points = (p) => Math.round(Math.min(900, Math.max(300, 600 - 50 * Math.log2(p / (1 - p)) )));
const PRESETS = {
  student: {...DEFAULTS, checking_status:"0<=X<200", savings_status:"<100", employment:"<1", age:22, housing:"rent", job:"unskilled resident", duration:30, credit_amount:4000, installment_commitment:4, purpose:"education", property_magnitude:"no known property", credit_history:"no credits/all paid"},
  gig: {...DEFAULTS, checking_status:"0<=X<200", savings_status:"100<=X<500", employment:"1<=X<4", age:29, housing:"rent", job:"skilled", duration:18, credit_amount:2500, installment_commitment:2, purpose:"new car", own_telephone:"yes", credit_history:"all paid"},
  salaried: {...DEFAULTS, checking_status:"no checking", savings_status:">=1000", employment:">=7", age:38, housing:"own", job:"high qualif/self emp/mgmt", duration:12, credit_amount:4000, installment_commitment:2, purpose:"furniture/equipment", own_telephone:"yes", credit_history:"existing paid"},
};
function applyPreset(name) {
  for (const [f, v] of Object.entries(PRESETS[name])) { const el = $("f_" + f); if (el) el.value = v; }
  render();
}
function gauge(score, ok) {
  const r = 70, cx = 85, cy = 88, a = Math.PI * (1 - (score - 300) / 600);
  const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
  return `<svg class="gauge" viewBox="0 0 170 100"><defs><linearGradient id="gg"><stop offset="0" stop-color="#ff5d73"/><stop offset=".5" stop-color="#ffb547"/><stop offset="1" stop-color="#2ee59d"/></linearGradient></defs>
  <path d="M15 88 A70 70 0 0 1 155 88" fill="none" stroke="rgba(120,140,200,.18)" stroke-width="12" stroke-linecap="round"/>
  <path d="M15 88 A70 70 0 0 1 155 88" fill="none" stroke="url(#gg)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${Math.PI * r * (score - 300) / 600} 999"/>
  <circle cx="${x}" cy="${y}" r="7" fill="${ok ? "#2ee59d" : "#ff5d73"}" stroke="#070b18" stroke-width="3"/></svg>`;
}

function contributions(x) {
  const out = {};
  for (const [f, s] of Object.entries(M.scorecard.features))
    out[f] = s.type === "cat" ? (s.levels[x[f]] ?? 0) : s.weight * (x[f] - s.mean);
  return out;
}
function pd(x) { return sig(M.scorecard.intercept + Object.values(contributions(x)).reduce((a, b) => a + b, 0)); }

function candidates(f, v) {
  const s = M.scorecard.features[f];
  if (s.type === "cat") return Object.keys(s.levels).filter((l) => l !== v);
  if (f === "duration") return [6, 12, 18, 24].filter((d) => d < v);
  if (f === "credit_amount") return [0.5, 0.75].map((k) => Math.round(v * k / 100) * 100);
  if (f === "installment_commitment") return [1, 2].filter((d) => d < v);
  return [];
}
function counterfactual(x) {
  let cur = { ...x }; const steps = [];
  for (let i = 0; i < 3 && pd(cur) >= M.threshold; i++) {
    let best = null;
    for (const f of ACTIONABLE) {
      if (steps.some((s) => s.f === f)) continue;
      for (const v of candidates(f, cur[f])) {
        const p = pd({ ...cur, [f]: v });
        if (!best || p < best.p) best = { f, v, p };
      }
    }
    if (!best || best.p >= pd(cur)) break;
    cur[best.f] = best.v; steps.push(best);
  }
  return { steps, ok: pd(cur) < M.threshold };
}

function buildForm() {
  const form = $("form"); const feats = M.scorecard.features;
  const order = [...M.alternative_features, ...M.bureau_features];
  form.innerHTML = order.map((f) => {
    const s = feats[f]; const tag = M.bureau_features.includes(f) ? '<span class="tag b">bureau</span>' : '<span class="tag a">alt</span>';
    const input = s.type === "cat"
      ? `<select id="f_${f}">${Object.keys(s.levels).map((l) => `<option${l === DEFAULTS[f] ? " selected" : ""}>${l}</option>`).join("")}</select>`
      : `<input id="f_${f}" type="number" min="${s.min}" max="${s.max}" value="${DEFAULTS[f]}">`;
    return `<div><label>${NAMES.en[f]}${tag}</label>${input}</div>`;
  }).join("");
  form.addEventListener("input", render);
  document.querySelectorAll(".presets button").forEach((b) => b.onclick = () => applyPreset(b.dataset.p));
}
function read() {
  const x = {};
  for (const [f, s] of Object.entries(M.scorecard.features)) { const v = $("f_" + f).value; x[f] = s.type === "cat" ? v : Number(v); }
  return x;
}
function render() {
  const x = read(), t = T[lang], n = NAMES[lang], p = pd(x), ok = p < M.threshold;
  $("gaugeBox").innerHTML = gauge(points(p), ok);
  $("points").textContent = points(p);
  $("decision").textContent = ok ? t.ok : t.no; $("decision").className = "decision " + (ok ? "ok" : "no");
  $("pd").textContent = `${t.pd}: ${(p * 100).toFixed(1)}% · threshold ${(M.threshold * 100).toFixed(1)}%`;
  $("barfill").style.width = ((points(p) - 300) / 6) + "%";
  const c = Object.entries(contributions(x)).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  $("reasons").innerHTML = c.slice(0, 4).map(([f, v]) => `<li><b>${n[f]}</b> = ${x[f]} — <span class="${v < 0 ? "pos" : "neg"}">${v < 0 ? t.up : t.down}</span></li>`).join("");
  const max = Math.max(...c.map(([, v]) => Math.abs(v)));
  $("contrib").innerHTML = c.map(([f, v]) => {
    const w = Math.abs(v) / max * 50; const left = v < 0 ? 50 - w : 50;
    return `<div class="contrib"><span>${n[f]}</span><div class="track"><b style="left:${left}%;width:${w}%;background:${v < 0 ? "var(--ok)" : "var(--bad)"}"></b></div><span>${v.toFixed(2)}</span></div>`;
  }).join("");
  if (ok) $("cf").innerHTML = `<li>${t.none}</li>`;
  else {
    const r = counterfactual(x);
    $("cf").innerHTML = r.steps.map((s) => `<li>${t.cf} <b>${n[s.f]}</b>: ${x[s.f]} ${t.to} <b>${s.v}</b> ${t.reach} ${points(s.p)}</li>`).join("") + (r.ok ? "" : `<li class="mut">${t.stuck}</li>`);
  }
}
function renderMetrics() {
  const m = M.metrics, rows = Object.entries(m.models);
  $("perf").innerHTML = `<tr><th>Model</th><th>ROC-AUC</th><th>KS</th><th>Brier</th><th>F1 (bad)</th></tr>` +
    rows.map(([k, v]) => `<tr><td>${k.replace(/_/g, " ")}</td><td>${v.roc_auc}</td><td>${v.ks}</td><td>${v.brier}</td><td>${v.f1_bad}</td></tr>`).join("");
  const th = m.thin_file_auc;
  $("thin").textContent = `Thin-file applicants (n=${th.n}, no/fully-paid prior credit): bureau-only AUC ${th.logreg_bureau_only} vs alternative-data AUC ${th.logreg_alternative_only} vs combined ${th.logreg_combined}.`;
  const bo = m.models.logreg_bureau_only, ao = m.models.logreg_alternative_only;
  $("kpis").innerHTML = [[m.models.logreg_combined.roc_auc, "ROC-AUC (deployed)"], ["+" + (ao.roc_auc - bo.roc_auc).toFixed(2), "AUC lift: alt vs bureau"], [th.logreg_alternative_only, "Thin-file AUC"], [m.fairness.sex.demographic_parity_ratio, "Sex parity ratio"]]
    .map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("");
  $("fair").innerHTML = `<tr><th>Group</th><th>n</th><th>Approval</th><th>Good-payer approval</th></tr>` +
    Object.entries(m.fairness).map(([attr, a]) => Object.entries(a.groups).map(([g, r]) => `<tr><td>${attr}: ${g}</td><td>${r.n}</td><td>${(r.approval_rate * 100).toFixed(1)}%</td><td>${(r.good_payer_approval_rate * 100).toFixed(1)}%</td></tr>`).join("") +
      `<tr><td colspan="4" class="mut">${attr}: parity ratio ${a.demographic_parity_ratio} · equal-opportunity gap ${a.equal_opportunity_diff}</td></tr>`).join("");
}
function renderLangs() {
  $("langs").innerHTML = [["en", "EN"], ["hi", "हिं"], ["te", "తె"]].map(([k, l]) => `<button class="${k === lang ? "on" : ""}" data-l="${k}">${l}</button>`).join("");
  $("langs").querySelectorAll("button").forEach((b) => b.onclick = () => { lang = b.dataset.l; renderLangs(); render(); });
}
fetch("model.json").then((r) => r.json()).then((m) => { M = m; buildForm(); renderLangs(); renderMetrics(); render(); });

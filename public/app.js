// CreditBridge client: scores applicants with the exported scorecard (public/model.json).
const NAMES = {
  en: {checking_status:"Checking account",savings_status:"Savings",employment:"Employment length",residence_since:"Years at residence",property_magnitude:"Assets",housing:"Housing",job:"Job type",num_dependents:"Dependents",own_telephone:"Phone ownership",duration:"Loan duration (months)",credit_amount:"Loan amount",installment_commitment:"Instalment % of income",purpose:"Purpose",other_parties:"Guarantor",age:"Age",credit_history:"Credit history",existing_credits:"Existing credits",other_payment_plans:"Other payment plans"},
  hi: {checking_status:"चालू खाता",savings_status:"बचत",employment:"रोज़गार अवधि",residence_since:"निवास के वर्ष",property_magnitude:"संपत्ति",housing:"आवास",job:"नौकरी का प्रकार",num_dependents:"आश्रित",own_telephone:"फ़ोन",duration:"ऋण अवधि (महीने)",credit_amount:"ऋण राशि",installment_commitment:"आय में किस्त %",purpose:"उद्देश्य",other_parties:"गारंटर",age:"आयु",credit_history:"क्रेडिट इतिहास",existing_credits:"मौजूदा ऋण",other_payment_plans:"अन्य भुगतान योजनाएँ"},
  te: {checking_status:"చెకింగ్ ఖాతా",savings_status:"పొదుపు",employment:"ఉద్యోగ కాలం",residence_since:"నివాస సంవత్సరాలు",property_magnitude:"ఆస్తులు",housing:"నివాసం",job:"ఉద్యోగ రకం",num_dependents:"ఆధారితులు",own_telephone:"ఫోన్",duration:"రుణ కాలం (నెలలు)",credit_amount:"రుణ మొత్తం",installment_commitment:"ఆదాయంలో వాయిదా %",purpose:"ప్రయోజనం",other_parties:"హామీదారు",age:"వయస్సు",credit_history:"క్రెడిట్ చరిత్ర",existing_credits:"ప్రస్తుత రుణాలు",other_payment_plans:"ఇతర చెల్లింపు ప్రణాళికలు"},
};
const T = {
  en:{ok:"APPROVE",no:"REFER / DECLINE",pd:"Estimated default probability",up:"lowers risk",down:"raises risk",cf:"Change",to:"to",none:"Already approved — no changes needed.",reach:"→ projected score",stuck:"These changes alone don't reach approval yet; a smaller loan amount or shorter duration would help further."},
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
const LABELS = {
  checking_status: {"<0":"Overdrawn","0<=X<200":"Low balance",">=200":"Healthy balance","no checking":"No current account"},
  savings_status: {"<100":"Under 100","100<=X<500":"100 – 500","500<=X<1000":"500 – 1,000",">=1000":"Over 1,000","no known savings":"No savings"},
  employment: {"unemployed":"Not employed","<1":"Less than 1 year","1<=X<4":"1 – 4 years","4<=X<7":"4 – 7 years",">=7":"7+ years"},
  credit_history: {"no credits/all paid":"No previous loans","all paid":"All loans repaid","existing paid":"Current loans on track","delayed previously":"Past late payments","critical/other existing credit":"Loans with other lenders"},
  property_magnitude: {"real estate":"Property / land","life insurance":"Life insurance or savings plan","car":"Vehicle","no known property":"No assets"},
  housing: {"own":"Owns home","rent":"Rents","for free":"Lives rent-free"},
  job: {"unemp/unskilled non res":"Unskilled, non-resident","unskilled resident":"Unskilled worker","skilled":"Skilled worker","high qualif/self emp/mgmt":"Manager / self-employed / professional"},
  own_telephone: {"none":"No phone in own name","yes":"Has phone in own name"},
  purpose: {"business":"Business","domestic appliance":"Home appliance","education":"Education","furniture/equipment":"Furniture / equipment","new car":"New vehicle","used car":"Used vehicle","other":"Other","radio/tv":"Electronics","repairs":"Repairs","retraining":"Training / reskilling"},
  other_parties: {"none":"None","guarantor":"Guarantor","co applicant":"Co-applicant"},
  other_payment_plans: {"none":"None","bank":"Bank instalment plan","stores":"Store instalment plan"},
};
const SLIDERS = { credit_amount: 50, duration: 1 };
const fmt = (f, v) => LABELS[f]?.[v] ?? (f === "credit_amount" ? Number(v).toLocaleString("en-IN") : f === "duration" ? `${v} months` : v);
let steps = [], shown = null, anim = 0;
function setPreset(name) { document.querySelectorAll(".presets button").forEach((b) => b.classList.toggle("on", b.dataset.p === name)); }
function applyPreset(name) {
  for (const [f, v] of Object.entries(PRESETS[name])) { const el = $("f_" + f); if (el) el.value = v; }
  setPreset(name);
  render();
}
function applySteps(list) {
  for (const s of list) $("f_" + s.f).value = s.v;
  setPreset(null); render();
}
function gauge(score, ok) {
  const r = 80, frac = (score - 300) / 600, col = ok ? "#047857" : "#b91c1c";
  if (!$("gArc")) $("gaugeBox").innerHTML = `<svg class="gauge" viewBox="0 0 180 100" aria-hidden="true">
  <path d="M10 92 A80 80 0 0 1 170 92" fill="none" stroke="#efedeb" stroke-width="8" stroke-linecap="round"/>
  <path id="gArc" d="M10 92 A80 80 0 0 1 170 92" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="0 999"/></svg>`;
  requestAnimationFrame(() => { const a = $("gArc"); a.style.strokeDasharray = `${Math.PI * r * frac} 999`; a.style.stroke = col; });
}
function countTo(to) {
  const from = shown ?? 300, t0 = performance.now(), id = ++anim; shown = to;
  const step = (now) => {
    if (id !== anim) return;
    const k = Math.min(1, (now - t0) / 600), e = 1 - Math.pow(1 - k, 3);
    $("points").textContent = Math.round(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
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

const GROUPS = [
  ["Banking & savings", ["checking_status", "savings_status", "property_magnitude", "own_telephone"]],
  ["Work & housing", ["employment", "job", "housing", "residence_since", "num_dependents", "age"]],
  ["Loan request", ["credit_amount", "duration", "installment_commitment", "purpose", "other_parties"]],
  ["Credit history", ["credit_history", "existing_credits", "other_payment_plans"], "Optional"],
];
function buildForm() {
  const form = $("form"); const feats = M.scorecard.features;
  const field = (f) => {
    const s = feats[f];
    const input = s.type === "cat"
      ? `<select id="f_${f}">${Object.keys(s.levels).map((l) => `<option value="${l}"${l === DEFAULTS[f] ? " selected" : ""}>${fmt(f, l)}</option>`).join("")}</select>`
      : SLIDERS[f]
      ? `<input id="f_${f}" type="range" min="${s.min}" max="${s.max}" step="${SLIDERS[f]}" value="${DEFAULTS[f]}">`
      : `<input id="f_${f}" type="number" inputmode="numeric" min="${s.min}" max="${s.max}" value="${DEFAULTS[f]}">`;
    return `<div class="fld${SLIDERS[f] ? " wide" : ""}"><label for="f_${f}"><span data-f="${f}">${NAMES[lang][f]}</span>${SLIDERS[f] ? `<output id="v_${f}"></output>` : ""}</label>${input}</div>`;
  };
  const grouped = new Set(GROUPS.flatMap(([, fs]) => fs));
  const rest = Object.keys(feats).filter((f) => !grouped.has(f));
  form.innerHTML = GROUPS.map(([title, fs, hint], i) => {
    const all = i === GROUPS.length - 1 ? [...fs, ...rest] : fs;
    return `<fieldset><div class="grp">${title}${hint ? `<small>${hint}</small>` : ""}</div>${all.filter((f) => feats[f]).map(field).join("")}</fieldset>`;
  }).join("");
  form.addEventListener("input", () => { setPreset(null); render(); });
  document.querySelectorAll(".presets button").forEach((b) => b.onclick = () => applyPreset(b.dataset.p));
  $("cf").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]"); if (!b) return;
    applySteps(b.dataset.i === "all" ? steps : [steps[+b.dataset.i]]);
  });
  $("printBtn").onclick = () => { $("letterDate").textContent = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }); window.print(); };
  $("copyBtn").onclick = async () => {
    const b = $("copyBtn");
    try { await navigator.clipboard.writeText(location.href); b.textContent = "Link copied"; }
    catch { prompt("Copy this link", location.href); }
    setTimeout(() => b.textContent = "Copy link", 1600);
  };
  const h = new URLSearchParams(location.hash.slice(1));
  for (const [f, v] of h) { const el = $("f_" + f); if (el && feats[f]) el.value = v; }
}
function read() {
  const x = {};
  for (const [f, s] of Object.entries(M.scorecard.features)) { const v = $("f_" + f).value; x[f] = s.type === "cat" ? v : Number(v); }
  return x;
}
function render() {
  const x = read(), t = T[lang], n = NAMES[lang], p = pd(x), ok = p < M.threshold, sc = points(p);
  const label = (s) => lang === "en" ? s[0] + s.slice(1).toLowerCase() : s;
  document.querySelectorAll("#form [data-f]").forEach((l) => l.textContent = n[l.dataset.f]);
  for (const f of Object.keys(SLIDERS)) if ($("v_" + f)) $("v_" + f).textContent = fmt(f, x[f]);
  history.replaceState(null, "", "#" + new URLSearchParams(Object.entries(x)).toString());
  gauge(sc, ok);
  if (sc !== shown) countTo(sc);
  $("decision").textContent = label(ok ? t.ok : t.no); $("decision").className = "decision " + (ok ? "ok" : "no");
  $("pd").textContent = `${t.pd}: ${(p * 100).toFixed(1)}%`;
  $("barfill").style.width = ((sc - 300) / 6) + "%";
  const c = Object.entries(contributions(x)).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  $("reasons").innerHTML = c.slice(0, 4).map(([f, v]) => `<li><span class="f">${n[f]}</span><span class="val">${fmt(f, x[f])}</span><span class="chip ${v < 0 ? "pos" : "neg"}">${v < 0 ? "+" : "−"} ${v < 0 ? t.up : t.down}</span></li>`).join("");
  const max = Math.max(...c.map(([, v]) => Math.abs(v))) || 1;
  $("contrib").innerHTML = c.map(([f, v]) => {
    const w = Math.abs(v) / max * 50; const left = v < 0 ? 50 - w : 50;
    return `<div class="contrib"><span class="n" title="${n[f]}">${n[f]}</span><div class="track"><b style="left:${left}%;width:${w}%;background:${v < 0 ? "var(--ok)" : "var(--bad)"}"></b></div></div>`;
  }).join("");
  if (ok) { steps = []; $("cf").innerHTML = `<li class="done">${t.none}</li>`; }
  else {
    const r = counterfactual(x), reach = t.reach.replace(/^→\s*/, "");
    steps = r.steps;
    $("cf").innerHTML = steps.map((s, i) => `<li><div class="st">${t.cf} <b>${n[s.f]}</b> <span class="to">${fmt(s.f, x[s.f])} ${t.to}</span> <b>${fmt(s.f, s.v)}</b><span class="proj">${reach} <span class="num">${points(s.p)}</span></span></div><button type="button" class="btn sm" data-i="${i}">Apply</button></li>`).join("") +
      (r.ok ? "" : `<li class="stuck">${t.stuck}</li>`) +
      (steps.length > 1 ? `<li class="all"><button type="button" class="btn primary" data-i="all">Apply all changes</button></li>` : "");
  }
}
function renderLangs() {
  $("langs").innerHTML = [["en", "EN"], ["hi", "हिं"], ["te", "తె"]].map(([k, l]) => `<button class="${k === lang ? "on" : ""}" data-l="${k}">${l}</button>`).join("");
  $("langs").querySelectorAll("button").forEach((b) => b.onclick = () => { lang = b.dataset.l; renderLangs(); render(); });
}
fetch("model.json").then((r) => r.json()).then((m) => { M = m; buildForm(); renderLangs(); render(); });

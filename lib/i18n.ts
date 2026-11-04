import type { Decision, Lang } from "./types";

export const LANGS: { code: Lang; label: string; name: string }[] = [
  { code: "en", label: "EN", name: "English" },
  { code: "hi", label: "हिंदी", name: "Hindi" },
  { code: "te", label: "తెలుగు", name: "Telugu" },
];

type Dict = {
  creditScore: string;
  outOf: string;
  band: string;
  decision: Record<Decision, string>;
  summary: string;
  requestedEmi: string;
  affordableEmi: string;
  recommendedAmount: string;
  perMonth: string;
  why: string;
  whySub: string;
  helps: string;
  hurts: string;
  improve: string;
  improveSub: string;
  projected: string;
  now: string;
  target: string;
  download: string;
  newCheck: string;
  withinLimit: string;
  overLimit: string;
  monthlyIncome: string;
  incomeStability: string;
  existingEmis: string;
  none: string;
  statement: string;
  status: { pass: string; warn: string; fail: string };
  loanRequest: (amount: string, months: number) => string;
  tenureAt: (months: number, rate: number) => string;
  tabs: {
    cashflow: string;
    income: string;
    spending: string;
    transactions: string;
    authenticity: string;
  };
};

export const T: Record<Lang, Dict> = {
  en: {
    creditScore: "Credit score",
    outOf: "out of 900",
    band: "Band",
    decision: { approve: "Approved", review: "Manual review", decline: "Declined" },
    summary: "Summary",
    requestedEmi: "Requested EMI",
    affordableEmi: "Affordable EMI",
    recommendedAmount: "Recommended loan amount",
    perMonth: "/mo",
    why: "Why this decision",
    whySub: "The factors that moved your score the most.",
    helps: "Helps",
    hurts: "Hurts",
    improve: "How to improve",
    improveSub: "Specific changes and the score you could reach.",
    projected: "Projected score",
    now: "Now",
    target: "Target",
    download: "Download decision letter",
    newCheck: "New check",
    withinLimit: "Within what you can afford",
    overLimit: "Above what you can comfortably afford",
    monthlyIncome: "Monthly income",
    incomeStability: "Income stability",
    existingEmis: "Existing EMIs",
    none: "None",
    statement: "Statement",
    status: { pass: "Verified", warn: "Needs attention", fail: "Failed" },
    loanRequest: (a, m) => `Loan request · ${a} over ${m} months`,
    tenureAt: (m, r) => `${m} months at ${r}% a year`,
    tabs: {
      cashflow: "Cash flow",
      income: "Income sources",
      spending: "Spending",
      transactions: "Transactions",
      authenticity: "Statement authenticity",
    },
  },
  hi: {
    creditScore: "क्रेडिट स्कोर",
    outOf: "900 में से",
    band: "श्रेणी",
    decision: { approve: "स्वीकृत", review: "समीक्षा में", decline: "अस्वीकृत" },
    summary: "सारांश",
    requestedEmi: "माँगी गई EMI",
    affordableEmi: "वहन योग्य EMI",
    recommendedAmount: "सुझाई गई ऋण राशि",
    perMonth: "/माह",
    why: "यह निर्णय क्यों",
    whySub: "वे कारण जिन्होंने आपके स्कोर को सबसे अधिक प्रभावित किया।",
    helps: "मदद करता है",
    hurts: "नुकसान करता है",
    improve: "स्कोर कैसे सुधारें",
    improveSub: "ठोस कदम और उनसे मिलने वाला संभावित स्कोर।",
    projected: "संभावित स्कोर",
    now: "अभी",
    target: "लक्ष्य",
    download: "निर्णय पत्र डाउनलोड करें",
    newCheck: "नई जाँच",
    withinLimit: "आपकी क्षमता के भीतर",
    overLimit: "आपकी आरामदायक क्षमता से अधिक",
    monthlyIncome: "मासिक आय",
    incomeStability: "आय की स्थिरता",
    existingEmis: "मौजूदा EMI",
    none: "कोई नहीं",
    statement: "स्टेटमेंट",
    status: { pass: "सत्यापित", warn: "ध्यान दें", fail: "विफल" },
    loanRequest: (a, m) => `ऋण अनुरोध · ${a}, ${m} महीनों के लिए`,
    tenureAt: (m, r) => `${m} महीने, ${r}% वार्षिक ब्याज`,
    tabs: {
      cashflow: "नकदी प्रवाह",
      income: "आय के स्रोत",
      spending: "खर्च",
      transactions: "लेन-देन",
      authenticity: "स्टेटमेंट की प्रामाणिकता",
    },
  },
  te: {
    creditScore: "క్రెడిట్ స్కోర్",
    outOf: "900 లో",
    band: "శ్రేణి",
    decision: { approve: "ఆమోదించబడింది", review: "సమీక్షలో ఉంది", decline: "తిరస్కరించబడింది" },
    summary: "సారాంశం",
    requestedEmi: "కోరిన EMI",
    affordableEmi: "భరించగల EMI",
    recommendedAmount: "సిఫార్సు చేసిన రుణ మొత్తం",
    perMonth: "/నెల",
    why: "ఈ నిర్ణయం ఎందుకు",
    whySub: "మీ స్కోర్‌ను ఎక్కువగా ప్రభావితం చేసిన అంశాలు.",
    helps: "సహాయపడుతుంది",
    hurts: "తగ్గిస్తుంది",
    improve: "స్కోర్ ఎలా మెరుగుపరచాలి",
    improveSub: "నిర్దిష్ట మార్పులు, వాటితో మీరు చేరగల స్కోర్.",
    projected: "అంచనా స్కోర్",
    now: "ప్రస్తుతం",
    target: "లక్ష్యం",
    download: "నిర్ణయ లేఖను డౌన్‌లోడ్ చేయండి",
    newCheck: "కొత్త తనిఖీ",
    withinLimit: "మీ స్థోమత పరిధిలో ఉంది",
    overLimit: "మీ స్థోమతకు మించి ఉంది",
    monthlyIncome: "నెలవారీ ఆదాయం",
    incomeStability: "ఆదాయ స్థిరత్వం",
    existingEmis: "ప్రస్తుత EMIలు",
    none: "ఏవీ లేవు",
    statement: "స్టేట్‌మెంట్",
    status: { pass: "ధృవీకరించబడింది", warn: "పరిశీలన అవసరం", fail: "విఫలమైంది" },
    loanRequest: (a, m) => `రుణ అభ్యర్థన · ${a}, ${m} నెలలకు`,
    tenureAt: (m, r) => `${m} నెలలు, సంవత్సరానికి ${r}% వడ్డీ`,
    tabs: {
      cashflow: "నగదు ప్రవాహం",
      income: "ఆదాయ వనరులు",
      spending: "ఖర్చులు",
      transactions: "లావాదేవీలు",
      authenticity: "స్టేట్‌మెంట్ ప్రామాణికత",
    },
  },
};

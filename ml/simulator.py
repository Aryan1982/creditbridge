"""Synthetic Indian bank / UPI statement simulator.

Each applicant has a persona (salaried, gig_worker, shopkeeper, farmer, student,
homemaker) and *latent* traits that are never written to the statement:

* ``discipline``  – how carefully money is managed (bill timing, savings,
  discretionary spend, betting);
* ``shock_p``     – monthly probability of an income shock (lost gigs, crop
  failure, job loss, medical emergency);
* ``stress``      – structural liquidity stress (thin buffers, existing debt);
* ``bettor`` / ``loanapp`` propensities.

These traits drive what *is* observable (bill-payment timing, NACH/ECS bounces
and return charges, minimum-balance penalties, loan-app borrowing, betting,
balances...). The default label is simulated over a *future* 12-month window
from the same latent traits plus fresh shocks and idiosyncratic noise, so it is
not a deterministic function of anything in the statement.

Narrations imitate the formats of real Indian banks (SBI, HDFC, ICICI, Axis,
Kotak, Canara, Bank of Baroda, PNB), with bank-side truncation and typos.
Every transaction carries its ground-truth ``category`` and a ``group`` key
(merchant / counterparty identity) used for unseen-merchant evaluation.
"""

from __future__ import annotations

import calendar
import math
import random
from dataclasses import dataclass, field
from datetime import date, timedelta
from functools import lru_cache

import numpy as np

PERSONAS = ["salaried", "gig_worker", "shopkeeper", "farmer", "student", "homemaker"]
PERSONA_MIX = [0.22, 0.22, 0.16, 0.15, 0.12, 0.13]
TARGET_DEFAULT_RATE = {
    "salaried": 0.14, "gig_worker": 0.24, "shopkeeper": 0.19,
    "farmer": 0.25, "student": 0.21, "homemaker": 0.17,
}
FEMALE_SHARE = {
    "salaried": 0.35, "gig_worker": 0.08, "shopkeeper": 0.22,
    "farmer": 0.15, "student": 0.45, "homemaker": 0.97,
}
STATEMENT_END = date(2026, 10, 31)

# --------------------------------------------------------------------------- names

FIRST_M = ["Ravi", "Suresh", "Ramesh", "Mahesh", "Arjun", "Rahul", "Vikram", "Srinivas", "Venkatesh", "Mohammed",
           "Imran", "Abdul", "Rajesh", "Anil", "Sunil", "Prakash", "Manoj", "Sanjay", "Ajay", "Kiran", "Naveen",
           "Harish", "Gopal", "Ramu", "Balaji", "Sai", "Karthik", "Deepak", "Amit", "Rohit", "Vijay", "Ashok",
           "Pradeep", "Satish", "Nagaraju", "Raju", "Yusuf", "Salim", "Gurpreet", "Harpreet", "Joseph", "Thomas",
           "Arun", "Murali", "Shankar", "Ganesh", "Dinesh", "Pawan", "Sandeep", "Anand"]
FIRST_F = ["Lakshmi", "Priya", "Kavya", "Ananya", "Sunita", "Anjali", "Pooja", "Sravani", "Swathi", "Divya",
           "Fatima", "Ayesha", "Nazia", "Rekha", "Meena", "Geeta", "Sarita", "Padma", "Saritha", "Bhavani",
           "Radha", "Neha", "Sneha", "Deepika", "Harini", "Keerthi", "Mamatha", "Shabana", "Reshma", "Jyothi",
           "Asha", "Usha", "Kamala", "Manjula", "Rupa", "Simran", "Mary", "Anitha", "Vani", "Shalini"]
LAST = ["Kumar", "Reddy", "Rao", "Sharma", "Verma", "Singh", "Patil", "Yadav", "Naidu", "Gupta", "Shaikh",
        "Khan", "Ansari", "Nair", "Menon", "Iyer", "Pillai", "Das", "Ghosh", "Banerjee", "Mishra", "Pandey",
        "Chauhan", "Jadhav", "Pawar", "Goud", "Chary", "Babu", "Joshi", "Kulkarni", "Desai", "Mehta", "Shah",
        "Bhat", "Hegde", "Gowda", "Murthy", "Prasad", "Thakur", "Rathod", "Varma", "Sinha", "Tiwari", "Dubey",
        "Mondal", "Saikia", "Fernandes", "DSouza", "Gill", "Sandhu"]
CITIES = [("HYDERABAD", "TS"), ("BENGALURU", "KA"), ("MUMBAI", "MH"), ("PUNE", "MH"), ("CHENNAI", "TN"),
          ("NEW DELHI", "DL"), ("KOLKATA", "WB"), ("WARANGAL", "TS"), ("VIJAYAWADA", "AP"), ("NIZAMABAD", "TS"),
          ("GUNTUR", "AP"), ("NASHIK", "MH"), ("LUCKNOW", "UP"), ("JAIPUR", "RJ"), ("PATNA", "BR"),
          ("INDORE", "MP"), ("COIMBATORE", "TN"), ("MYSURU", "KA"), ("KOCHI", "KL"), ("NAGPUR", "MH")]
RURAL = [("KARIMNAGAR", "TS"), ("NALGONDA", "TS"), ("KHAMMAM", "TS"), ("ONGOLE", "AP"), ("KURNOOL", "AP"),
         ("MANDYA", "KA"), ("HAVERI", "KA"), ("AHMEDNAGAR", "MH"), ("LATUR", "MH"), ("SITAPUR", "UP"),
         ("BARABANKI", "UP"), ("VIDISHA", "MP"), ("THANJAVUR", "TN"), ("BATHINDA", "PB"), ("NADIA", "WB")]
DISCOMS = {"TS": "TSSPDCL", "AP": "APSPDCL", "KA": "BESCOM", "MH": "MSEDCL", "TN": "TANGEDCO", "DL": "BSES RAJDHANI",
           "WB": "WBSEDCL", "UP": "UPPCL", "RJ": "JVVNL", "BR": "SBPDCL", "MP": "MPPKVVCL", "KL": "KSEB", "PB": "PSPCL"}
DISCOMS_ALT = {"TS": "TGSPDCL", "KA": "CESC MYSORE", "DL": "TATA POWER DDL", "MH": "TATA POWER MUMBAI",
               "WB": "CESC LTD", "TN": "TNPDCL", "UP": "PVVNL", "AP": "APEPDCL"}

# --------------------------------------------------------------------------- banks

BANKS = {
    "SBI": ("SBIN", "State Bank of India"), "HDFC": ("HDFC", "HDFC Bank"), "ICICI": ("ICIC", "ICICI Bank"),
    "AXIS": ("UTIB", "Axis Bank"), "KOTAK": ("KKBK", "Kotak Mahindra Bank"), "CANARA": ("CNRB", "Canara Bank"),
    "BOB": ("BARB", "Bank of Baroda"), "PNB": ("PUNB", "Punjab National Bank"),
}
BANK_WEIGHTS = {
    "salaried": [0.25, 0.25, 0.2, 0.12, 0.08, 0.04, 0.03, 0.03],
    "gig_worker": [0.35, 0.12, 0.12, 0.12, 0.09, 0.08, 0.06, 0.06],
    "shopkeeper": [0.3, 0.15, 0.12, 0.1, 0.08, 0.1, 0.08, 0.07],
    "farmer": [0.4, 0.03, 0.04, 0.03, 0.02, 0.2, 0.12, 0.16],
    "student": [0.4, 0.15, 0.12, 0.1, 0.08, 0.06, 0.05, 0.04],
    "homemaker": [0.42, 0.06, 0.06, 0.05, 0.04, 0.15, 0.1, 0.12],
}
PAYEE_BANKS = ["YESB", "ICIC", "HDFC", "SBIN", "UTIB", "KKBK", "PYTM", "AIRP", "IDFB", "BARB", "CNRB", "PUNB", "INDB"]
BANK_LONG = {"YESB": "YES BANK", "ICIC": "ICICI Bank", "HDFC": "HDFC BANK LTD", "SBIN": "State Bank Of India",
             "UTIB": "AXIS BANK", "KKBK": "Kotak Mahindra", "PYTM": "Paytm Payments", "AIRP": "Airtel Payments",
             "IDFB": "IDFC FIRST", "BARB": "Bank of Baroda", "CNRB": "Canara Bank", "PUNB": "Punjab National",
             "INDB": "IndusInd Bank"}
VPA_HANDLES = ["okaxis", "oksbi", "okicici", "okhdfcbank", "ybl", "paytm", "ibl", "axl", "apl", "upi", "kotak"]


@dataclass
class Party:
    name: str          # as printed in narrations (upper case)
    vpa: str
    bank: str          # 4-letter IFSC prefix of counterparty bank
    group: str         # identity key for group splits
    brand: str = ""    # pretty name for income-source display


# --------------------------------------------------------------------------- merchant catalogue

def _m(name, vpa, bank="YESB", brand=None):
    return Party(name, vpa, bank, "m:" + (brand or name).lower(), brand or name.title())


MERCHANTS: dict[str, list[Party]] = {
    "food_delivery": [
        _m("SWIGGY", "swiggy.stores@axb", "UTIB", "Swiggy"), _m("BUNDL TECHNOLOGIES", "swiggyupi@axisbank", "UTIB", "Swiggy Instamart"),
        _m("ZOMATO", "zomato.payu@hdfcbank", "HDFC", "Zomato"), _m("ZOMATO LTD", "zomatoorder@icici", "ICIC", "Zomato Orders"),
        _m("EATSURE", "eatsure@ybl", "YESB", "EatSure"), _m("DOMINOS PIZZA", "jubilantfood@hdfcbank", "HDFC", "Dominos"),
        _m("MCDONALDS", "hardcastle@icici", "ICIC", "McDonalds"), _m("KFC", "devyani.kfc@axisbank", "UTIB", "KFC"),
        _m("REBEL FOODS", "faasos@ybl", "YESB", "Faasos"), _m("BOX8", "box8@icici", "ICIC", "Box8"),
        _m("PIZZA HUT", "pizzahut@ybl", "YESB", "Pizza Hut"), _m("PARADISE BIRYANI", "paradisefood@hdfcbank", "HDFC", "Paradise"),
        _m("BEHROUZ BIRYANI", "behrouz@ybl", "YESB", "Behrouz"), _m("CHAAYOS", "chaayos@icici", "ICIC", "Chaayos"),
        _m("BURGER KING", "burgerking@axisbank", "UTIB", "Burger King"), _m("MAGICPIN", "magicpin@ybl", "YESB", "magicpin"),
    ],
    "groceries": [
        _m("AVENUE SUPERMARTS LTD", "dmart@icici", "ICIC", "DMart"), _m("DMART", "dmartavenue@ybl", "YESB", "DMart Ready"),
        _m("BIGBASKET", "bigbasket@icici", "ICIC", "BigBasket"), _m("INNOVATIVE RETAIL CONCEPTS", "bbinstant@hdfcbank", "HDFC", "bbnow"),
        _m("BLINKIT", "blinkit.payu@hdfcbank", "HDFC", "Blinkit"), _m("ZEPTO", "zepto@ybl", "YESB", "Zepto"),
        _m("KIRANAKART TECHNOLOGIES", "zeptonow@axisbank", "UTIB", "Zepto Now"), _m("JIOMART", "jiomart@sbi", "SBIN", "JioMart"),
        _m("RELIANCE RETAIL", "relianceretail@icici", "ICIC", "Reliance Smart"), _m("MORE RETAIL", "moreretail@ybl", "YESB", "More"),
        _m("RATNADEEP SUPER MARKET", "ratnadeep@ybl", "YESB", "Ratnadeep"), _m("SPENCERS RETAIL", "spencers@hdfcbank", "HDFC", "Spencers"),
        _m("VIJETHA SUPERMARKET", "vijetha@icici", "ICIC", "Vijetha"), _m("STAR BAZAAR", "starbazaar@axisbank", "UTIB", "Star Bazaar"),
        _m("NILGIRIS", "nilgiris@ybl", "YESB", "Nilgiris"), _m("HERITAGE FRESH", "heritagefresh@icici", "ICIC", "Heritage Fresh"),
        _m("COUNTRY DELIGHT", "countrydelight@icici", "ICIC", "Country Delight"), _m("MILKBASKET", "milkbasket@ybl", "YESB", "Milkbasket"),
    ],
    "fuel_transport": [
        _m("INDIAN OIL", "iocl.petrol@sbi", "SBIN", "Indian Oil"), _m("HPCL", "hpcl.fuel@icici", "ICIC", "HP Petrol"),
        _m("BHARAT PETROLEUM", "bpcl@axisbank", "UTIB", "BPCL"), _m("NAYARA ENERGY", "nayara@ybl", "YESB", "Nayara"),
        _m("SHELL INDIA", "shellindia@hdfcbank", "HDFC", "Shell"), _m("UBER INDIA", "uber.rides@axisbank", "UTIB", "Uber"),
        _m("OLA CABS", "olacabs@ybl", "YESB", "Ola"), _m("RAPIDO BIKE TAXI", "rapido@axisbank", "UTIB", "Rapido"),
        _m("IRCTC", "irctc@sbi", "SBIN", "IRCTC"), _m("HYDERABAD METRO RAIL", "hmrl@icici", "ICIC", "Hyd Metro"),
        _m("BMRCL", "bmrcl@sbi", "SBIN", "Namma Metro"), _m("REDBUS", "redbus@icici", "ICIC", "redBus"),
        _m("TSRTC", "tsrtc@sbi", "SBIN", "TGSRTC"), _m("PAYTM FASTAG", "fastag@paytm", "PYTM", "FASTag"),
        _m("ABHIBUS", "abhibus@ybl", "YESB", "AbhiBus"), _m("NAMMA YATRI", "nammayatri@ybl", "YESB", "Namma Yatri"),
    ],
    "shopping": [
        _m("AMAZON PAY", "amazon@apl", "UTIB", "Amazon"), _m("AMAZON SELLER SERVICES", "amazonseller@icici", "ICIC", "Amazon India"),
        _m("FLIPKART", "flipkart.payu@axisbank", "UTIB", "Flipkart"), _m("MYNTRA", "myntra@icici", "ICIC", "Myntra"),
        _m("MEESHO", "meesho@ybl", "YESB", "Meesho"), _m("AJIO", "ajio@sbi", "SBIN", "Ajio"),
        _m("NYKAA", "nykaa@icici", "ICIC", "Nykaa"), _m("RELIANCE TRENDS", "trends@ybl", "YESB", "Trends"),
        _m("DECATHLON", "decathlon@hdfcbank", "HDFC", "Decathlon"), _m("CROMA", "croma@icici", "ICIC", "Croma"),
        _m("LENSKART", "lenskart@ybl", "YESB", "Lenskart"), _m("MAX FASHION", "maxfashion@axisbank", "UTIB", "Max"),
        _m("ZUDIO", "zudio@icici", "ICIC", "Zudio"), _m("PANTALOONS", "pantaloons@ybl", "YESB", "Pantaloons"),
        _m("V MART RETAIL", "vmart@icici", "ICIC", "V-Mart"), _m("SHOPSY", "shopsy@axisbank", "UTIB", "Shopsy"),
    ],
    "healthcare": [
        _m("APOLLO PHARMACY", "apollopharmacy@icici", "ICIC", "Apollo Pharmacy"), _m("MEDPLUS", "medplus@ybl", "YESB", "MedPlus"),
        _m("PHARMEASY", "pharmeasy@axisbank", "UTIB", "PharmEasy"), _m("TATA 1MG", "1mg@hdfcbank", "HDFC", "Tata 1mg"),
        _m("NETMEDS", "netmeds@icici", "ICIC", "Netmeds"), _m("APOLLO HOSPITALS", "apollohosp@icici", "ICIC", "Apollo Hospitals"),
        _m("YASHODA HOSPITALS", "yashoda@hdfcbank", "HDFC", "Yashoda"), _m("CARE HOSPITALS", "carehosp@ybl", "YESB", "CARE Hospitals"),
        _m("VIJAYA DIAGNOSTIC", "vijayadiag@icici", "ICIC", "Vijaya Diagnostic"), _m("DR LAL PATHLABS", "lalpathlabs@ybl", "YESB", "Lal PathLabs"),
        _m("PRACTO", "practo@axisbank", "UTIB", "Practo"), _m("WELLNESS FOREVER", "wellness@icici", "ICIC", "Wellness Forever"),
    ],
    "education": [
        _m("BYJUS", "byjus@icici", "ICIC", "BYJU'S"), _m("UNACADEMY", "unacademy@ybl", "YESB", "Unacademy"),
        _m("PHYSICSWALLAH", "pw.live@axisbank", "UTIB", "PhysicsWallah"), _m("NARAYANA EDUCATIONAL", "narayana@hdfcbank", "HDFC", "Narayana"),
        _m("SRI CHAITANYA", "srichaitanya@icici", "ICIC", "Sri Chaitanya"), _m("DPS SCHOOL FEES", "dpsfees@sbi", "SBIN", "DPS"),
        _m("OSMANIA UNIVERSITY", "oufees@sbi", "SBIN", "Osmania University"), _m("JNTUH EXAM FEE", "jntuh@sbi", "SBIN", "JNTUH"),
        _m("COURSERA", "coursera@icici", "ICIC", "Coursera"), _m("UDEMY", "udemy@ybl", "YESB", "Udemy"),
        _m("ALLEN CAREER INST", "allen@hdfcbank", "HDFC", "Allen"), _m("KENDRIYA VIDYALAYA", "kvfees@sbi", "SBIN", "KV"),
    ],
    "betting_gaming": [
        _m("DREAM11", "dream11@icici", "ICIC", "Dream11"), _m("SPORTA TECHNOLOGIES", "dream11.cashfree@axisbank", "UTIB", "Dream11"),
        _m("MPL", "mpl.payu@hdfcbank", "HDFC", "MPL"), _m("GALACTUS FUNWARE", "mplgames@ybl", "YESB", "MPL Games"),
        _m("MY11CIRCLE", "my11circle@icici", "ICIC", "My11Circle"), _m("WINZO GAMES", "winzo@axisbank", "UTIB", "WinZO"),
        _m("RUMMYCIRCLE", "rummycircle@icici", "ICIC", "RummyCircle"), _m("A23 RUMMY", "a23@ybl", "YESB", "A23"),
        _m("JUNGLEE RUMMY", "jungleerummy@axisbank", "UTIB", "Junglee Rummy"), _m("POKERBAAZI", "pokerbaazi@ybl", "YESB", "PokerBaazi"),
        _m("PROBO MEDIA", "probo@icici", "ICIC", "Probo"), _m("ZUPEE", "zupee@ybl", "YESB", "Zupee"),
    ],
}
UTILITY_OTHER = [
    _m("ACT FIBERNET", "actfibernet@icici", "ICIC", "ACT Fibernet"), _m("AIRTEL XSTREAM FIBER", "airtelbroadband@airtel", "AIRP", "Airtel Fiber"),
    _m("JIOFIBER", "jiofiber@sbi", "SBIN", "JioFiber"), _m("HATHWAY BROADBAND", "hathway@ybl", "YESB", "Hathway"),
    _m("BSNL FTTH", "bsnlftth@sbi", "SBIN", "BSNL Fibre"), _m("TATA PLAY", "tataplay@icici", "ICIC", "Tata Play"),
    _m("HMWSSB WATER", "hmwssb@sbi", "SBIN", "HMWSSB"), _m("BWSSB", "bwssb@sbi", "SBIN", "BWSSB"),
    _m("MAHANAGAR GAS", "mgl@icici", "ICIC", "Mahanagar Gas"), _m("INDRAPRASTHA GAS", "igl@hdfcbank", "HDFC", "IGL"),
]
GAS_CYL = [_m("INDANE GAS", "indane@sbi", "SBIN", "Indane"), _m("HP GAS", "hpgas@icici", "ICIC", "HP Gas"),
           _m("BHARAT GAS", "bharatgas@axisbank", "UTIB", "Bharat Gas")]
TELCOS = [_m("RELIANCE JIO", "jio@sbi", "SBIN", "Jio"), _m("JIO PREPAID", "jioprepaid@hdfcbank", "HDFC", "Jio"),
          _m("AIRTEL PREPAID", "airtelprepaid@airtel", "AIRP", "Airtel"), _m("BHARTI AIRTEL", "airtel@icici", "ICIC", "Airtel"),
          _m("VODAFONE IDEA", "vi.prepaid@ybl", "YESB", "Vi"), _m("BSNL PREPAID", "bsnl@sbi", "SBIN", "BSNL")]
LENDERS = [  # (legal name in ACH narrations, brand)
    ("BAJAJ FINANCE LTD", "Bajaj Finance"), ("HDFC BANK LTD LOAN", "HDFC Bank"), ("ICICI BANK LTD", "ICICI Bank"),
    ("TATA CAPITAL FINANCIAL", "Tata Capital"), ("HDB FINANCIAL SERVICES", "HDB Financial"), ("HOME CREDIT INDIA", "Home Credit"),
    ("SHRIRAM FINANCE LTD", "Shriram Finance"), ("MAHINDRA FINANCE", "Mahindra Finance"), ("L AND T FINANCE", "L&T Finance"),
    ("HERO FINCORP LTD", "Hero FinCorp"), ("TVS CREDIT SERVICES", "TVS Credit"), ("MUTHOOT FINANCE", "Muthoot Finance"),
    ("MANAPPURAM FINANCE", "Manappuram"), ("AXIS BANK RETAIL LOAN", "Axis Bank"), ("IDFC FIRST BANK", "IDFC FIRST"),
    ("CHOLAMANDALAM INV", "Chola"), ("AAVAS FINANCIERS", "Aavas"), ("SBI CARDS", "SBI Card"),
]
LOAN_APPS = [  # (legal, brand, vpa)
    ("KREDITBEE", "KreditBee", "kreditbee@icici"), ("FINNOVATION TECH", "KreditBee", "kbee.repay@axisbank"),
    ("MONEYVIEW", "MoneyView", "moneyview@ybl"), ("WHIZDM FINANCE", "MoneyView", "whizdm@icici"),
    ("NAVI FINSERV", "Navi", "navi@axisbank"), ("FIBE", "Fibe", "fibe.earlysalary@icici"),
    ("CASHE", "CASHe", "cashe@ybl"), ("MPOKKET", "mPokket", "mpokket@icici"), ("SLICE", "slice", "slice@sbi"),
    ("LAZYPAY", "LazyPay", "lazypay@ybl"), ("SIMPL", "Simpl", "getsimpl@axisbank"), ("KISSHT", "Kissht", "kissht@icici"),
    ("PAYSENSE", "PaySense", "paysense@ybl"), ("TRUEBALANCE", "TrueBalance", "truebalance@icici"),
    ("STASHFIN", "StashFin", "stashfin@axisbank"), ("SMARTCOIN", "SmartCoin", "smartcoin@ybl"),
]
INSURERS = [("LIFE INSURANCE CORPORATION", "LIC"), ("LIC OF INDIA", "LIC"), ("HDFC LIFE INSURANCE", "HDFC Life"),
            ("SBI LIFE INSURANCE", "SBI Life"), ("ICICI PRUDENTIAL LIFE", "ICICI Pru Life"), ("STAR HEALTH INSURANCE", "Star Health"),
            ("ACKO GENERAL INSURANCE", "Acko"), ("PMSBY PREMIUM", "PMSBY"), ("PMJJBY PREMIUM", "PMJJBY"),
            ("MAX LIFE INSURANCE", "Max Life"), ("NIVA BUPA HEALTH", "Niva Bupa"), ("TATA AIA LIFE", "Tata AIA")]
INVESTMENTS = [("BSE STAR MF", "Mutual fund SIP"), ("INDIAN CLEARING CORP", "Mutual fund SIP"), ("NSE CLEARING LTD", "Mutual fund SIP"),
               ("GROWW INVEST TECH", "Groww"), ("ZERODHA BROKING", "Zerodha"), ("ICICI PRU MUTUAL FUND", "ICICI Pru MF"),
               ("SBI MUTUAL FUND", "SBI MF"), ("PARAG PARIKH MF", "PPFAS MF"), ("JAR GOLD SAVINGS", "Jar"),
               ("SAFEGOLD", "SafeGold"), ("NPS TRUST", "NPS"), ("HDFC MUTUAL FUND", "HDFC MF")]
GIG_PLATFORMS = [  # (legal, brand, vpa, cadence)
    ("BUNDL TECHNOLOGIES PVT LTD", "Swiggy", "swiggypartner@axisbank", "weekly"),
    ("ZOMATO LIMITED", "Zomato", "zomatopayouts@hdfcbank", "weekly"),
    ("UBER INDIA SYSTEMS PVT LTD", "Uber", "uberpayouts@icici", "weekly"),
    ("ROPPEN TRANSPORTATION SERVICES", "Rapido", "rapidocaptain@axisbank", "daily"),
    ("URBANCLAP TECHNOLOGIES", "Urban Company", "ucpartner@icici", "weekly"),
    ("ANI TECHNOLOGIES PVT LTD", "Ola", "olapayouts@ybl", "weekly"),
    ("SMARTSHIFT LOGISTICS", "Porter", "porterpartner@icici", "daily"),
    ("KIRANAKART TECHNOLOGIES", "Zepto", "zeptorider@axisbank", "weekly"),
    ("BLINK COMMERCE PVT LTD", "Blinkit", "blinkitrider@hdfcbank", "weekly"),
    ("SHADOWFAX TECHNOLOGIES", "Shadowfax", "shadowfax@icici", "weekly"),
    ("DUNZO DIGITAL", "Dunzo", "dunzopartner@ybl", "weekly"),
    ("AMAZON FLEX", "Amazon Flex", "amazonflex@apl", "weekly"),
]
SETTLERS = [("PHONEPE MERCHANT SETTLEMENT", "PhonePe", "phonepe.settlement@ybl"),
            ("PAYTM PAYMENTS SERVICES", "Paytm", "paytm.settle@paytm"),
            ("BHARATPE SETTLEMENT", "BharatPe", "bharatpe.settle@icici"),
            ("RAZORPAY SOFTWARE", "Razorpay", "razorpay.payouts@icici"),
            ("GOOGLE PAY MERCHANT", "Google Pay for Business", "gpaymerchant@okaxis"),
            ("PINE LABS POS SETTLE", "Pine Labs", "pinelabs@hdfcbank")]
EMPLOYER_STEMS = ["TECH MAHINDRA", "INFOSYS", "WIPRO", "COGNIZANT", "GENPACT", "CONCENTRIX", "TELEPERFORMANCE",
                  "RELIANCE RETAIL", "DMART", "APOLLO HOSPITALS", "YASHODA", "NARAYANA", "SRI CHAITANYA", "HDFC BANK",
                  "BLUE DART", "DELHIVERY", "TATA CONSULTANCY", "CAPGEMINI", "HCL", "VARUN MOTORS", "SAI ENTERPRISES",
                  "SRI VENKATESWARA", "BALAJI", "GREENPLY", "AMARA RAJA", "DR REDDYS", "AUROBINDO", "CYIENT",
                  "MAX HEALTHCARE", "MEDPLUS", "ICICI LOMBARD", "SECURITAS", "G4S", "QUESS CORP", "TEAMLEASE"]
EMPLOYER_SUFFIX = ["PVT LTD", "LIMITED", "SERVICES PVT LTD", "SOLUTIONS PVT LTD", "INDIA PVT LTD", "LTD", "ENTERPRISES"]
SHOP_WORDS = ["SRI LAKSHMI", "BALAJI", "SAI", "GANESH", "MAA DURGA", "NEW", "RAJ", "AL HABIB", "SHREE RAM",
              "VENKATESHWARA", "ANNAPURNA", "KRISHNA", "MAHALAXMI", "JAI HIND", "BISMILLAH", "SAGAR", "VINAYAKA"]
KIRANA_SUFFIX = ["KIRANA STORE", "GENERAL STORES", "PROVISION STORE", "SUPER MARKET", "KIRANA & GENERAL", "TRADERS",
                 "MART", "FRESH", "DAILY NEEDS", "VEGETABLES", "MILK CENTRE", "FRUITS"]
SUPPLIER_SUFFIX = ["WHOLESALE", "DISTRIBUTORS", "AGENCIES", "TRADING CO", "ENTERPRISES", "MARKETING", "AGRO TRADERS",
                   "FERTILIZERS", "SEEDS CORPORATION", "HARDWARE"]
RENT_REMARKS = ["rent", "house rent", "room rent", "Rent", "RENT", "flat rent", "shop rent", "pg rent", "rent oct",
                "monthly rent", "hostel fee rent"]
FAMILY_REMARKS = ["from papa", "pocket money", "ghar kharcha", "for home", "amma", "household", "monthly exp",
                  "kharcha", "from bhai", "for fees", "maintenance", "home exp"]
P2P_REMARKS = ["", "", "", "", "ok", "thanks", "paid", "payment", "sent", "UPI", "chai", "dinner", "split",
               "trip", "share", "return"]


def _name(rng: random.Random, gender: str | None = None) -> str:
    g = gender or rng.choice("MF")
    first = rng.choice(FIRST_F if g == "F" else FIRST_M)
    return f"{first} {rng.choice(LAST)}"


def _person(rng: random.Random, gender: str | None = None) -> Party:
    name = _name(rng, gender).upper()
    first, last = name.split(" ", 1)
    style = rng.random()
    if style < 0.35:
        vpa = f"{rng.randint(6, 9)}{rng.randint(100000000, 999999999)}@{rng.choice(VPA_HANDLES)}"
    elif style < 0.7:
        vpa = f"{first.lower()}{last.lower()[:1]}{rng.randint(1, 999)}@{rng.choice(VPA_HANDLES)}"
    else:
        vpa = f"{first.lower()}.{last.lower()}@{rng.choice(VPA_HANDLES)}"
    printed = name if rng.random() < 0.6 else f"{first} {last[0]}"
    return Party(printed, vpa, rng.choice(PAYEE_BANKS), "p:" + name.lower(), name.title())


def _shop(rng: random.Random, suffixes=KIRANA_SUFFIX) -> Party:
    name = f"{rng.choice(SHOP_WORDS)} {rng.choice(suffixes)}"
    if rng.random() < 0.5:
        vpa = f"q{rng.randint(100000000, 999999999)}@ybl"
    elif rng.random() < 0.5:
        vpa = f"paytmqr{rng.randint(10**11, 10**12 - 1)}@paytm"
    else:
        vpa = f"bharatpe.{rng.randint(10**8, 10**9 - 1)}@fbpe"
    return Party(name, vpa, rng.choice(["YESB", "PYTM", "INDB", "ICIC"]), "s:" + name.lower(), name.title())


# --------------------------------------------------------------------------- narration rendering

def _rrn(rng: random.Random, d: date) -> str:
    return f"{d.year % 10}{d.timetuple().tm_yday:03d}{rng.randint(0, 23):02d}{rng.randint(0, 999999):06d}"


def _noise(rng: random.Random, s: str, p: float = 0.04) -> str:
    """Bank-side truncation and occasional typos."""
    if rng.random() < p and len(s) > 4:
        i = rng.randrange(1, len(s) - 1)
        op = rng.random()
        if op < 0.4:
            s = s[:i] + s[i + 1:]
        elif op < 0.8:
            s = s[:i] + s[i + 1] + s[i] + s[i + 2:]
        else:
            s = s[:i] + s[i] + s[i:]
    return s


class Narrator:
    """Renders narrations in the house style of one bank."""

    def __init__(self, bank: str, rng: random.Random, city: str):
        self.bank, self.rng, self.city = bank, rng, city
        self.card = f"{rng.choice(['4', '5', '6'])}{rng.randint(10000, 99999)}XXXXXX{rng.randint(1000, 9999)}"
        self.acct_tail = f"{rng.randint(1000, 9999)}"
        self.name_cut = {"SBI": 20, "HDFC": 22, "ICICI": 12, "AXIS": 18, "KOTAK": 20, "CANARA": 16, "BOB": 15, "PNB": 18}[bank]

    def _n(self, name: str) -> str:
        return _noise(self.rng, name[: self.name_cut]).strip()

    def upi(self, d: date, party: Party, credit: bool, remark: str = "") -> str:
        r, rng, b = _rrn(self.rng, d), self.rng, self.bank
        nm, vpa, pb = self._n(party.name), party.vpa, party.bank
        rem = remark[:12] if remark else rng.choice(["UPI", "Payment from Ph", "NA", "Pay to", "Sent from Paytm", ""])
        if b == "SBI":
            return f"{'BY' if credit else 'TO'} TRANSFER-UPI/{'CR' if credit else 'DR'}/{r}/{nm}/{pb}/{vpa[:16]}/{rem}--"
        if b == "HDFC":
            return f"UPI-{nm}-{vpa}-{pb}0{rng.choice(['MERUPI', '000001', 'PAYTM0', 'YBL000'])}-{r}-{rem or 'UPI'}"
        if b == "ICICI":
            return f"UPI/{nm}/{vpa}/{rem or 'NA'}/{BANK_LONG.get(pb, pb)}/{r}/{rng.choice(['ICI', 'AXI', 'YBL', 'PTM'])}{rng.randint(10**9, 10**10)}"
        if b == "AXIS":
            kind = "P2M" if party.group.startswith(("m:", "s:")) else "P2A"
            return f"UPI/{kind}/{r}/{nm}/{rem or 'UPI'}/{BANK_LONG.get(pb, pb)}"
        if b == "KOTAK":
            return f"UPI/{nm}/{r}/{rem or 'UPI Payment'}"
        if b == "BOB":
            return f"UPI/{r}/{'CR' if credit else 'DR'}/{nm}/{pb}/{vpa}"
        return f"UPI/{'CR' if credit else 'DR'}/{r}/{nm}/{pb}/{vpa}/{rem}".rstrip("/")

    def neft(self, d: date, name: str, credit: bool, remark: str = "") -> str:
        rng, b = self.rng, self.bank
        ifsc = f"{rng.choice(PAYEE_BANKS)}0{rng.randint(0, 999999):06d}"
        utr = f"{ifsc[:4]}N{d.year % 100}{d.timetuple().tm_yday:03d}{rng.randint(10**7, 10**8 - 1)}"
        nm = self._n(name)
        if b == "SBI":
            return f"{'BY' if credit else 'TO'} TRANSFER-NEFT*{ifsc}*{utr}*{nm}*{remark}--"
        if b == "HDFC":
            return f"NEFT {'CR' if credit else 'DR'}-{ifsc}-{nm}-{remark or 'NEFT'}-{utr}"
        if b == "ICICI":
            return f"NEFT-{utr}-{nm}-{remark}-{rng.randint(10**10, 10**11)}-{ifsc}"
        if b == "AXIS":
            return f"NEFT/{utr}/{nm}/{remark or ifsc[:4]}"
        if b == "KOTAK":
            return f"NEFT {utr} {nm} {remark}".strip()
        return f"NEFT {'CR' if credit else 'DR'}-{utr}-{nm}-{remark}".rstrip("-")

    def imps(self, d: date, name: str, credit: bool, remark: str = "") -> str:
        r, b, nm = _rrn(self.rng, d), self.bank, self._n(name)
        tail = f"XXXXXXX{self.rng.randint(1000, 9999)}"
        if b == "SBI":
            return f"{'BY' if credit else 'TO'} TRANSFER-IMPS/{r}/{nm}/{remark or 'IMPS'}"
        if b == "HDFC":
            return f"IMPS-{r}-{nm}-{self.rng.choice(PAYEE_BANKS)}-{tail}-{remark or 'IMPS'}"
        if b == "ICICI":
            return f"MMT/IMPS/{r}/{remark or 'IMPS'}/{nm}/{self.rng.choice(list(BANK_LONG.values()))[:12]}"
        if b == "AXIS":
            return f"IMPS/P2A/{r}/{tail}/{nm}/{remark or 'IMPS'}"
        return f"IMPS-{r}-{nm}-{remark}".rstrip("-")

    def ach(self, d: date, name: str, credit: bool = False) -> str:
        rng, b = self.rng, self.bank
        ref = f"{rng.choice(['P4', 'HD', 'TC', 'BF', 'IC'])}{rng.randint(10**9, 10**10)}"
        nm = self._n(name)
        if b == "SBI":
            return f"DEBIT-ACHDr {rng.choice(['HDFC', 'ICIC', 'UTIB', 'CITI'])}{rng.randint(10**15, 10**16)} {nm}" if not credit else f"BY TRANSFER-ACHCr {nm} {ref}"
        if b == "HDFC":
            return f"ACH {'C' if credit else 'D'}- {nm}-{ref}"
        if b == "ICICI":
            return f"ACH/{nm}/{ref}"
        if b == "AXIS":
            return f"ECS/ACH {'CR' if credit else 'DR'}/{nm}/{ref}"
        if b == "KOTAK":
            return f"ACH-{'CR' if credit else 'DR'}-{nm}-{ref}"
        return f"NACH-{'CR' if credit else 'DR'}-{nm}-{ref}" if rng.random() < 0.6 else f"ACH D-{nm}-{ref}"

    def bbps(self, d: date, biller: str) -> str:
        r, b = _rrn(self.rng, d), self.bank
        if b == "ICICI":
            return f"BIL/BPAY/{r}/{biller}"
        if b == "HDFC":
            return f"BBPS-{biller}-{r}"
        if b == "SBI":
            return f"TO TRANSFER-BBPS/{r}/{biller}--"
        return f"BBPS/{r}/{biller}/BILLPAY"

    def atm(self, d: date, aeps: bool = False) -> str:
        rng, b, city = self.rng, self.bank, self.city
        if aeps:
            return rng.choice([f"AEPS CASH WDL/{_rrn(rng, d)}/{city}", f"AEPS/CW/{_rrn(rng, d)}/BC AGENT",
                               f"MICRO ATM CASH WDL {city}"])
        atm_id = f"{rng.choice(['S1A', 'S1N', 'HDF', 'ICI', 'AXS', 'CNR'])}{rng.randint(1000, 9999)}"
        if b == "SBI":
            return f"ATM WDL-ATM CASH {rng.randint(1000, 9999)} {city}"
        if b == "HDFC":
            return f"{rng.choice(['ATW', 'NWD', 'EAW'])}-{self.card}-{atm_id}-{city}"
        if b == "ICICI":
            return f"ATM/CASH WDL/{d:%d-%m-%y}/{city}"
        if b == "AXIS":
            return f"ATM-CASH/{atm_id}/{city}"
        if b == "KOTAK":
            return f"ATL/{self.card}/{atm_id}/{city}"
        return f"ATM WDL {atm_id} {city}" if rng.random() < 0.7 else f"CASH WDL ATM {city}"

    def cash_dep(self, d: date) -> str:
        return self.rng.choice([f"BY CASH DEP-{self.city} BR", "CASH DEPOSIT SELF", f"CASH DEP {self.city}",
                                f"BY CASH-{self.city}", "CDM CASH DEPOSIT", f"CASH-CDM {self.city}"])

    def charge(self, kind: str) -> str:
        rng, b = self.rng, self.bank
        table = {
            "bounce": {"SBI": ["ACH RTN CHG", "NACH RETURN CHGS"], "HDFC": ["NACH RTN CHGS", "ACH D- RTN CHG"],
                       "ICICI": ["ECS RTN CHGS", "NACH RTN CHARGES"], "AXIS": ["ECS RETURN CHARGES", "ACH DR RTN CHG"],
                       "KOTAK": ["RTN CHG NACH", "MANDATE RTN CHG"], "*": ["RTN CHG", "NACH RTN CHG", "ECS RTN CHG"]},
            "minbal": {"SBI": ["MIN BAL CHGS"], "HDFC": ["AVG BAL NON MAINT CHG", "NON MAINT CHGS"],
                       "ICICI": ["NON MAINTENANCE CHARGES", "MIN BAL CHGS"], "AXIS": ["MIN BAL CHGS", "CONSOLIDATED CHARGES FOR A/C"],
                       "KOTAK": ["MAB CHG", "AMB NON MAINT CHG"], "*": ["MIN BAL CHGS", "NON MAINT CHG"]},
            "sms": {"*": ["SMS ALERT CHGS", "SMS CHARGES QTR", "SMS CHGS"]},
            "card": {"*": ["DEBIT CARD ANNUAL FEE", "ATM CARD AMC CHGS", "DC ANNUAL FEE+GST"]},
            "gst": {"*": ["GST ON CHGS", "CGST+SGST ON CHGS", "IGST ON CHARGES"]},
            "atmfee": {"*": ["EXCESS ATM WDL CHGS", "ATM TXN CHGS"]},
        }[kind]
        return rng.choice(table.get(b, table["*"]))

    def interest(self, d: date) -> str:
        b = self.bank
        q0 = date(d.year if d.month > 3 else d.year - 1, ((d.month - 4) % 12) // 3 * 3 + 4 if d.month > 3 else 1, 1)
        if b == "SBI":
            return "CREDIT INTEREST"
        if b == "HDFC":
            return "CREDIT INTEREST CAPITALISED"
        if b in ("ICICI", "AXIS"):
            return f"{self.rng.randint(10**9, 10**10)}:Int.Pd:{q0:%d-%m-%Y} to {d:%d-%m-%Y}"
        return f"INT.PD {q0:%d-%m-%Y} TO {d:%d-%m-%Y}"


# --------------------------------------------------------------------------- latent profile

@dataclass
class Profile:
    seed: int
    persona: str
    gender: str
    name: str
    bank: str
    city: str
    state: str
    months: int
    income: float                 # expected monthly income (net for business)
    discipline: float
    shock_p: float
    stress: float
    bettor: float                 # 0 = none, else intensity
    loanapp: float                # propensity
    emi_ratio: float              # existing EMI as share of income
    renter: bool
    eps: float                    # idiosyncratic unobserved risk
    wtp: float = 0.8              # repayment priority: keeps auto-debits funded on presentation day
    extra: dict = field(default_factory=dict)


def draw_profile(seed: int, persona: str | None = None, **overrides) -> Profile:
    rng = np.random.default_rng(seed)
    persona = persona or str(rng.choice(PERSONAS, p=PERSONA_MIX))
    gender = "F" if rng.random() < FEMALE_SHARE[persona] else "M"
    prng = random.Random(seed * 7919 + 1)
    name = _name(prng, gender)
    bank = str(rng.choice(list(BANKS), p=BANK_WEIGHTS[persona]))
    city, state = prng.choice(RURAL if persona == "farmer" or (persona == "homemaker" and rng.random() < 0.5) else CITIES)
    beta = {"salaried": (5, 3), "gig_worker": (3.5, 3), "shopkeeper": (4, 3), "farmer": (4, 3),
            "student": (3, 3), "homemaker": (5, 3)}[persona]
    discipline = float(rng.beta(*beta))
    shock_base = {"salaried": 0.025, "gig_worker": 0.07, "shopkeeper": 0.05, "farmer": 0.08,
                  "student": 0.04, "homemaker": 0.04}[persona]
    shock_p = float(np.clip(shock_base * rng.lognormal(0, 0.55), 0.005, 0.35))
    stress = float(np.clip(rng.beta(2, 4) + 0.15 * (0.5 - discipline) + rng.normal(0, 0.05), 0, 1))
    inc_med = {"salaried": 34000, "gig_worker": 22000, "shopkeeper": 26000, "farmer": 17000,
               "student": 9000, "homemaker": 13000}[persona]
    income = float(np.clip(inc_med * rng.lognormal(0, 0.42) * (1 - 0.25 * (stress - 0.33)), 4000, 250000))
    bet_p = {"salaried": 0.09, "gig_worker": 0.15, "shopkeeper": 0.08, "farmer": 0.04, "student": 0.15, "homemaker": 0.02}[persona]
    bet_p *= (1.6 - discipline) * (1.0 if gender == "M" else 0.35)
    bettor = float(rng.uniform(0.02, 0.12) * (1.3 - discipline)) if rng.random() < bet_p else 0.0
    loanapp = float(1 / (1 + math.exp(-(-2.3 + 3.2 * stress + 2.4 * (0.5 - discipline) + rng.normal(0, 0.6)))))
    emi_p = {"salaried": 0.5, "gig_worker": 0.38, "shopkeeper": 0.45, "farmer": 0.45, "student": 0.08, "homemaker": 0.35}[persona]
    emi_ratio = float(np.clip(rng.beta(2, 5) * (0.5 + 1.1 * stress), 0.03, 0.75)) if rng.random() < emi_p + 0.25 * stress else 0.0
    renter = bool(rng.random() < {"salaried": 0.62, "gig_worker": 0.66, "shopkeeper": 0.55, "farmer": 0.04,
                                    "student": 0.5, "homemaker": 0.2}[persona])
    months = int(rng.integers(6, 13))
    eps = float(rng.normal(0, 0.5))
    wtp = float(np.clip(rng.beta(5, 1.8) + 0.15 * (discipline - 0.6), 0, 1))
    p = Profile(seed, persona, gender, name, bank, city, state, months, income, discipline, shock_p, stress,
                bettor, loanapp, emi_ratio, renter, eps, wtp)
    for k, v in overrides.items():
        setattr(p, k, v)
    return p


def _risk_logit(p: Profile) -> float:
    """Applicant-level component of the future monthly default hazard."""
    return (3.2 * (0.6 - p.discipline) + 2.6 * (p.stress - 0.3) + 2.4 * p.emi_ratio + 7.0 * p.bettor
            + 0.6 * p.loanapp + 4.0 * (p.shock_p - 0.05) - 0.4 * math.log(p.income / 20000)
            + 3.0 * (0.75 - p.wtp) + p.eps)


MONTHLY_NOISE_SD = 0.25  # per-month logit noise in the future window (simulate_label)
_GH_X, _GH_W = np.polynomial.hermite_e.hermegauss(9)  # nodes/weights for E[f(N(0,1))]
_GH_W = _GH_W / _GH_W.sum()


def _default_prob(base: float, z, shock_p):
    """P(any default in 12 future months) under exactly the process `simulate_label` samples:
    each month is a shock month with prob `shock_p` (+2.2 logit) and carries independent
    N(0, MONTHLY_NOISE_SD) logit noise, integrated out by Gauss–Hermite quadrature.
    Vectorised over `z` / `shock_p`."""
    z = np.asarray(z, dtype=float)[..., None]
    s = np.asarray(shock_p, dtype=float)
    noise = MONTHLY_NOISE_SD * _GH_X
    h0 = (_GH_W / (1 + np.exp(-(base + z + noise)))).sum(-1)
    h1 = (_GH_W / (1 + np.exp(-(base + z + 2.2 + noise)))).sum(-1)
    return 1 - ((1 - s) * (1 - h0) + s * (1 - h1)) ** 12


@lru_cache(maxsize=1)
def calibrated_intercepts() -> dict[str, float]:
    """Persona intercepts so the expected population default rate hits the target per persona."""
    out = {}
    for persona in PERSONAS:
        profs = [draw_profile(10_000_000 + i, persona) for i in range(3000)]
        z = np.array([_risk_logit(p) for p in profs])
        s = np.array([p.shock_p for p in profs])
        lo, hi = -15.0, 2.0
        for _ in range(50):
            mid = (lo + hi) / 2
            rate = float(_default_prob(mid, z, s).mean())
            lo, hi = (mid, hi) if rate < TARGET_DEFAULT_RATE[persona] else (lo, mid)
        out[persona] = (lo + hi) / 2
    return out


def simulate_label(p: Profile) -> int:
    """Simulate the future 12-month window: fresh shocks + monthly noise."""
    rng = np.random.default_rng(p.seed + 99_991)
    base = calibrated_intercepts()[p.persona]
    z = _risk_logit(p)
    for _ in range(12):
        shock = rng.random() < p.shock_p
        h = 1 / (1 + math.exp(-(base + z + 2.2 * shock + rng.normal(0, MONTHLY_NOISE_SD))))
        if rng.random() < h:
            return 1
    return 0


# --------------------------------------------------------------------------- statement simulation

# event priorities: 0 credit, 1 mandatory auto-debit (NACH/ACH), 2 bill, 3 discretionary
CREDIT, MAND, BILL, DISC = 0, 1, 2, 3


class Statement:
    def __init__(self, p: Profile):
        self.p = p
        self.rng = random.Random(p.seed)
        self.np = np.random.default_rng(p.seed + 17)
        self.nar = Narrator(p.bank, self.rng, p.city)
        self.end = STATEMENT_END
        y, m = self.end.year, self.end.month - p.months + 1
        while m <= 0:
            m += 12
            y -= 1
        self.start = date(y, m, 1)
        self.events: list[tuple] = []
        self.seq = 0

    # -- helpers
    def add(self, d: date, prio: int, amount: float, category: str, narration: str, group: str, meta=None):
        if d < self.start or d > self.end or amount <= 0:
            return
        self.seq += 1
        self.events.append((d, prio, self.rng.random(), self.seq, round(amount, 2), category, narration, group, meta or {}))

    def month_starts(self):
        d = self.start
        while d <= self.end:
            yield d
            d = date(d.year + (d.month == 12), d.month % 12 + 1, 1)

    @staticmethod
    def dim(d: date) -> int:
        return calendar.monthrange(d.year, d.month)[1]

    def day(self, ms: date, dom: int) -> date:
        return ms.replace(day=max(1, min(dom, self.dim(ms))))

    def amt(self, mean: float, sd: float = 0.25, lo: float = 10) -> float:
        return max(lo, mean * self.np.lognormal(0, sd))

    def late(self) -> int:
        """Days of delay vs due date driven by discipline."""
        d = self.p.discipline
        if self.rng.random() < d:
            return self.rng.randint(-3, 1)
        return self.rng.randint(2, int(6 + 20 * (1 - d)))

    # -- income
    def income_events(self, shocks: dict):
        p, rng, nar = self.p, self.rng, self.nar
        months = list(self.month_starts())
        if p.persona == "salaried":
            emp = f"{rng.choice(EMPLOYER_STEMS)} {rng.choice(EMPLOYER_SUFFIX)}"
            group = "e:" + emp.lower()
            pay_day = rng.choice([1, 1, 2, 28, 30, 7, 5, 10])
            channel = rng.choice(["neft", "neft", "ach", "imps"])
            for ms in months:
                if shocks.get(ms) == "job":
                    continue
                d = self.day(ms, pay_day + rng.randint(0, 2))
                amt = p.income * (1 + self.np.normal(0, 0.02)) * (0.4 if shocks.get(ms) == "cut" else 1)
                rem = rng.choice([f"SALARY {ms:%b %y}".upper(), "SAL", f"SAL FOR {ms:%b%Y}".upper(), "SALARY", "PAYROLL", ""])
                if rng.random() < 0.88 and not rem:
                    rem = "SALARY"
                txt = {"neft": nar.neft, "imps": nar.imps}.get(channel, lambda d_, n, c, r: nar.ach(d_, n, True) + f" {r}")(d, emp, True, rem)
                self.add(d, CREDIT, round(amt, -1), "salary", txt, group, {"src": emp})
                if rng.random() < 0.08:  # reimbursement / bonus
                    self.add(self.day(ms, 15), CREDIT, self.amt(p.income * 0.12), "salary",
                             nar.neft(self.day(ms, 15), emp, True, rng.choice(["REIMB", "INCENTIVE", "BONUS"])), group)
        elif p.persona in ("gig_worker",) or (p.persona == "student" and rng.random() < 0.3):
            k = rng.choice([1, 1, 2, 2, 3])
            plats = rng.sample(GIG_PLATFORMS, k)
            share = self.np.dirichlet(np.ones(k) * 2)
            scale = 1.0 if p.persona == "gig_worker" else 0.35
            for (legal, brand, vpa, cadence), sh in zip(plats, share):
                party = Party(legal, vpa, rng.choice(["UTIB", "HDFC", "ICIC", "YESB"]), "g:" + brand.lower(), brand)
                for ms in months:
                    mult = {"loss": 0.25, "cut": 0.55}.get(shocks.get(ms), 1.0)
                    monthly = p.income * scale * sh * mult * self.np.lognormal(0, 0.18)
                    days = (list(range(1, self.dim(ms) + 1, 1)) if cadence == "daily"
                            else list(range(rng.randint(1, 7), self.dim(ms) + 1, 7)))
                    if cadence == "daily":
                        days = [x for x in days if rng.random() < 0.75]
                    for dd in days:
                        d = self.day(ms, dd)
                        a = monthly / max(1, len(days)) * self.np.lognormal(0, 0.3)
                        rem = rng.choice(["PAYOUT", "WEEKLY PAYOUT", "PARTNER PAYOUT", "SETTLEMENT", "EARNINGS", "INCENTIVE", ""])
                        r = rng.random()
                        txt = (nar.upi(d, party, True, rem) if r < 0.45 or cadence == "daily" else
                               nar.neft(d, legal, True, rem) if r < 0.75 else nar.imps(d, legal, True, rem))
                        self.add(d, CREDIT, round(a, 2), "gig_income", txt, party.group, {"src": brand})
        if p.persona == "shopkeeper":
            setts = rng.sample(SETTLERS, rng.choice([1, 2, 2, 3]))
            margin = rng.uniform(0.18, 0.32)
            gross = p.income / margin
            for ms in months:
                mult = {"loss": 0.4, "cut": 0.65}.get(shocks.get(ms), 1.0)
                for dd in range(1, self.dim(ms) + 1):
                    if rng.random() < 0.12:
                        continue
                    d = self.day(ms, dd)
                    for legal, brand, vpa in setts:
                        a = gross * mult * 0.55 / len(setts) / 26 * self.np.lognormal(0, 0.35)
                        party = Party(legal, vpa, "YESB", "t:" + brand.lower(), brand)
                        txt = (nar.neft(d, legal, True, rng.choice(["SETTLEMENT", "SETTL", "MERCHANT STL", ""]))
                               if rng.random() < 0.5 else nar.upi(d, party, True, "settlement"))
                        self.add(d, CREDIT, round(a, 2), "business_income", txt, party.group, {"src": brand})
                    for _ in range(self.np.poisson(1.4)):
                        cust = _person(rng)
                        shop_vpa = Party(cust.name, f"q{rng.randint(10**8, 10**9)}@ybl" if rng.random() < 0.5 else f"paytmqr{rng.randint(10**10, 10**11)}@paytm", cust.bank, "c:" + p.name.lower(), "QR customer payments")
                        self.add(d, CREDIT, round(self.amt(gross * 0.08 / 30, 0.8), 0), "business_income",
                                 nar.upi(d, shop_vpa, True, rng.choice(["", "QR", "Paid via QR", "goods"])), shop_vpa.group, {"src": "QR customer payments"})
                    if rng.random() < 0.18:
                        self.add(d, CREDIT, round(self.amt(gross * 0.35 / 5, 0.4), -2), "transfer_in_other", nar.cash_dep(d), "x:cashdep")
                # supplier stock purchases
                for _ in range(rng.randint(3, 7)):
                    sup = _shop(rng, SUPPLIER_SUFFIX)
                    d = self.day(ms, rng.randint(1, 28))
                    a = gross * mult * (1 - margin) / 5 * self.np.lognormal(0, 0.3)
                    txt = nar.neft(d, sup.name, False, "stock") if rng.random() < 0.4 else nar.upi(d, sup, False, rng.choice(["stock", "goods", "bill", ""]))
                    self.add(d, BILL, round(a, 0), "other", txt, sup.group, {"bill": "supplier"})
        if p.persona == "farmer":
            kisan_months = {2: "16TH", 6: "17TH", 10: "18TH"}
            ts = p.state == "TS"
            harvests = [(rng.choice([10, 11, 12]), 0.55), (rng.choice([3, 4, 5]), 0.45)]
            buyer = rng.choice(["FOOD CORPORATION OF INDIA", "FCI PADDY PROCUREMENT", "CCI COTTON PURCHASE",
                                "APMC MANDI", "NAFED PROCUREMENT", "TS CIVIL SUPPLIES PADDY", "CANE PAYMENT SUGARS",
                                "ENAM TRADE SETTLEMENT", "MARKFED", "SRI RAMA RICE MILL", "COMMISSION AGENT"])
            dairy = rng.random() < 0.45
            dairy_name = rng.choice(["VIJAYA DAIRY", "HERITAGE FOODS LTD", "AMUL DAIRY", "NANDINI KMF", "AAVIN MILK", "SANGAM DAIRY", "MOTHER DAIRY"])
            annual = p.income * 12
            for ms in months:
                if ms.month in kisan_months:
                    d = self.day(ms, rng.randint(1, 28))
                    rem = rng.choice([f"PMKISAN {kisan_months[ms.month]} INST", "PM KISAN SAMMAN NIDHI", "PM-KISAN", "PMKSNY"])
                    self.add(d, CREDIT, 2000, "agri_income", nar.neft(d, "PM KISAN", True, rem) if rng.random() < 0.5 else f"BY TRANSFER-{rem}-DBT/{_rrn(rng, d)}", "a:pmkisan", {"src": "PM-KISAN"})
                if ts and ms.month in (6, 12):
                    d = self.day(ms, rng.randint(1, 28))
                    self.add(d, CREDIT, round(self.amt(annual * 0.04, 0.2), -2), "agri_income",
                             rng.choice(["RYTHU BHAROSA DBT", "RYTHU BANDHU DBT", "TS AGRI DEPT INPUT SUPPORT"]) + f"/{_rrn(rng, d)}", "a:rythu", {"src": "Rythu Bharosa"})
                for hm, sh in harvests:
                    if ms.month == hm:
                        mult = {"loss": 0.2, "cut": 0.55}.get(shocks.get(ms), 1.0)
                        for part in range(rng.choice([1, 2, 3])):
                            d = self.day(ms, rng.randint(1, 28))
                            a = annual * (0.82 if dairy else 0.92) * sh * mult / 2 * self.np.lognormal(0, 0.25)
                            self.add(d, CREDIT, round(a, 0), "agri_income", nar.neft(d, buyer, True, rng.choice(["MSP PAYMENT", "PADDY", "CROP SALE", "PROCUREMENT", ""])), "a:" + buyer.lower(), {"src": buyer.title()})
                if dairy:
                    for dd in (rng.randint(1, 3), rng.randint(15, 17)):
                        d = self.day(ms, dd)
                        self.add(d, CREDIT, round(self.amt(annual * 0.18 / 24, 0.2), 0), "agri_income",
                                 nar.neft(d, dairy_name, True, rng.choice(["MILK BILL", "MILK PAYMENT", "FORTNIGHT PAY"])), "a:" + dairy_name.lower(), {"src": dairy_name.title()})
                if ms.month in (5, 6, 10, 11):  # input purchases before sowing
                    for _ in range(rng.randint(1, 3)):
                        sup = _shop(rng, ["FERTILIZERS", "SEEDS CORPORATION", "AGRO TRADERS", "PESTICIDES", "AGRI CLINIC"])
                        d = self.day(ms, rng.randint(1, 28))
                        self.add(d, BILL, round(self.amt(annual * 0.06, 0.3), 0), "other",
                                 nar.upi(d, sup, False, rng.choice(["seeds", "urea", "DAP", "pesticide", ""])), sup.group, {"bill": "supplier"})
        if p.persona == "student":
            parent = _person(rng)
            parent.brand = "Family support"
            day0 = rng.randint(1, 10)
            for ms in months:
                d = self.day(ms, day0 + rng.randint(0, 4))
                mult = 0.5 if shocks.get(ms) else 1.0
                rem = rng.choice(FAMILY_REMARKS + [""] * 4)
                txt = nar.upi(d, parent, True, rem) if rng.random() < 0.7 else nar.imps(d, parent.name, True, rem)
                self.add(d, CREDIT, round(p.income * 0.85 * mult * self.np.lognormal(0, 0.1), -2), "family_transfer_in", txt, parent.group, {"src": "Family support"})
            sch = rng.random() < 0.45
            if sch:
                ms = rng.choice(months)
                d = self.day(ms, rng.randint(1, 28))
                nm = rng.choice(["NSP SCHOLARSHIP", "TS EPASS SCHOLARSHIP", "AP JAGANANNA VIDYA DEEVENA", "POST MATRIC SCHOLARSHIP DBT",
                                 "MAHADBT SCHOLARSHIP", "SSP KARNATAKA SCHOLARSHIP"])
                self.add(d, CREDIT, round(self.amt(p.income * 2.5, 0.3), -2), "family_transfer_in",
                         f"{nm}/{_rrn(rng, d)}" if rng.random() < 0.5 else nar.neft(d, nm, True, "DBT"), "f:" + nm.lower(), {"src": "Scholarship"})
        if p.persona == "homemaker":
            spouse = _person(rng, "M")
            spouse.brand = "Family support"
            day0 = rng.randint(1, 8)
            for ms in months:
                d = self.day(ms, day0 + rng.randint(0, 5))
                mult = {"loss": 0.4, "cut": 0.7, "job": 0.3}.get(shocks.get(ms), 1.0)
                rem = rng.choice(["ghar kharcha", "household", "for home", "monthly exp", "kharcha", "", "", ""])
                txt = nar.upi(d, spouse, True, rem) if rng.random() < 0.65 else nar.imps(d, spouse.name, True, rem)
                self.add(d, CREDIT, round(p.income * 0.78 * mult * self.np.lognormal(0, 0.12), -2), "family_transfer_in", txt, spouse.group, {"src": "Family support"})
                for _ in range(self.np.poisson(3.5)):
                    cust = _person(rng, "F")
                    cust.group = "c:" + p.name.lower()
                    cust.brand = "Tailoring customers"
                    dd = self.day(ms, rng.randint(1, 28))
                    self.add(dd, CREDIT, round(self.amt(p.income * 0.22 / 3.5, 0.5), -1), "business_income",
                             nar.upi(dd, cust, True, rng.choice(["blouse stitching", "stitching", "tailoring", "blouse", "dress stitch", "alteration"])), cust.group, {"src": "Tailoring customers"})
            if rng.random() < 0.6:  # SHG / Stree Nidhi loan
                shg = rng.choice(["STREE NIDHI CREDIT COOP", "SHG BANK LINKAGE", "DWCRA SHG GROUP", "SERP SHG LOAN", "MAHILA SHG FEDERATION"])
                ms = months[rng.randrange(len(months))]
                d = self.day(ms, rng.randint(1, 20))
                self.add(d, CREDIT, round(self.amt(p.income * 2.5, 0.3), -3), "transfer_in_other", nar.neft(d, shg, True, "SHG LOAN DISB"), "l:" + shg.lower())
                self.p.extra["shg"] = (shg, d)

    # -- spending
    def spending_events(self, shocks: dict):
        p, rng, nar = self.p, self.rng, self.nar
        inc, D = p.income, p.discipline
        months = list(self.month_starts())
        urban = p.persona not in ("farmer",) and p.city not in [c for c, _ in RURAL]
        # recurring commitments
        if p.renter:
            landlord = _person(rng)
            rent = inc * rng.uniform(0.15, 0.32)
            due = rng.choice([1, 3, 5, 5, 7, 10])
            remark_p = rng.uniform(0.6, 0.98)
            nobroker = rng.random() < 0.15
            for ms in months:
                d = self.day(ms, due + self.late())
                if nobroker:
                    party = Party("NOBROKER RENT", "nobroker.rent@icici", "ICIC", "m:nobroker")
                    txt = nar.upi(d, party, False, "rent")
                elif rng.random() < remark_p:
                    txt = nar.upi(d, landlord, False, rng.choice(RENT_REMARKS)) if rng.random() < 0.8 else nar.imps(d, landlord.name, False, rng.choice(RENT_REMARKS))
                else:
                    txt = nar.upi(d, landlord, False, "")
                self.add(d, BILL, round(rent, -2), "rent", txt, landlord.group, {"bill": "rent", "due": due})
        disc = DISCOMS.get(p.state, "TSSPDCL") if rng.random() < 0.8 else DISCOMS_ALT.get(p.state, DISCOMS.get(p.state, "BESCOM"))
        elec = max(150, inc * rng.uniform(0.015, 0.04))
        elec_due = rng.randint(8, 20)
        bb = rng.choice(UTILITY_OTHER) if urban and rng.random() < 0.45 + 0.3 * (p.persona == "salaried") else None
        bb_amt = rng.choice([399, 499, 589, 699, 799, 999, 1178])
        gas = rng.choice(GAS_CYL)
        telco = rng.choice(TELCOS)
        plan = rng.choice([199, 239, 249, 299, 349, 399, 479, 666, 719, 859])
        for ms in months:
            d = self.day(ms, elec_due + self.late())
            a = elec * self.np.lognormal(0, 0.18) * (1.3 if ms.month in (4, 5, 6) else 1)
            r = rng.random()
            if r < 0.4:
                txt = nar.bbps(d, f"{disc} ELECTRICITY")
            elif r < 0.75:
                txt = nar.upi(d, Party(f"{disc}", f"{disc.lower().replace(' ', '')}.bbps@{rng.choice(['icici', 'sbi', 'hdfcbank'])}", "SBIN", "m:" + disc.lower()), False, rng.choice(["electricity", "power bill", "Bill Payment", "EB bill", ""]))
            else:
                party = Party(rng.choice(["PHONEPE BILLPAY", "PAYTM BILLPAY", "AMAZON PAY BILL", "CRED BILLPAY"]), "billpay@ybl", "YESB", "m:billpay")
                txt = nar.upi(d, party, False, f"{disc[:8]} elec")
            self.add(d, BILL, round(a, 0), "utilities", txt, "m:" + disc.lower(), {"bill": "electricity"})
            if bb:
                d = self.day(ms, 3 + self.late())
                self.add(d, BILL, bb_amt, "utilities", nar.upi(d, bb, False, rng.choice(["broadband", "internet", "fiber bill", ""])) if rng.random() < 0.6 else nar.bbps(d, bb.name), bb.group, {"bill": "broadband"})
            if rng.random() < 0.55:
                d = self.day(ms, rng.randint(1, 28))
                self.add(d, BILL, rng.choice([853, 903, 1103, 829, 918]), "utilities", nar.upi(d, gas, False, rng.choice(["cylinder", "LPG", "gas booking", ""])), gas.group)
            # mobile recharge every ~28 days (two phones in some households)
            for _ in range(1 + (rng.random() < 0.35)):
                d = self.day(ms, rng.randint(1, 28) if D < 0.5 else 12 + rng.randint(-1, 1))
                self.add(d, BILL, plan, "mobile_recharge", nar.upi(d, telco, False, rng.choice(["recharge", "prepaid", "Recharge", "mobile", ""])), telco.group, {"bill": "recharge"})
        # EMIs
        lenders = []
        if p.emi_ratio > 0:
            n = 1 if p.emi_ratio < 0.2 else rng.choice([1, 2, 2, 3])
            for share in self.np.dirichlet(np.ones(n) * 3):
                legal, brand = rng.choice(LENDERS[:16] if p.persona != "farmer" else LENDERS[10:13] + LENDERS[5:9])
                emi = round(inc * p.emi_ratio * share, -1)
                lenders.append((legal, brand, emi, rng.choice([2, 3, 5, 5, 7, 10, 15])))
        if p.persona == "farmer" and rng.random() < 0.5:
            lenders.append(("KCC LOAN INT RECOVERY", "Kisan Credit Card", round(inc * 0.06, -1), 28))
        if "shg" in p.extra:
            shg, d0 = p.extra["shg"]
            lenders.append((shg + " REPAY", "SHG loan", round(inc * 0.2, -1), 10))
        for legal, brand, emi, dd in lenders:
            for ms in months:
                d = self.day(ms, dd)
                txt = (nar.ach(d, legal) if rng.random() < 0.85 else f"EMI {rng.randint(10**6, 10**7)} CHQ S{rng.randint(10**7, 10**8)} {legal[:12]}")
                if "SHG" in legal or "STREE" in legal or "DWCRA" in legal:
                    txt = rng.choice([f"SHG LOAN REPAY {legal[:14]}", nar.neft(d, legal, False, "SHG RECOVERY")])
                self.add(d, MAND, emi, "emi_loan", txt, "l:" + brand.lower(), {"mandate": legal, "brand": brand})
        # insurance & savings
        if rng.random() < 0.25 + 0.45 * D:
            legal, brand = rng.choice(INSURERS)
            prem = round(inc * rng.uniform(0.02, 0.06), -1) if "PM" not in legal else (20 if "SBY" in legal else 436)
            freq = 12 if "PM" in legal else rng.choice([1, 3, 12])
            for i, ms in enumerate(months):
                if freq == 1 or (freq == 3 and i % 3 == 0) or (freq == 12 and ms.month == 6):
                    d = self.day(ms, rng.randint(5, 25))
                    amount = prem if "PM" in legal else prem * freq
                    self.add(d, MAND, amount, "insurance", nar.ach(d, legal) if rng.random() < 0.7 else nar.upi(d, Party(legal, "lic@sbi", "SBIN", "m:" + brand.lower()), False, "premium"), "m:" + brand.lower())
        sip = None
        if rng.random() < D ** 1.5 * (0.9 if p.persona in ("salaried", "shopkeeper") else 0.5):
            legal, brand = rng.choice(INVESTMENTS)
            sip = (legal, brand, round(inc * rng.uniform(0.03, 0.15) * D, -2) or 500, rng.choice([5, 7, 10, 15]))
        rd = rng.random() < D * 0.35
        for ms in months:
            if sip:
                d = self.day(ms, sip[3])
                self.add(d, MAND, sip[2], "investment_savings", nar.ach(d, sip[0]), "m:" + sip[1].lower())
            if rd:
                d = self.day(ms, rng.randint(1, 10))
                self.add(d, BILL, round(inc * 0.05 * D, -2) or 500, "investment_savings",
                         rng.choice(["TO RD A/C " + str(rng.randint(10**10, 10**11)), "RD INSTALLMENT", "TRF TO RD ACCOUNT", "TO SB-RD TRANSFER"]), "x:rd")
            if D > 0.6 and rng.random() < 0.15:
                d = self.day(ms, rng.randint(1, 28))
                self.add(d, DISC, round(inc * 0.04, -2), "investment_savings", nar.upi(d, Party("JAR APP GOLD", "jar.gold@icici", "ICIC", "m:jar"), False, "daily savings"), "m:jar")
        # variable spending
        cash_share = {"salaried": 0.06, "gig_worker": 0.12, "shopkeeper": 0.12, "farmer": 0.3, "student": 0.05, "homemaker": 0.25}[p.persona]
        disc_mult = 1.5 - D
        kiranas = [_shop(rng) for _ in range(rng.randint(2, 5))]
        friends = [_person(rng) for _ in range(rng.randint(3, 10))]
        family_out = _person(rng) if rng.random() < 0.4 else None
        fav = {c: rng.sample(MERCHANTS[c], min(len(MERCHANTS[c]), rng.randint(2, 5))) for c in MERCHANTS}
        food_rate = {"salaried": 6, "gig_worker": 3, "shopkeeper": 2, "farmer": 0.2, "student": 7, "homemaker": 1}[p.persona]
        for ms in months:
            dim = self.dim(ms)
            shock = shocks.get(ms)
            tight = 0.6 if shock else 1.0

            def disc_buy(cat, rate, mean, sd=0.5, remarks=("", "")):
                for _ in range(self.np.poisson(max(0.0, rate))):
                    d = self.day(ms, rng.randint(1, dim))
                    m = rng.choice(fav[cat])
                    self.add(d, DISC, round(self.amt(mean, sd), 0), cat, nar.upi(d, m, False, rng.choice(remarks)), m.group)

            disc_buy("groceries", (2 if urban else 0.6) * tight, inc * 0.06, 0.4, ("", "groceries", "order"))
            for _ in range(self.np.poisson(9 * tight)):
                k = rng.choice(kiranas)
                d = self.day(ms, rng.randint(1, dim))
                self.add(d, DISC, round(self.amt(inc * 0.012, 0.6), 0), "groceries", nar.upi(d, k, False, rng.choice(["", "", "milk", "veg", "kirana", "rice"])), k.group)
            disc_buy("food_delivery", food_rate * disc_mult * tight * min(2.0, inc / 25000), 280, 0.45, ("", "Food order", "order"))
            disc_buy("shopping", 1.4 * disc_mult * tight * min(2.0, inc / 25000), inc * 0.05, 0.7, ("", "order", "Payment"))
            disc_buy("fuel_transport", {"gig_worker": 9, "salaried": 3, "shopkeeper": 3, "farmer": 2, "student": 3, "homemaker": 1}[p.persona], 260 if p.persona == "gig_worker" else 350, 0.5, ("", "petrol", "fuel", "ride"))
            disc_buy("healthcare", 0.5, 400, 0.8, ("", "medicines", "consultation"))
            if p.persona == "student" or (p.persona in ("salaried", "homemaker") and rng.random() < 0.35):
                disc_buy("education", 0.5, inc * 0.1, 0.6, ("", "fees", "course", "exam fee"))
            if p.bettor:
                disc_buy("betting_gaming", 3 + 25 * p.bettor, inc * p.bettor / 2.5, 0.6, ("", "add cash", "deposit", "wallet"))
            # medical shock
            if shock and rng.random() < 0.5:
                h = rng.choice(MERCHANTS["healthcare"][5:9])
                d = self.day(ms, rng.randint(1, dim))
                self.add(d, BILL, round(self.amt(inc * 0.6, 0.4), 0), "healthcare", nar.upi(d, h, False, rng.choice(["hospital", "bill", "IP bill", ""])), h.group)
            # ATM cash
            for _ in range(self.np.poisson(1 + 6 * cash_share)):
                d = self.day(ms, rng.randint(1, dim))
                a = round(self.amt(inc * cash_share / (1 + 6 * cash_share), 0.5), -2)
                self.add(d, DISC, max(100, min(a, 20000)), "cash_withdrawal", nar.atm(d, aeps=p.persona in ("farmer", "homemaker") and rng.random() < 0.4), "x:atm")
            # P2P transfers out / in
            for _ in range(self.np.poisson(3 * disc_mult)):
                f = rng.choice(friends)
                d = self.day(ms, rng.randint(1, dim))
                self.add(d, DISC, round(self.amt(400, 0.9), 0), "transfer_out", nar.upi(d, f, False, rng.choice(P2P_REMARKS)), f.group)
            for _ in range(self.np.poisson(1.2)):
                f = rng.choice(friends)
                d = self.day(ms, rng.randint(1, dim))
                self.add(d, CREDIT, round(self.amt(350, 0.9), 0), "transfer_in_other", nar.upi(d, f, True, rng.choice(P2P_REMARKS)), f.group)
            if family_out:
                d = self.day(ms, rng.randint(1, 10))
                self.add(d, BILL, round(inc * 0.1, -2), "transfer_out", nar.imps(d, family_out.name, False, rng.choice(["home", "amma", "parents", "family", ""])) if rng.random() < 0.5 else nar.upi(d, family_out, False, rng.choice(["home", "for amma", ""])), family_out.group)
            if rng.random() < 0.2:
                d = self.day(ms, rng.randint(1, dim))
                m = rng.choice(fav["shopping"] + fav["food_delivery"])
                self.add(d, CREDIT, round(self.amt(150, 1.0), 0), "refund_cashback", rng.choice([f"REV-{nar.upi(d, m, True, 'refund')}", nar.upi(d, m, True, rng.choice(["REFUND", "Refund", "cashback", "CASHBACK"])), f"UPI REVERSAL {_rrn(rng, d)}"]), m.group)
            if rng.random() < 0.06:
                d = self.day(ms, rng.randint(1, dim))
                self.add(d, DISC, round(self.amt(300, 1.0), 0), "other", rng.choice(["TEMPLE DONATION", f"DD ISSUE {rng.randint(10**5, 10**6)}", "MISC DEBIT", f"POS {nar.card[-4:]} SALON", "CHQ PAID " + str(rng.randint(10**5, 10**6)), "STAMP DUTY", "GOVT FEE CHALLAN"]), "x:other")
            # bank housekeeping
            if ms.month in (3, 6, 9, 12):
                d = self.day(ms, self.dim(ms))
                self.add(d, MAND, rng.choice([11.8, 15, 17.7, 23.6]), "bank_charges", nar.charge("sms"), "x:sms")
            if rng.random() < 1 / 12:
                d = self.day(ms, rng.randint(1, 28))
                self.add(d, MAND, rng.choice([147.5, 177, 236, 295, 354]), "bank_charges", nar.charge("card"), "x:card")

    def fit_budget(self):
        """Scale discretionary spend so total outflow tracks inflow × a
        discipline-driven spend ratio (savers under-spend, stressed over-spend)."""
        p = self.p
        credits = sum(e[4] for e in self.events if e[1] == CREDIT)
        fixed = sum(e[4] for e in self.events if e[1] in (MAND, BILL))
        disc = sum(e[4] for e in self.events if e[1] == DISC)
        ratio = float(np.clip(1.0 - 0.2 * p.discipline + 0.14 * p.stress + self.np.normal(0, 0.04), 0.72, 1.12))
        f = float(np.clip((credits * ratio - fixed) / max(disc, 1.0), 0.2, 2.5))
        out = []
        for e in self.events:
            if e[1] == DISC:
                amt = e[4] * f
                amt = max(100.0, round(amt, -2)) if e[5] == "cash_withdrawal" else max(10.0, round(amt, 0))
                e = e[:4] + (amt,) + e[5:]
            out.append(e)
        self.events = out

    # -- run
    def run(self) -> list[dict]:
        p, rng = self.p, self.rng
        shocks = {}
        for ms in self.month_starts():
            if self.np.random() < p.shock_p * 1.2:
                kind = rng.choice(["loss", "cut", "cut"] + (["job"] if p.persona == "salaried" else []))
                shocks[ms] = kind
                if kind == "job":  # unemployment lasts 1-2 months
                    nxt = date(ms.year + (ms.month == 12), ms.month % 12 + 1, 1)
                    if rng.random() < 0.4:
                        shocks[nxt] = "job"
        self.income_events(shocks)
        self.spending_events(shocks)
        self.fit_budget()
        # opening balance: buffer driven by stress & discipline
        seasonal = 3.0 if p.persona == "farmer" else 1.0  # farmers carry harvest money across the season
        bal = round(max(200.0, seasonal * p.income * self.np.lognormal(0, 0.5) * (1.6 * (1 - p.stress) * (0.4 + p.discipline))), 2)
        mab = {"SBI": 0, "HDFC": 5000, "ICICI": 5000, "AXIS": 5000, "KOTAK": 5000, "CANARA": 1000, "BOB": 1000, "PNB": 1000}[p.bank]
        if p.persona in ("salaried",) or rng.random() < 0.35:
            mab = 0  # salary / basic savings (BSBDA) accounts
        out: list[dict] = []
        pending_charges: list[tuple[float, str, str]] = []
        loan_out = None
        retries: list = []
        heap = sorted(self.events, key=lambda e: (e[0], e[1], e[2]))
        import heapq
        heapq.heapify(heap)
        daily_bal: dict[date, float] = {}
        last_month = None
        month_bal_sum = 0.0
        month_days = 0
        prev_day = self.start
        nar = self.nar

        def post(d, amount, category, narration, group, credit):
            nonlocal bal
            bal = round(bal + (amount if credit else -amount), 2)
            out.append({"date": d, "narration": narration, "debit": 0.0 if credit else amount,
                        "credit": amount if credit else 0.0, "balance": bal, "category": category, "group": group})

        def month_end(ms: date):
            nonlocal month_bal_sum, month_days
            if mab and month_days and month_bal_sum / month_days < mab:
                fee = rng.choice([59, 118, 177, 236, 354, 472, 590])
                pending_charges.append((fee, "bank_charges", nar.charge("minbal")))
            month_bal_sum, month_days = 0.0, 0

        while heap:
            ev = heapq.heappop(heap)
            d, prio, _, _, amount, category, narration, group, meta = ev
            # balance accrual for day gaps
            while prev_day < d:
                month_bal_sum += bal
                month_days += 1
                nxt = prev_day + timedelta(days=1)
                if nxt.month != prev_day.month:
                    month_end(prev_day.replace(day=1))
                    if prev_day.month in (3, 6, 9, 12) and bal > 0:
                        interest = round(bal * 0.027 / 4 * self.np.uniform(0.6, 1.0), 0)
                        if interest >= 1:
                            post(prev_day, interest, "interest_in", nar.interest(prev_day), "x:interest", True)
                prev_day = nxt
            if prio == CREDIT:
                post(d, amount, category, narration, group, True)
                while pending_charges and bal >= pending_charges[0][0]:
                    fee, cat, txt = pending_charges.pop(0)
                    post(d, fee, cat, txt, "x:charge", False)
                    if rng.random() < 0.5:
                        post(d, round(fee * 0.18, 2), cat, nar.charge("gst"), "x:gst", False)
                continue
            floor = 0 if prio == MAND else (200 + 1500 * p.discipline if prio == DISC else 0)
            short = bal - amount < floor
            # mandate not funded on presentation day (money moved out / spent first): bounces even
            # though the account could have covered it — a repayment-priority signal, not a liquidity one
            unfunded = (prio == MAND and category == "emi_loan" and not short and (
                (bal - amount < 3000 and rng.random() < (1 - p.wtp) * 0.8) or rng.random() < (1 - p.wtp) * 0.3))
            if not short and not unfunded:
                post(d, amount, category, narration, group, False)
            elif prio == MAND and unfunded:
                fee = rng.choice([500, 590, 250, 295, 350, 413])
                pending_charges.append((fee, "bounce_charge", nar.charge("bounce")))
                if meta.get("retry", 0) < 1 and rng.random() < 0.8:
                    meta = dict(meta, retry=meta.get("retry", 0) + 1)
                    self.seq += 1
                    heapq.heappush(heap, (d + timedelta(days=rng.randint(5, 12)), prio, rng.random(), self.seq,
                                          amount, category, narration, group, meta))
            elif prio == MAND:
                # NACH/ECS bounce: return charge, lender re-presents later
                fee = rng.choice([500, 590, 250, 295, 350, 413])
                pending_charges.append((fee, "bounce_charge", nar.charge("bounce")))
                if meta.get("retry", 0) < 1 and rng.random() < 0.7:
                    meta = dict(meta, retry=meta.get("retry", 0) + 1)
                    nd = d + timedelta(days=rng.randint(5, 12))
                    self.seq += 1
                    heapq.heappush(heap, (nd, prio, rng.random(), self.seq, amount, category, narration, group, meta))
            elif prio == BILL:
                if meta.get("retry", 0) < 3:
                    meta = dict(meta, retry=meta.get("retry", 0) + 1)
                    nd = d + timedelta(days=rng.randint(3, 9))
                    self.seq += 1
                    heapq.heappush(heap, (nd, prio, rng.random(), self.seq, amount, category, narration, group, meta))
            elif bal > 300 and amount > 300 and rng.random() < 0.5:
                part = round(min(amount, bal - 200) * 0.6, 0)
                if part > 0:
                    post(d, part, category, narration, group, False)
            # liquidity crunch → loan app borrowing
            crunch = ((short and prio != DISC and meta.get("bill") != "supplier")
                      or (bal < 1000 and prio == MAND))
            if crunch and loan_out is None and rng.random() < p.loanapp:
                legal, brand, vpa = rng.choice(LOAN_APPS)
                principal = round(self.amt(max(2000, p.income * 0.35), 0.4), -2)
                fee = round(principal * rng.uniform(0.04, 0.12), 0)
                party = Party(legal, vpa, "ICIC", "la:" + brand.lower(), brand)
                txt = nar.neft(d, legal, True, rng.choice(["LOAN DISB", "DISBURSAL", "LOAN", "CREDIT LINE"])) if rng.random() < 0.6 else nar.imps(d, legal, True, "loan disbursal")
                post(d, principal - fee, "loan_app", txt, party.group, True)
                due = d + timedelta(days=rng.choice([15, 21, 30, 30, 61]))
                rep = round(principal * rng.uniform(1.06, 1.3), 0)
                self.seq += 1
                rep_txt = nar.ach(due, legal) if rng.random() < 0.5 else nar.upi(due, party, False, rng.choice(["repayment", "EMI", "loan repay", ""]))
                heapq.heappush(heap, (due, MAND, rng.random(), self.seq, rep, "loan_app", rep_txt, party.group, {"loanapp": True}))
                loan_out = due
            if loan_out and d >= loan_out:
                loan_out = None
        # assign ids & noise
        out.sort(key=lambda t: t["date"])
        prefix = {"SBI": "S", "HDFC": "H", "ICICI": "I", "AXIS": "A", "KOTAK": "K", "CANARA": "C", "BOB": "B", "PNB": "P"}[p.bank]
        for i, t in enumerate(out):
            t["txn_id"] = f"{prefix}{p.seed % 100000:05d}{i:05d}"
            t["date"] = t["date"].isoformat()
        return out


def simulate(p: Profile) -> list[dict]:
    """Full statement for a profile; rows carry ground-truth category + group."""
    return Statement(p).run()


def applicant(seed: int, persona: str | None = None, **overrides) -> tuple[Profile, list[dict], int]:
    p = draw_profile(seed, persona, **overrides)
    txns = simulate(p)
    return p, txns, simulate_label(p)

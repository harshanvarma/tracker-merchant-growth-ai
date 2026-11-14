"""
Saarthi — synthetic but behaviourally realistic merchant datasets.

Produces two merchants:
  1. BILLING      — "Sharma Kirana Store", Hyderabad. Item-level bills with cost prices.
  2. NON-BILLING  — "Anna Tea & Snacks", Hyderabad. Payment events only, no item data.

Realism baked in: weekday rhythm, salary-cycle bumps, festival spikes, monsoon and
summer effects, per-SKU trends, genuine dead stock, intermittent slow movers,
Pareto customer behaviour with lapsed regulars, hour-of-day peaks.
"""
import numpy as np, pandas as pd, hashlib, json, os
from datetime import date, timedelta

RNG = np.random.default_rng(20261114)
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
os.makedirs(OUT, exist_ok=True)

START = date(2025, 11, 15)
END   = date(2026, 11, 13)
DAYS  = (END - START).days + 1
DATES = [START + timedelta(days=i) for i in range(DAYS)]

# ----------------------------------------------------------------------------
# 1. PRODUCT CATALOGUE
# margin_lo/hi are realistic Indian kirana retail margins by category.
# base = expected units sold per day at baseline.
# ----------------------------------------------------------------------------
CATALOGUE = [
    # (name, category, mrp, margin, base_daily_units, behaviour)
    ("Aashirvaad Atta 5kg",            "Staples",       285, 0.065, 11.0, "steady"),
    ("Aashirvaad Atta 10kg",           "Staples",       555, 0.060,  4.2, "steady"),
    ("Fortune Chakki Atta 5kg",        "Staples",       265, 0.070,  6.0, "declining"),
    ("India Gate Basmati 1kg",         "Staples",       165, 0.080,  5.5, "growing"),
    ("Sona Masoori Rice 25kg",         "Staples",      1350, 0.055,  1.6, "steady"),
    ("Tata Salt 1kg",                  "Staples",        28, 0.075, 23.0, "steady"),
    ("Fortune Sunflower Oil 1L",       "Staples",       145, 0.060, 14.0, "steady"),
    ("Saffola Gold Oil 1L",            "Staples",       185, 0.070,  5.0, "growing"),
    ("Dhara Mustard Oil 1L",           "Staples",       155, 0.065,  3.4, "steady"),
    ("Toor Dal 1kg (loose)",           "Staples",       160, 0.090, 12.5, "steady"),
    ("Moong Dal 1kg (loose)",          "Staples",       140, 0.090,  7.0, "steady"),
    ("Chana Dal 1kg (loose)",          "Staples",       110, 0.090,  6.2, "steady"),
    ("Rajma 500g",                     "Staples",        95, 0.100,  2.6, "steady"),
    ("Madhur Sugar 1kg",               "Staples",        48, 0.060, 17.0, "steady"),
    ("Jaggery Block 500g",             "Staples",        65, 0.110,  3.0, "festival"),
    ("Besan 500g",                     "Staples",        62, 0.095,  5.4, "festival"),
    ("Sooji / Rava 500g",              "Staples",        38, 0.090,  4.2, "steady"),
    ("Maida 500g",                     "Staples",        34, 0.090,  3.6, "steady"),
    ("Poha 500g",                      "Staples",        42, 0.095,  4.8, "steady"),
    ("Vermicelli 400g",                "Staples",        45, 0.100,  2.4, "steady"),

    ("Amul Taaza Milk 500ml",          "Dairy",          27, 0.055, 95.0, "steady"),
    ("Amul Gold Milk 500ml",           "Dairy",          33, 0.055, 42.0, "growing"),
    ("Heritage Curd 400g",             "Dairy",          45, 0.070, 26.0, "steady"),
    ("Amul Butter 100g",               "Dairy",          62, 0.060, 14.0, "steady"),
    ("Amul Cheese Slices 200g",        "Dairy",         145, 0.080,  3.2, "growing"),
    ("Paneer 200g",                    "Dairy",          95, 0.085,  6.4, "steady"),
    ("Amul Masti Buttermilk 200ml",    "Dairy",          15, 0.090, 22.0, "summer"),
    ("Nestle Milkmaid 400g",           "Dairy",         165, 0.085,  1.4, "festival"),
    ("Amul Fresh Cream 250ml",         "Dairy",          85, 0.080,  1.8, "festival"),
    ("Dairy Whitener 400g",            "Dairy",         245, 0.075,  1.1, "slow"),

    ("Parle-G Biscuit 250g",           "Snacks",         30, 0.140, 28.0, "steady"),
    ("Britannia Good Day 200g",        "Snacks",         45, 0.150, 16.0, "steady"),
    ("Britannia Marie Gold 250g",      "Snacks",         40, 0.140, 12.0, "steady"),
    ("Oreo Biscuit 120g",              "Snacks",         35, 0.160,  9.5, "growing"),
    ("Hide & Seek 200g",               "Snacks",         60, 0.155,  7.0, "steady"),
    ("Bourbon Biscuit 150g",           "Snacks",         35, 0.150,  8.2, "steady"),
    ("Lays Classic 52g",               "Snacks",         20, 0.180, 34.0, "steady"),
    ("Kurkure Masala Munch 90g",       "Snacks",         20, 0.180, 29.0, "steady"),
    ("Bingo Mad Angles 66g",           "Snacks",         20, 0.180, 14.0, "steady"),
    ("Haldiram Aloo Bhujia 200g",      "Snacks",         55, 0.170, 11.0, "steady"),
    ("Haldiram Soan Papdi 250g",       "Snacks",         95, 0.165,  2.0, "festival"),
    ("Mixture Namkeen 400g",           "Snacks",         85, 0.175,  5.5, "steady"),
    ("Peanuts Masala 150g",            "Snacks",         40, 0.190,  6.0, "monsoon"),
    ("Popcorn Ready 100g",             "Snacks",         45, 0.200,  3.0, "steady"),

    ("Maggi Noodles 70g",              "Instant",        14, 0.130, 52.0, "steady"),
    ("Maggi Noodles 12-pack",          "Instant",       168, 0.110,  5.0, "steady"),
    ("Yippee Noodles 70g",             "Instant",        14, 0.140, 13.0, "declining"),
    ("Top Ramen 70g",                  "Instant",        15, 0.140,  4.0, "slow"),
    ("MTR Upma Mix 200g",              "Instant",        65, 0.150,  3.2, "steady"),
    ("MTR Gulab Jamun Mix 200g",       "Instant",        85, 0.160,  1.6, "festival"),
    ("Knorr Soup Sachet",              "Instant",        55, 0.170,  2.2, "monsoon"),

    ("Tata Tea Gold 250g",             "Beverages",     160, 0.090, 15.0, "steady"),
    ("Red Label Tea 500g",             "Beverages",     265, 0.085,  8.0, "steady"),
    ("Taj Mahal Tea 250g",             "Beverages",     175, 0.090,  5.0, "growing"),
    ("Bru Instant Coffee 50g",         "Beverages",     165, 0.100,  4.4, "steady"),
    ("Nescafe Classic 50g",            "Beverages",     195, 0.100,  3.6, "steady"),
    ("Bournvita 500g",                 "Beverages",     245, 0.095,  3.0, "steady"),
    ("Horlicks 500g",                  "Beverages",     265, 0.095,  2.6, "steady"),
    ("Coca-Cola 750ml",                "Beverages",       40, 0.120, 19.0, "summer"),
    ("Thums Up 750ml",                 "Beverages",       40, 0.120, 21.0, "summer"),
    ("Sprite 750ml",                   "Beverages",       40, 0.120, 13.0, "summer"),
    ("Frooti 160ml",                   "Beverages",       10, 0.150, 26.0, "summer"),
    ("Maaza 600ml",                    "Beverages",       40, 0.125, 11.0, "summer"),
    ("Bisleri Water 1L",               "Beverages",       20, 0.130, 31.0, "summer"),
    ("Real Juice Mixed Fruit 1L",      "Beverages",      120, 0.130,  3.4, "steady"),
    ("Red Bull 250ml",                 "Beverages",      125, 0.140,  1.8, "growing"),

    ("Lifebuoy Soap 125g",             "PersonalCare",   38, 0.170, 17.0, "steady"),
    ("Lux Soap 100g",                  "PersonalCare",   42, 0.175, 14.0, "steady"),
    ("Dove Soap 100g",                 "PersonalCare",   75, 0.185,  6.0, "growing"),
    ("Santoor Soap 100g",              "PersonalCare",   38, 0.175, 11.0, "steady"),
    ("Clinic Plus Shampoo 175ml",      "PersonalCare",  135, 0.190,  6.4, "steady"),
    ("Head & Shoulders 180ml",         "PersonalCare",  210, 0.200,  3.4, "steady"),
    ("Shampoo Sachet 6ml",             "PersonalCare",    3, 0.220, 48.0, "steady"),
    ("Colgate Strong Teeth 100g",      "PersonalCare",   95, 0.180, 12.0, "steady"),
    ("Close-Up 150g",                  "PersonalCare",  115, 0.185,  5.6, "steady"),
    ("Dabur Red Toothpaste 100g",      "PersonalCare",   92, 0.180,  5.0, "steady"),
    ("Parachute Coconut Oil 200ml",    "PersonalCare",  115, 0.165,  7.4, "steady"),
    ("Navratna Cool Oil 100ml",        "PersonalCare",   75, 0.180,  3.4, "summer"),
    ("Nivea Cream 60ml",              "PersonalCare",   95, 0.200,  2.4, "winter"),
    ("Vaseline Lotion 200ml",          "PersonalCare",  185, 0.195,  2.2, "winter"),
    ("Gillette Razor Pack",            "PersonalCare",   65, 0.210,  3.6, "steady"),
    ("Whisper Ultra 15s",              "PersonalCare",  175, 0.190,  5.4, "steady"),
    ("Pampers Pants M 9s",             "PersonalCare",  299, 0.150,  2.0, "growing"),
    ("Dettol Handwash 200ml",          "PersonalCare",   99, 0.195,  4.2, "steady"),
    ("Talcum Powder 100g",             "PersonalCare",   85, 0.200,  2.6, "summer"),
    ("Fair & Lovely 50g",              "PersonalCare",  120, 0.210,  1.4, "declining"),

    ("Surf Excel Easy Wash 1kg",       "HomeCare",      140, 0.150, 12.0, "steady"),
    ("Ariel Matic 1kg",                "HomeCare",      235, 0.155,  4.6, "growing"),
    ("Rin Bar 250g",                   "HomeCare",       22, 0.165, 18.0, "steady"),
    ("Vim Dishwash Bar 200g",          "HomeCare",       20, 0.170, 24.0, "steady"),
    ("Vim Liquid Gel 500ml",           "HomeCare",      125, 0.180,  6.0, "growing"),
    ("Harpic Toilet Cleaner 500ml",    "HomeCare",      110, 0.180,  5.2, "steady"),
    ("Lizol Floor Cleaner 975ml",      "HomeCare",      215, 0.175,  3.4, "steady"),
    ("Colin Glass Cleaner 500ml",      "HomeCare",      110, 0.185,  2.0, "steady"),
    ("Good Knight Refill",             "HomeCare",       85, 0.170,  6.4, "monsoon"),
    ("All Out Refill",                 "HomeCare",       80, 0.170,  4.0, "monsoon"),
    ("Agarbatti Pack",                 "HomeCare",       35, 0.220,  9.0, "festival"),
    ("Candles Pack 6s",                "HomeCare",       45, 0.230,  2.2, "festival"),
    ("Scotch-Brite Scrub Pad",         "HomeCare",       25, 0.200,  7.6, "steady"),
    ("Garbage Bags 30s",               "HomeCare",       99, 0.195,  3.0, "steady"),

    ("Everest Turmeric 200g",          "Spices",         72, 0.120,  6.4, "steady"),
    ("Everest Chilli Powder 200g",     "Spices",         98, 0.120,  6.0, "steady"),
    ("MDH Garam Masala 100g",          "Spices",         85, 0.125,  4.4, "steady"),
    ("Everest Coriander 200g",         "Spices",         68, 0.120,  4.6, "steady"),
    ("Cumin Seeds 100g",               "Spices",         65, 0.130,  5.0, "steady"),
    ("Mustard Seeds 100g",             "Spices",         28, 0.130,  4.0, "steady"),
    ("Sambar Powder 200g",             "Spices",         88, 0.130,  5.6, "steady"),
    ("Rasam Powder 100g",              "Spices",         55, 0.130,  3.4, "steady"),
    ("Tamarind 200g",                  "Spices",         48, 0.140,  4.4, "steady"),
    ("Ginger Garlic Paste 200g",       "Spices",         55, 0.145,  5.2, "steady"),

    ("Cadbury Dairy Milk 50g",         "Confection",     45, 0.165, 18.0, "steady"),
    ("5 Star 3-pack",                  "Confection",     50, 0.170,  9.0, "steady"),
    ("Perk 25g",                       "Confection",     20, 0.175,  8.4, "steady"),
    ("Eclairs Jar",                    "Confection",     95, 0.200,  2.4, "steady"),
    ("Center Fresh Jar",               "Confection",     90, 0.195,  2.6, "steady"),
    ("Cadbury Celebrations 141g",       "Confection",    220, 0.150,  1.2, "festival"),
    ("Dry Fruits Mix 250g",            "Confection",    320, 0.140,  1.5, "festival"),
    ("Kaju 250g",                      "Confection",    280, 0.130,  1.2, "festival"),

    ("Matchbox 10s",                   "Misc",           10, 0.250,  8.0, "steady"),
    ("Battery AA 2s",                  "Misc",           35, 0.230,  2.4, "steady"),
    ("Notebook 200pg",                 "Misc",           55, 0.240,  3.4, "school"),
    ("Pen Blue 5s",                    "Misc",           50, 0.250,  3.0, "school"),
    ("Phone Charging Cable",           "Misc",          149, 0.280,  0.8, "slow"),
    ("Umbrella Folding",               "Misc",          349, 0.260,  0.5, "monsoon"),
    ("Thermos Flask 500ml",            "Misc",          449, 0.270,  0.08, "dead"),
    ("Steel Lunch Box 3-tier",         "Misc",          599, 0.250,  0.06, "dead"),
    ("Wall Clock Plastic",             "Misc",          399, 0.300,  0.05, "dead"),
    ("Hair Dryer Basic",               "Misc",          899, 0.260,  0.03, "dead"),
    ("Gift Wrap Sheet 5s",             "Misc",           60, 0.280,  0.30, "dead"),
]

# Calibrates the catalogue to a realistic mid-size neighbourhood kirana:
# roughly 180 bills and Rs 36k revenue on an average day.
SCALE = 0.42

products = []
for i, (name, cat, mrp, margin, base, beh) in enumerate(CATALOGUE):
    base = base * SCALE
    cost = round(mrp * (1 - margin), 2)
    products.append(dict(sku=f"SKU{i+1:04d}", item_name=name, category=cat,
                         mrp=float(mrp), cost_price=cost,
                         margin_pct=round(margin * 100, 2),
                         base_rate=base, behaviour=beh))
prod_df = pd.DataFrame(products)
NP = len(prod_df)

# ----------------------------------------------------------------------------
# 2. TIME-VARYING DEMAND MULTIPLIERS
# ----------------------------------------------------------------------------
# Kirana weekday rhythm: Sunday heaviest, Tuesday lightest.
WEEKDAY_MULT = {0: 0.94, 1: 0.82, 2: 0.92, 3: 0.98, 4: 1.06, 5: 1.21, 6: 1.30}

FESTIVALS = {  # date -> (lead-in days, peak multiplier for festival-sensitive SKUs)
    date(2026, 1, 14): (3, 1.9),   # Makar Sankranti / Pongal
    date(2026, 3, 4):  (4, 2.3),   # Holi
    date(2026, 3, 20): (5, 2.0),   # Eid al-Fitr
    date(2026, 4, 14): (2, 1.6),   # Ugadi / Tamil New Year
    date(2026, 8, 15): (1, 1.3),   # Independence Day
    date(2026, 8, 28): (3, 1.8),   # Raksha Bandhan
    date(2026, 9, 14): (4, 2.1),   # Ganesh Chaturthi
    date(2026, 10, 19): (8, 2.4),  # Navratri -> Dussehra
    date(2026, 11, 8): (10, 3.1),  # Diwali
    date(2025, 12, 25): (4, 1.5),  # Christmas / New Year
}

def festival_boost(d):
    """Max boost across festivals, ramping up to the day then falling off."""
    best = 1.0
    for fd, (lead, peak) in FESTIVALS.items():
        delta = (fd - d).days
        if 0 <= delta <= lead:
            ramp = 1.0 + (peak - 1.0) * (1.0 - delta / (lead + 1)) ** 1.5
            best = max(best, ramp)
        elif -2 <= delta < 0:
            best = max(best, 1.0 + (peak - 1.0) * 0.25)
    return best

def general_festival_lift(d):
    """Everything sells a bit more around a festival, not just festival SKUs."""
    return 1.0 + (festival_boost(d) - 1.0) * 0.22

def salary_cycle(d):
    """Indian salary credit: spike 1st-5th, secondary bump 25th-31st."""
    dom = d.day
    if dom <= 5:   return 1.22 - 0.03 * dom
    if dom >= 26:  return 1.00 + 0.022 * (dom - 25)
    if 12 <= dom <= 20: return 0.93
    return 1.0

def season_mult(d, beh):
    m = d.month
    summer  = m in (3, 4, 5, 6)
    monsoon = m in (6, 7, 8, 9)
    winter  = m in (11, 12, 1)
    if beh == "summer":  return 1.55 if summer else (0.62 if winter else 0.95)
    if beh == "monsoon": return 1.45 if monsoon else 0.80
    if beh == "winter":  return 1.50 if winter else 0.72
    if beh == "school":  return 2.1 if m in (5, 6) else (0.75 if m in (3, 4) else 1.0)
    return 1.0

def trend_mult(beh, t):
    """t in [0,1] across the window."""
    if beh == "growing":   return 1.0 + 0.55 * t
    if beh == "declining": return 1.0 - 0.42 * t
    return 1.0

# Store-level growth + a soft dip in Jun-Jul (quick-commerce pressure story)
def store_mult(d, t):
    g = 1.0 + 0.17 * t
    if d.month in (6, 7):
        g *= 0.92
    return g

# ----------------------------------------------------------------------------
# 2b. SHOPPING MISSIONS — this is what creates genuine basket affinity.
# A real bill is not a random draw across the catalogue; it is a trip with a
# purpose. Missions overlap, so items co-occur at rates FP-Growth can detect.
# ----------------------------------------------------------------------------
def pool(*, cats=(), names=(), exclude=()):
    idx = []
    for i, p in enumerate(products):
        hit = p["category"] in cats or any(k.lower() in p["item_name"].lower() for k in names)
        if hit and not any(k.lower() in p["item_name"].lower() for k in exclude):
            idx.append(i)
    return np.array(sorted(set(idx)))

MISSIONS = [
    # (label, probability, min items, max items, pool)
    ("daily_topup", 0.42, 1, 3, pool(
        cats=("Dairy",),
        names=("Maggi Noodles 70g", "Parle-G", "Marie Gold", "Matchbox", "Bisleri",
               "Frooti", "Lays Classic", "Agarbatti", "Tata Salt"))),
    ("weekly_grocery", 0.17, 4, 9, pool(
        cats=("Staples", "Spices"),
        names=("Surf Excel", "Vim Dishwash", "Rin Bar"))),
    ("snack_run", 0.17, 1, 4, pool(
        cats=("Confection",),
        names=("Lays", "Kurkure", "Bingo", "Bhujia", "Namkeen", "Peanuts", "Popcorn",
               "Good Day", "Oreo", "Hide & Seek", "Bourbon", "Coca-Cola", "Thums Up",
               "Sprite", "Maaza", "Frooti", "Red Bull"),
        exclude=("Celebrations", "Dry Fruits", "Kaju"))),
    ("chai_time", 0.09, 2, 4, pool(
        names=("Tata Tea", "Red Label", "Taj Mahal", "Bru", "Nescafe", "Madhur Sugar",
               "Amul Taaza", "Amul Gold", "Parle-G", "Good Day", "Marie Gold",
               "Bourbon", "Rusk", "Bhujia"))),
    ("personal_care", 0.08, 2, 5, pool(cats=("PersonalCare",))),
    ("home_care", 0.045, 2, 4, pool(cats=("HomeCare",), exclude=("Agarbatti", "Candles"))),
    ("festival_shop", 0.025, 5, 12, pool(
        names=("Besan", "Jaggery", "Milkmaid", "Fresh Cream", "Gulab Jamun", "Soan Papdi",
               "Celebrations", "Dry Fruits", "Kaju", "Agarbatti", "Candles", "Sooji",
               "Maida", "Ghee", "Sugar", "Basmati", "Dairy Whitener", "Gift Wrap"))),
    ("bulk_run", 0.015, 2, 5, pool(
        names=("10kg", "25kg", "12-pack", "500g", "1L", "Jar"))),
]
M_LABELS = [m[0] for m in MISSIONS]
M_PROB = np.array([m[1] for m in MISSIONS]); M_PROB /= M_PROB.sum()

# ----------------------------------------------------------------------------
# 2c. PROMOTIONS — real price movement with a real demand response, so that
# an elasticity regression has something honest to recover.
# ----------------------------------------------------------------------------
TRUE_ELASTICITY = np.zeros(NP)
PROMO = {}                       # sku index -> list of (start_day, end_day, cut_pct)
promo_candidates = [i for i, p in enumerate(products)
                    if p["behaviour"] not in ("dead",) and p["mrp"] >= 20]
for i in RNG.choice(promo_candidates, size=min(46, len(promo_candidates)), replace=False):
    cat = products[i]["category"]
    # staples and dairy are price-sensitive; personal care and confection less so
    e = {"Staples": -1.9, "Dairy": -1.5, "Snacks": -1.2, "Beverages": -1.3,
         "Instant": -1.1, "HomeCare": -0.9, "PersonalCare": -0.8,
         "Spices": -1.0, "Confection": -0.9, "Misc": -0.7}.get(cat, -1.0)
    TRUE_ELASTICITY[i] = e * RNG.uniform(0.75, 1.25)
    wins = []
    for _ in range(int(RNG.integers(5, 10))):
        st = int(RNG.integers(0, DAYS - 8))
        wins.append((st, st + int(RNG.integers(3, 8)), float(RNG.choice([0.06, 0.08, 0.10, 0.12, 0.15, 0.20]))))
    PROMO[int(i)] = wins

def promo_cut(j, di):
    for st, en, cut in PROMO.get(j, ()):
        if st <= di <= en:
            return cut
    return 0.0

# ----------------------------------------------------------------------------
# 3. CUSTOMERS — Pareto behaviour, some lapse partway through
# ----------------------------------------------------------------------------
N_CUST = 520
cust_ids = [f"C{i:05d}" for i in range(N_CUST)]
# weight: a few heavy regulars, long tail of occasional buyers
cust_weight = RNG.pareto(1.15, N_CUST) + 0.25
cust_weight /= cust_weight.sum()
# each customer is "active" over a window; ~14% churn out before the end
cust_start = np.zeros(N_CUST, dtype=int)
cust_end   = np.full(N_CUST, DAYS, dtype=int)
for i in range(N_CUST):
    r = RNG.random()
    if r < 0.17:                       # joined later (new customers)
        cust_start[i] = RNG.integers(40, DAYS - 30)
    if 0.17 <= r < 0.31:               # lapsed (stopped coming)
        cust_end[i] = RNG.integers(60, DAYS - 45)

def cust_hash(cid):
    return hashlib.sha256(("saarthi::" + cid).encode()).hexdigest()[:16]

HASH = {c: cust_hash(c) for c in cust_ids}

# ----------------------------------------------------------------------------
# 4. HOUR-OF-DAY PROFILE (kirana: morning + evening peaks)
# ----------------------------------------------------------------------------
HOURS = np.arange(7, 23)
HOUR_W = np.array([0.045,0.085,0.105,0.080,0.055,0.042,0.035,0.030,
                   0.035,0.050,0.080,0.112,0.118,0.095,0.060,0.028])
HOUR_W = HOUR_W / HOUR_W.sum()

PAY_MODES = ["Paytm UPI", "Cash", "Paytm Card/POS", "Udhaar"]
PAY_P     = [0.615, 0.265, 0.075, 0.045]

# ----------------------------------------------------------------------------
# 5. GENERATE ITEM-LEVEL BILLS
# ----------------------------------------------------------------------------
base   = prod_df.base_rate.to_numpy()
behav  = prod_df.behaviour.to_numpy()
mrp    = prod_df.mrp.to_numpy()
cost   = prod_df.cost_price.to_numpy()
sku    = prod_df.sku.to_numpy()
pname  = prod_df.item_name.to_numpy()
pcat   = prod_df.category.to_numpy()

rows = []
bill_counter = 0
daily_units = np.zeros((DAYS, NP))

for di, d in enumerate(DATES):
    t = di / (DAYS - 1)
    day_mult = WEEKDAY_MULT[d.weekday()] * salary_cycle(d) * store_mult(d, t) \
               * general_festival_lift(d)
    fest = festival_boost(d)

    lam = base.copy()
    for j in range(NP):
        b = behav[j]
        lam[j] *= season_mult(d, b) * trend_mult(b, t)
        if b == "festival":
            lam[j] *= fest
        if b == "dead":
            lam[j] *= 0.35          # genuinely barely moves
        if b == "slow":
            lam[j] *= 0.55
    lam *= day_mult
    lam *= RNG.normal(1.0, 0.13, NP).clip(0.55, 1.6)   # day noise

    # promotion: price falls, quantity responds along the true elasticity
    cuts = np.array([promo_cut(j, di) for j in range(NP)])
    live = cuts > 0
    if live.any():
        lam[live] *= (1.0 - cuts[live]) ** TRUE_ELASTICITY[live]

    units = RNG.poisson(lam.clip(0.0001, None))
    daily_units[di] = units

    total_units = int(units.sum())
    if total_units == 0:
        continue

    # customers active today
    active = np.where((cust_start <= di) & (cust_end > di))[0]
    if len(active) == 0:
        active = np.arange(N_CUST)
    cw = cust_weight[active]; cw = cw / cw.sum()

    # --- assemble baskets mission-first ---------------------------------
    remaining = units.astype(float).copy()
    fest_today = fest > 1.25
    mp = M_PROB.copy()
    if fest_today:                                  # festival trips get likelier
        mp[M_LABELS.index("festival_shop")] *= 7.0
        mp[M_LABELS.index("bulk_run")] *= 2.0
        mp = mp / mp.sum()

    guard = 0
    while remaining.sum() > 0 and guard < 4000:
        guard += 1
        mi = int(RNG.choice(len(MISSIONS), p=mp))
        _, _, lo_k, hi_k, mpool = MISSIONS[mi]
        avail = mpool[remaining[mpool] > 0] if len(mpool) else np.array([], dtype=int)
        if len(avail) == 0:
            avail = np.flatnonzero(remaining > 0)
            lo_k, hi_k = 1, 3
        if len(avail) == 0:
            break
        k = int(min(len(avail), RNG.integers(lo_k, hi_k + 1)))
        w = remaining[avail]; w = w / w.sum()
        picks = RNG.choice(avail, size=k, replace=False, p=w)

        bill_counter += 1
        bill_id = f"B{bill_counter:07d}"
        hr = int(RNG.choice(HOURS, p=HOUR_W)); mn = int(RNG.integers(0, 60))
        ts = f"{d.isoformat()} {hr:02d}:{mn:02d}:00"
        mode = PAY_MODES[int(RNG.choice(len(PAY_MODES), p=PAY_P))]
        chash = HASH[cust_ids[int(RNG.choice(active, p=cw))]] if RNG.random() > 0.38 else ""

        for j in picks:
            j = int(j)
            qmax = int(remaining[j])
            q = 1
            if qmax > 1 and pcat[j] in ("Staples", "Dairy", "Beverages", "Instant"):
                q = int(min(qmax, RNG.choice([1, 1, 1, 2, 2, 3])))
            elif qmax > 1 and RNG.random() < 0.18:
                q = int(min(qmax, 2))
            remaining[j] -= q

            cut = cuts[j]
            if cut == 0 and mrp[j] > 150 and RNG.random() < 0.06:
                cut = float(RNG.choice([0.02, 0.03]))
            unit_price = round(float(mrp[j]) * (1.0 - cut), 2)
            rows.append((bill_id, ts, d.isoformat(), hr,
                         sku[j], pname[j], pcat[j], q,
                         float(mrp[j]), unit_price, float(cost[j]),
                         round(unit_price * q, 2), round(cost[j] * q, 2),
                         mode, chash, M_LABELS[mi]))

bills = pd.DataFrame(rows, columns=[
    "bill_id","timestamp","bill_date","hour","sku","item_name","category",
    "qty","mrp","unit_price","cost_price","line_revenue","line_cost",
    "payment_mode","customer_id","mission"])

bills.to_csv(os.path.join(OUT, "kirana_bills.csv"), index=False)
prod_df.drop(columns=["base_rate","behaviour"]).to_csv(
    os.path.join(OUT, "kirana_products.csv"), index=False)

# ----------------------------------------------------------------------------
# 6. CURRENT STOCK ON HAND  (deliberately imperfect: some over, some out)
# ----------------------------------------------------------------------------
recent = bills[bills.bill_date >= (END - timedelta(days=28)).isoformat()]
rate28 = recent.groupby("sku")["qty"].sum() / 28.0
stock_rows = []
for j in range(NP):
    s = sku[j]
    r = float(rate28.get(s, 0.0))
    b = behav[j]
    if b == "dead":
        on_hand = int(RNG.integers(6, 22))                 # money stuck on shelf
    elif b == "slow":
        on_hand = int(max(2, RNG.normal(r * 30, 4)))
    elif RNG.random() < 0.12:
        on_hand = int(max(0, RNG.normal(r * 1.2, 1)))      # about to stock out
    else:
        on_hand = int(max(0, RNG.normal(r * RNG.uniform(6, 16), r * 2 + 2)))
    lead = int(RNG.choice([1, 2, 2, 3, 3, 4, 5, 7]))
    stock_rows.append(dict(sku=s, item_name=pname[j], category=pcat[j],
                           on_hand=on_hand, lead_time_days=lead,
                           cost_price=float(cost[j]), mrp=float(mrp[j])))
stock_df = pd.DataFrame(stock_rows)
stock_df.to_csv(os.path.join(OUT, "kirana_stock.csv"), index=False)

# ----------------------------------------------------------------------------
# 7. FIXED COSTS / EXPENSES  (what the merchant enters at setup)
# ----------------------------------------------------------------------------
pd.DataFrame(dict(sku=prod_df.sku, item_name=prod_df.item_name,
                  true_elasticity=TRUE_ELASTICITY.round(3),
                  promo_windows=[len(PROMO.get(i, ())) for i in range(NP)])
             ).to_csv(os.path.join(OUT, "_ground_truth_elasticity.csv"), index=False)

expenses = dict(rent=28000, electricity=6400, staff=42000,
                internet_phone=1200, transport=3500, other=2800)
with open(os.path.join(OUT, "kirana_expenses.json"), "w") as f:
    json.dump(expenses, f, indent=2)

# ----------------------------------------------------------------------------
# 8. NON-BILLING MERCHANT — payments only
# ----------------------------------------------------------------------------
TICKETS = np.array([10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 150, 200])
TICKET_P = np.array([.07,.09,.14,.12,.13,.10,.09,.07,.05,.04,.045,.025,.015,.005])
TICKET_P = TICKET_P / TICKET_P.sum()
TEA_HOURS = np.arange(6, 23)
TEA_W = np.array([.055,.095,.110,.075,.045,.035,.045,.055,.040,.035,
                  .045,.075,.105,.095,.055,.025,.010])
TEA_W = TEA_W / TEA_W.sum()

tea_rows = []
tc = 0
for di, d in enumerate(DATES):
    t = di / (DAYS - 1)
    n = 118 * WEEKDAY_MULT[d.weekday()] * salary_cycle(d) * (1 + 0.21 * t) \
        * general_festival_lift(d) * RNG.normal(1.0, 0.11)
    if d.month in (6, 7, 8, 9):
        n *= 1.12                      # monsoon tea demand
    if d.weekday() == 6:
        n *= 0.78                      # Sunday: office crowd absent
    n = int(max(30, n))
    hrs = RNG.choice(TEA_HOURS, size=n, p=TEA_W)
    mins = RNG.integers(0, 60, n)
    amts = RNG.choice(TICKETS, size=n, p=TICKET_P).astype(float)
    amts *= RNG.choice([1.0, 1.0, 1.0, 2.0], size=n, p=[.72,.12,.10,.06])
    modes = RNG.choice(["Paytm UPI", "Cash"], size=n, p=[0.74, 0.26])
    att = RNG.random(n) > 0.55
    act = np.where((cust_start <= di) & (cust_end > di))[0]
    w = cust_weight[act]; w = w / w.sum()
    ch = RNG.choice(act, size=n, p=w)
    for k in range(n):
        tc += 1
        tea_rows.append((f"T{tc:07d}", f"{d.isoformat()} {hrs[k]:02d}:{mins[k]:02d}:00",
                         d.isoformat(), int(hrs[k]), round(float(amts[k]), 2),
                         modes[k], HASH[cust_ids[ch[k]]] if att[k] else ""))

tea = pd.DataFrame(tea_rows, columns=["txn_id","timestamp","txn_date","hour",
                                      "amount","payment_mode","customer_id"])
tea.to_csv(os.path.join(OUT, "teastall_payments.csv"), index=False)

# ----------------------------------------------------------------------------
print("=" * 68)
print("BILLING MERCHANT — Sharma Kirana Store")
print(f"  window        : {START} -> {END}  ({DAYS} days)")
print(f"  SKUs          : {NP}")
print(f"  bills         : {bills.bill_id.nunique():,}")
print(f"  line items    : {len(bills):,}")
print(f"  revenue       : Rs {bills.line_revenue.sum():,.0f}")
print(f"  COGS          : Rs {bills.line_cost.sum():,.0f}")
print(f"  gross margin  : {100*(1-bills.line_cost.sum()/bills.line_revenue.sum()):.2f}%")
print(f"  unique custs  : {bills[bills.customer_id!=''].customer_id.nunique():,}")
print()
print("NON-BILLING MERCHANT — Anna Tea & Snacks")
print(f"  transactions  : {len(tea):,}")
print(f"  collection    : Rs {tea.amount.sum():,.0f}")
print(f"  avg ticket    : Rs {tea.amount.mean():.1f}")
print("=" * 68)
print("files:", sorted(os.listdir(OUT)))

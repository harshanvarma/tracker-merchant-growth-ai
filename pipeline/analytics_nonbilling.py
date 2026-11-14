"""
Saarthi — the non-billing track.

Anna Tea & Snacks has no POS, no catalogue, no cost per item. All Saarthi gets
is a stream of payment events. This file computes everything that is honestly
derivable from that, and nothing more — which is the whole point of the
Intelligence Level design. Profit here is an ESTIMATE from a margin the merchant
declared at setup, and it is labelled as such everywhere in the app.

Writes app/intelligence_nonbilling.json.
"""
import json, os, warnings
import numpy as np, pandas as pd
from datetime import date, timedelta

warnings.filterwarnings("ignore")
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.seasonal import STL
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA, APP = os.path.join(HERE, "data"), os.path.join(HERE, "app")
RNG = np.random.default_rng(11)
REPORT = []

def wape(a, p):
    a, p = np.asarray(a, float), np.asarray(p, float)
    return float(np.abs(a - p).sum() / np.abs(a).sum() * 100)

# ---- setup answers the merchant gave during onboarding ---------------------
DECLARED_MARGIN = 0.40          # tea is high-margin, packaged snacks are not
FIXED = dict(rent=9000, gas_fuel=6500, helper=11000, milk_supply_advance=0,
             electricity=1800, other=1200)
FIXED_MONTHLY = float(sum(FIXED.values()))

FESTIVALS = {"2026-01-14": "Makar Sankranti", "2026-03-04": "Holi",
             "2026-03-20": "Eid al-Fitr", "2026-04-14": "Ugadi",
             "2026-08-28": "Raksha Bandhan", "2026-09-14": "Ganesh Chaturthi",
             "2026-10-19": "Dussehra", "2026-11-08": "Diwali",
             "2025-12-25": "Christmas"}
FEST_DATES = pd.to_datetime(sorted(FESTIVALS))

tx = pd.read_csv(os.path.join(DATA, "teastall_payments.csv"),
                 keep_default_na=False, na_values=[])
tx["txn_date"] = pd.to_datetime(tx.txn_date)
ASOF = tx.txn_date.max()

# ---- daily / hourly / weekday ---------------------------------------------
daily = tx.groupby("txn_date").agg(revenue=("amount", "sum"),
                                   txns=("txn_id", "count")).reset_index()
daily["atv"] = daily.revenue / daily.txns
mode = tx.pivot_table(index="txn_date", columns="payment_mode",
                      values="amount", aggfunc="sum").fillna(0)
daily["upi"] = mode.get("Paytm UPI", 0).reindex(daily.txn_date).fillna(0).values
daily["cash"] = mode.get("Cash", 0).reindex(daily.txn_date).fillna(0).values

hourly = tx.groupby("hour").agg(revenue=("amount", "sum"),
                                txns=("txn_id", "count")).reset_index()
hourly["share"] = hourly.revenue / hourly.revenue.sum() * 100

wk = daily.copy(); wk["wd"] = wk.txn_date.dt.weekday
WDN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
weekday = wk.groupby("wd").agg(revenue=("revenue", "mean"),
                               txns=("txns", "mean")).reset_index()
weekday["name"] = [WDN[i] for i in weekday.wd]
weekday["vs_avg"] = (weekday.revenue / weekday.revenue.mean() - 1) * 100

hm = tx.copy(); hm["wd"] = hm.txn_date.dt.weekday
heat = hm.pivot_table(index="wd", columns="hour", values="amount",
                      aggfunc="sum").fillna(0) / (len(daily) / 7.0)

monthly = daily.copy(); monthly["ym"] = monthly.txn_date.dt.strftime("%Y-%m")
monthly = monthly.groupby("ym").agg(revenue=("revenue", "sum"),
                                    txns=("txns", "sum"),
                                    days=("txn_date", "nunique")).reset_index()
monthly["est_gross"] = monthly.revenue * DECLARED_MARGIN
monthly["fixed"] = FIXED_MONTHLY * (monthly.days / 30.0)
monthly["est_net"] = monthly.est_gross - monthly.fixed

# ---- ticket-size mix: the only "product" signal available -----------------
bins = [0, 15, 25, 40, 60, 100, 150, 10000]
labels = ["≤₹15", "₹16-25", "₹26-40", "₹41-60",
          "₹61-100", "₹101-150", "₹150+"]
tx["band"] = pd.cut(tx.amount, bins=bins, labels=labels)
tickets = tx.groupby("band", observed=True).agg(
    txns=("txn_id", "count"), revenue=("amount", "sum")).reset_index()
tickets["txn_share"] = tickets.txns / tickets.txns.sum() * 100
tickets["rev_share"] = tickets.revenue / tickets.revenue.sum() * 100

# ---- forecast --------------------------------------------------------------
rev = daily.set_index("txn_date").revenue.asfreq("D").interpolate()
def fit(x):
    return ExponentialSmoothing(x, trend="add", damped_trend=True, seasonal="add",
                                seasonal_periods=7,
                                initialization_method="estimated").fit(optimized=True)
errs, nerrs = [], []
for k in range(5, 0, -1):
    cut = len(rev) - k * 14
    tr, te = rev.iloc[:cut], rev.iloc[cut:cut + 14]
    if len(te) < 14: continue
    errs.append(wape(te, fit(tr).forecast(14)))
    nerrs.append(wape(te, np.tile(tr.iloc[-7:].values, 2)[:14]))
HW_WAPE = float(np.mean(errs))
REPORT.append(dict(model="Holt-Winters (damped, weekly)", task="30-day collection forecast",
                   metric="WAPE", value=round(HW_WAPE, 2),
                   baseline=f"seasonal-naive {np.mean(nerrs):.2f}",
                   note="rolling-origin, 5 folds x 14d"))
hwm = fit(rev); fc = hwm.forecast(30); sd = float((rev - hwm.fittedvalues).std())
forecast = [dict(d=(ASOF + timedelta(days=i + 1)).strftime("%Y-%m-%d"),
                 yhat=round(float(fc.iloc[i]), 0),
                 lo=round(float(fc.iloc[i] - 1.28 * sd), 0),
                 hi=round(float(fc.iloc[i] + 1.28 * sd), 0)) for i in range(30)]

# ---- anomalies -------------------------------------------------------------
stl = STL(rev, period=7, robust=True).fit()
r = stl.resid; mad = float(np.median(np.abs(r - np.median(r)))) or 1.0
z = 0.6745 * (r - np.median(r)) / mad
def near_festival(d, win=2):
    for fd in FEST_DATES:
        if abs((d - fd).days) <= win:
            return FESTIVALS[fd.strftime("%Y-%m-%d")]
    return ""

anoms = sorted([dict(d=d.strftime("%Y-%m-%d"), z=round(float(zi), 2),
                     actual=round(float(a), 0), expected=round(float(a - rr), 0),
                     kind="spike" if zi > 0 else "dip", festival=near_festival(d))
                for d, zi, a, rr in zip(rev.index, z, rev.values, r.values)
                if abs(zi) >= 3.5], key=lambda x: -abs(x["z"]))[:15]
REPORT.append(dict(model="STL + robust z-score", task="collection anomaly detection",
                   metric="flagged days", value=len(anoms),
                   baseline="|z| >= 3.5 on MAD-scaled residual", note="weekly period"))

# ---- customers -------------------------------------------------------------
cb = tx[tx.customer_id != ""]
rfm = cb.groupby("customer_id").agg(
    recency=("txn_date", lambda x: int((ASOF - x.max()).days)),
    frequency=("txn_id", "count"), monetary=("amount", "sum"),
    avg_ticket=("amount", "mean"), first=("txn_date", "min"),
    last=("txn_date", "max")).reset_index()
rfm["tenure"] = (rfm.last - rfm.first).dt.days + 1
rfm["vpm"] = rfm.frequency / (rfm.tenure / 30.0).clip(lower=1)
def seg(x):
    if x.recency <= 7 and x.vpm >= 15: return "Champion"
    if x.recency <= 14 and x.vpm >= 8: return "Loyal"
    if x.recency <= 30: return "Active"
    if x.recency <= 60: return "Slipping"
    if x.recency <= 120: return "Lapsed"
    return "Lost"
rfm["segment"] = rfm.apply(seg, axis=1)
segs = [dict(segment=sx, customers=int((rfm.segment == sx).sum()),
             revenue=round(float(rfm[rfm.segment == sx].monetary.sum()), 0),
             avg_ticket=round(float(rfm[rfm.segment == sx].avg_ticket.mean()), 0)
             if (rfm.segment == sx).any() else 0,
             visits_pm=round(float(rfm[rfm.segment == sx].vpm.mean()), 1)
             if (rfm.segment == sx).any() else 0)
        for sx in ["Champion", "Loyal", "Active", "Slipping", "Lapsed", "Lost"]]
wb = rfm[rfm.segment.isin(["Slipping", "Lapsed"]) & (rfm.frequency >= 25)].copy()
wb["at_risk"] = wb.avg_ticket * wb.vpm * 3
wb = wb.sort_values("at_risk", ascending=False).head(20)
winback = [dict(id=x.customer_id[:8] + "…", recency=int(x.recency),
                visits=int(x.frequency), avg_ticket=round(float(x.avg_ticket), 0),
                spent=round(float(x.monetary), 0), segment=x.segment,
                at_risk=round(float(x.at_risk), 0)) for x in wb.itertuples()]
cut = rfm.monetary.quantile(0.8)
PARETO = float(rfm[rfm.monetary >= cut].monetary.sum() / rfm.monetary.sum() * 100)
REPORT.append(dict(model="RFM segmentation", task="customer value + lapse detection",
                   metric="customers segmented", value=int(len(rfm)),
                   baseline="hashed UPI payer IDs only",
                   note=f"top 20% drive {PARETO:.0f}% of attributed collection"))

# ---- cash flow (estimated) -------------------------------------------------
inflow = float(fc.sum())
restock = inflow * (1 - DECLARED_MARGIN)
cashflow = dict(inflow30=round(inflow, 0), restock30=round(restock, 0),
                fixed30=round(FIXED_MONTHLY, 0),
                net30=round(inflow - restock - FIXED_MONTHLY, 0),
                margin_used=round(DECLARED_MARGIN * 100, 1), estimated=True,
                udhaar_locked=0, peak_stock_need=round(
                    float(pd.Series([f["yhat"] for f in forecast]).rolling(10).sum().max()
                          * (1 - DECLARED_MARGIN)), 0),
                peak_window_start=forecast[0]["d"], peak_window_end=forecast[9]["d"])

# ---- credit (same underwriting model, fewer inputs) ------------------------
N = 6000
sim = pd.DataFrame(dict(tenure_m=RNG.integers(3, 120, N),
                        avg_rev=RNG.lognormal(12.6, 0.8, N),
                        growth=RNG.normal(0.06, 0.22, N),
                        volatility=RNG.gamma(2.2, 0.11, N),
                        zero_days=RNG.binomial(90, 0.05, N),
                        digital_share=RNG.beta(6, 3, N),
                        margin=RNG.normal(0.13, 0.05, N).clip(0.02, 0.4),
                        udhaar_share=RNG.beta(1.6, 14, N),
                        turns=RNG.gamma(4.0, 2.2, N)))
sim["coverage"] = (sim.avg_rev * sim.margin) / (sim.avg_rev * 0.09 + 1)
lg = (-0.72 - 0.085 * (sim.tenure_m / 12) - 3.60 * sim.growth + 6.10 * sim.volatility
      + 0.071 * sim.zero_days - 2.30 * sim.digital_share - 4.40 * sim.margin
      + 9.80 * sim.udhaar_share - 0.038 * sim.turns - 0.95 * np.log1p(sim.coverage)
      - 0.26 * (np.log(sim.avg_rev) - 12.6))
sim["default"] = RNG.binomial(1, 1 / (1 + np.exp(-lg)))
CF = ["tenure_m", "avg_rev", "growth", "volatility", "zero_days", "digital_share",
      "margin", "udhaar_share", "turns", "coverage"]
Xtr, Xte, ytr, yte = train_test_split(sim[CF], sim.default, test_size=0.3,
                                      random_state=7, stratify=sim.default)
clf = HistGradientBoostingClassifier(max_iter=320, learning_rate=0.06, max_depth=5,
                                     random_state=7).fit(Xtr, ytr)
AUC = float(roc_auc_score(yte, clf.predict_proba(Xte)[:, 1]))

m_rev = float(monthly.revenue.tail(6).mean())
l3, p3 = float(monthly.revenue.tail(3).sum()), float(monthly.revenue.iloc[-6:-3].sum())
feat = dict(tenure_m=float(len(monthly)), avg_rev=m_rev,
            growth=(l3 / p3 - 1) if p3 else 0.0,
            volatility=float(daily.tail(90).revenue.std() / daily.tail(90).revenue.mean()),
            zero_days=float((daily.tail(90).revenue < daily.revenue.mean() * 0.25).sum()),
            digital_share=float(daily.tail(90).upi.sum() / daily.tail(90).revenue.sum()),
            margin=DECLARED_MARGIN * 0.35,     # haircut: margin is self-declared, unverified
            udhaar_share=0.0, turns=18.0)
feat["coverage"] = (m_rev * feat["margin"]) / FIXED_MONTHLY
# clip to the training range, as in the billing track
BOUNDS = {c: (float(sim[c].quantile(0.01)), float(sim[c].quantile(0.99))) for c in CF}
feat_raw = dict(feat)
clipped = [dict(f=c, raw=round(feat[c], 3),
                used=round(min(max(feat[c], *BOUNDS[c][:1]), BOUNDS[c][1]), 3))
           for c in CF if feat[c] < BOUNDS[c][0] or feat[c] > BOUNDS[c][1]]
for c in CF:
    feat[c] = min(max(feat[c], BOUNDS[c][0]), BOUNDS[c][1])
PD_M = float(clf.predict_proba(pd.DataFrame([feat])[CF])[0, 1])
# No billing data, so the overlay floor is higher than for a billing merchant
FLOOR = 0.075
PD = max(PD_M, FLOOR)
limit = float(np.round(min(m_rev * 0.45, 150000.0) * (1 - PD) / 2500) * 2500)
rate = round(16.5 + PD * 62, 1)
credit = dict(pd=round(PD * 100, 2), pd_model=round(PD_M * 100, 2),
              floor=round(FLOOR * 100, 1), cap=150000.0,
              score=int(round(300 + (1 - PD) * 600)),
              band=("Prime" if PD < 0.06 else "Near-prime" if PD < 0.12
                    else "Watch" if PD < 0.25 else "Sub-prime"),
              limit=limit, rate=rate, tenor_months=12, auc=round(AUC, 3),
              emi=round(limit * (rate / 1200) / (1 - (1 + rate / 1200) ** -12), 0),
              features={k: round(v, 4) for k, v in feat_raw.items()}, clipped=clipped,
              drivers=sorted([
                  dict(f="Digital payment share", v=round(feat["digital_share"] * 100, 1),
                       unit="%", good=feat["digital_share"] > 0.6),
                  dict(f="Collection growth (3m vs 3m)", v=round(feat["growth"] * 100, 1),
                       unit="%", good=feat["growth"] > 0),
                  dict(f="Daily collection volatility", v=round(feat["volatility"], 2),
                       unit="CV", good=feat["volatility"] < 0.25),
                  dict(f="Trading history", v=round(feat["tenure_m"], 0),
                       unit="months", good=feat["tenure_m"] >= 12),
                  dict(f="Fixed-cost coverage (estimated)", v=round(feat["coverage"], 2),
                       unit="x", good=feat["coverage"] > 1.3),
                  dict(f="Verified cost data", v=0, unit="— none",
                       good=False),
              ], key=lambda x: x["good"]))
REPORT.append(dict(model="HistGradientBoosting (credit risk)",
                   task="probability of default, payments-only features",
                   metric="ROC-AUC", value=round(AUC, 3),
                   baseline=f"{int(sim.default.mean()*100)}% base default rate",
                   note="same model as the billing track; margin input is haircut "
                        "because it is self-declared, and the segment floor is "
                        "7.5% instead of 3.5%"))

# ---- health ----------------------------------------------------------------
r30, r30p = float(daily.tail(30).revenue.sum()), float(daily.iloc[-60:-30].revenue.sum())
g30 = (r30 / r30p - 1) if r30p else 0
quiet = int((rfm.segment.isin(["Slipping", "Lapsed", "Lost"])).sum())
comp = [
    dict(k="Collection growth", w=0.35, s=float(np.clip(50 + g30 * 420, 0, 100)),
         detail=f"{g30*100:+.1f}% vs previous 30 days"),
    dict(k="Cash-flow stability", w=0.25, s=float(np.clip(100 - feat["volatility"] * 260, 0, 100)),
         detail=f"CV {feat['volatility']:.2f} on daily collection"),
    dict(k="Customer retention", w=0.25, s=float(np.clip(100 - quiet / len(rfm) * 230, 0, 100)),
         detail=f"{quiet} of {len(rfm)} customers gone quiet"),
    dict(k="Digital adoption", w=0.15, s=float(np.clip(feat["digital_share"] * 125, 0, 100)),
         detail=f"{feat['digital_share']*100:.0f}% of collection is digital"),
]
HEALTH = int(round(sum(c["s"] * c["w"] for c in comp)))
for c in comp: c["s"] = round(c["s"], 1)

# ---- nudges ----------------------------------------------------------------
worst = weekday.sort_values("vs_avg").iloc[0]
best_h = hourly.sort_values("revenue", ascending=False).iloc[0]
nudges = [
    dict(sev="info", icon="trend", title=f"{worst['name']} is your weakest day",
         body=f"{worst['name']} averages \u20b9{worst.revenue:,.0f} against \u20b9"
              f"{weekday.revenue.mean():,.0f} on a normal day — {abs(worst.vs_avg):.0f}% down. "
              f"Office crowd is thin. A small combo price could pull it up.",
         action="Open Trends", mod="trends"),
    dict(sev="crit", icon="lock", title="Your profit number is still a guess",
         body=f"Saarthi is using the {DECLARED_MARGIN*100:.0f}% margin you entered at setup, "
              f"so \u20b9{monthly.est_net.iloc[-2]:,.0f} net last month is an estimate, not a fact. "
              f"Start Quick Bill or snap one supplier bill and this becomes real.",
         action="Unlock Level 3", mod="level"),
    dict(sev="info", icon="clock", title=f"{int(best_h.hour)}:00 is your money hour",
         body=f"{best_h.share:.1f}% of everything you collect comes in that hour. "
              f"Running short of stock or help at that time costs you more than any other.",
         action="Open Trends", mod="trends"),
]
if winback:
    nudges.append(dict(sev="warn", icon="users",
        title=f"{len(winback)} regulars have stopped coming",
        body=f"Together they were worth about \u20b9{sum(w['at_risk'] for w in winback):,.0f} "
             f"over three months. The top one came {winback[0]['visits']} times and has "
             f"not been seen for {winback[0]['recency']} days.",
        action="Send win-back offer", mod="customers"))
nxt = [(FESTIVALS[d.strftime('%Y-%m-%d')], d) for d in FEST_DATES if d > ASOF]
if nxt:
    nm, fd = nxt[0]
    nudges.append(dict(sev="info", icon="star", title=f"{nm} is {(fd-ASOF).days} days away",
        body=f"Festival weeks ran {np.mean([a['actual']/max(a['expected'],1) for a in anoms if a['festival']] or [1.2]):.2f}x "
             f"your normal collection. Keep extra milk and gas ready.",
        action="Open Forecast", mod="forecast"))

d0 = daily.txn_date.min()
out = dict(
    meta=dict(generated=str(date.today()), asof=ASOF.strftime("%Y-%m-%d"),
              day0=d0.strftime("%Y-%m-%d"), days=len(daily), currency="INR"),
    merchant=dict(name="Anna Tea & Snacks", owner="Srinivas Reddy",
                  category="Tea Stall / Street Food", city="Ameerpet, Hyderabad",
                  pincode="500016", type="non-billing", billing_system="None — QR only",
                  since="2019", intelligence_level=2),
    totals=dict(revenue=round(float(tx.amount.sum()), 0),
                txns=int(len(tx)), atv=round(float(tx.amount.mean()), 1),
                est_gross=round(float(tx.amount.sum() * DECLARED_MARGIN), 0),
                declared_margin=round(DECLARED_MARGIN * 100, 1)),
    expenses=FIXED, fixed_monthly=FIXED_MONTHLY,
    daily=[[int((r.txn_date - d0).days), round(r.revenue, 0), int(r.txns),
            round(r.upi, 0), round(r.cash, 0)] for r in daily.itertuples()],
    daily_cols=["day", "revenue", "txns", "upi", "cash"],
    hourly=[dict(h=int(r.hour), revenue=round(r.revenue, 0), txns=int(r.txns),
                 share=round(r.share, 2)) for r in hourly.itertuples()],
    weekday=[dict(wd=int(r.wd), name=r["name"], revenue=round(r.revenue, 0),
                  txns=round(r.txns, 1), vs_avg=round(r.vs_avg, 1))
             for _, r in weekday.iterrows()],
    heatmap=[[int(v) for v in heat.reindex(columns=range(6, 23)).fillna(0).values[i]]
             for i in range(7)],
    heatmap_hours=list(range(6, 23)),
    monthly=[dict(ym=r.ym, revenue=round(r.revenue, 0),
                  est_gross=round(r.est_gross, 0), fixed=round(r.fixed, 0),
                  est_net=round(r.est_net, 0), txns=int(r.txns), days=int(r.days))
             for r in monthly.itertuples()],
    tickets=[dict(band=str(r.band), txns=int(r.txns), revenue=round(r.revenue, 0),
                  txn_share=round(r.txn_share, 1), rev_share=round(r.rev_share, 1))
             for r in tickets.itertuples()],
    forecast=dict(shop=forecast, wape=round(HW_WAPE, 2),
                  model="Holt-Winters (damped, weekly)"),
    anomalies=anoms, cashflow=cashflow, credit=credit,
    customers=dict(total=int(len(rfm)), pareto=round(PARETO, 1), segments=segs,
                   winback=winback, at_risk=round(float(wb.at_risk.sum()), 0),
                   attributed_share=round(float(cb.amount.sum() / tx.amount.sum() * 100), 1)),
    health=dict(score=HEALTH, components=comp),
    nudges=nudges, model_report=REPORT,
    locked=["Profit & margin per item", "Inventory and reorder alerts",
            "Dead stock detection", "Basket analysis", "Price elasticity",
            "GST-ready categorisation"],
)
with open(os.path.join(APP, "intelligence_nonbilling.json"), "w") as f:
    json.dump(out, f, separators=(",", ":"))

print("=" * 68)
print("NON-BILLING TRACK — Anna Tea & Snacks")
for rp in REPORT:
    print(f"  {rp['model']:<42} {rp['metric']}: {rp['value']}")
print("-" * 68)
print(f"  collection (1y)   : \u20b9{tx.amount.sum():,.0f} over {len(tx):,} txns")
print(f"  avg ticket        : \u20b9{tx.amount.mean():.1f}")
print(f"  health            : {HEALTH}/100")
print(f"  credit            : PD {PD*100:.2f}% -> \u20b9{limit:,.0f} @ {rate}%")
print(f"  est. monthly net  : \u20b9{monthly.est_net.tail(1).iloc[0]:,.0f}  (ESTIMATE)")
print(f"  locked features   : {len(out['locked'])}")
print(f"  json              : {os.path.getsize(os.path.join(APP,'intelligence_nonbilling.json'))/1e3:.0f} KB")
print("=" * 68)

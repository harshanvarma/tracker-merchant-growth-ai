"""Add per-product timing to the billing dataset: when in the day, when in the
week, and when in the year each product actually sells."""
import json, os
import pandas as pd, numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.join(ROOT, "app")
SRC = os.path.join(ROOT, "data", "kirana_bills.csv")

b = pd.read_csv(SRC, parse_dates=["bill_date"])
b["wd"] = b.bill_date.dt.weekday
b["ym"] = b.bill_date.dt.strftime("%Y-%m")

d = json.load(open(os.path.join(HERE, "intelligence.json")))
skus = [s["sku"] for s in d["sku_list"]]
idx = {s: i for i, s in enumerate(skus)}

HOURS = list(range(7, 23))
MONTHS = sorted(b.ym.unique())
WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

hour_p = b.pivot_table(index="sku", columns="hour", values="qty", aggfunc="sum").fillna(0)
wd_p = b.pivot_table(index="sku", columns="wd", values="qty", aggfunc="sum").fillna(0)
mo_p = b.pivot_table(index="sku", columns="ym", values="qty", aggfunc="sum").fillna(0)
mo_rev = b.pivot_table(index="sku", columns="ym", values="line_revenue", aggfunc="sum").fillna(0)

timing = {}
for s in skus:
    h = [int(hour_p.loc[s].get(x, 0)) if s in hour_p.index else 0 for x in HOURS]
    w = [int(wd_p.loc[s].get(x, 0)) if s in wd_p.index else 0 for x in range(7)]
    m = [int(mo_p.loc[s].get(x, 0)) if s in mo_p.index else 0 for x in MONTHS]
    tot = sum(h) or 1
    peak_h = HOURS[int(np.argmax(h))] if sum(h) else None
    peak_wd = WD[int(np.argmax(w))] if sum(w) else None
    peak_mo = MONTHS[int(np.argmax(m))] if sum(m) else None
    # how concentrated is it? share held by the single best hour
    timing[s] = dict(hours=h, wd=w, months=m,
                     peak_hour=peak_h, peak_wd=peak_wd, peak_month=peak_mo,
                     hour_share=round(max(h) / tot * 100, 1) if sum(h) else 0,
                     wd_share=round(max(w) / (sum(w) or 1) * 100, 1))

# monthly totals the Tracker can answer from directly
monthly_rev = {m: round(float(b[b.ym == m].line_revenue.sum()), 0) for m in MONTHS}

# top product per month, so "what sold most in October" is answerable
top_by_month = {}
name_of = {x["sku"]: x["name"] for x in d["sku_list"]}
for m in MONTHS:
    col = mo_p[m] if m in mo_p.columns else None
    if col is None or col.sum() == 0:
        continue
    s = col.idxmax()
    rv = float(mo_rev.loc[s, m]) if s in mo_rev.index else 0.0
    top_by_month[m] = dict(sku=s, name=name_of.get(s, s), qty=int(col.max()), revenue=round(rv, 0))

# weekly series for "which week earned least"
wk = b.copy()
wk["week_start"] = (wk.bill_date - pd.to_timedelta(wk.bill_date.dt.weekday, unit="D")).dt.strftime("%Y-%m-%d")
weekly = wk.groupby("week_start").agg(revenue=("line_revenue", "sum"),
                                      bills=("bill_id", "nunique"),
                                      cogs=("line_cost", "sum")).reset_index()
weeks = [dict(w=r.week_start, revenue=round(r.revenue, 0), bills=int(r.bills),
              cogs=round(r.cogs, 0)) for r in weekly.itertuples()]

d["timing"] = timing
d["timing_hours"] = HOURS
d["timing_months"] = MONTHS
d["top_by_month"] = top_by_month
d["monthly_rev"] = monthly_rev
d["weekly"] = weeks
json.dump(d, open(os.path.join(HERE, "intelligence.json"), "w"), separators=(",", ":"))

# the non-billing side only needs weekly
import csv
t = pd.read_csv(os.path.join(ROOT, "data", "teastall_payments.csv"),
                parse_dates=["txn_date"])
t["week_start"] = (t.txn_date - pd.to_timedelta(t.txn_date.dt.weekday, unit="D")).dt.strftime("%Y-%m-%d")
tw = t.groupby("week_start").agg(revenue=("amount", "sum"), bills=("txn_id", "count")).reset_index()
n = json.load(open(os.path.join(HERE, "intelligence_nonbilling.json")))
n["weekly"] = [dict(w=r.week_start, revenue=round(r.revenue, 0), bills=int(r.bills), cogs=0)
               for r in tw.itertuples()]
n["monthly_rev"] = {m["ym"]: m["revenue"] for m in n["monthly"]}
json.dump(n, open(os.path.join(HERE, "intelligence_nonbilling.json"), "w"), separators=(",", ":"))

print(f"products with timing : {len(timing)}")
print(f"months               : {len(MONTHS)}  ({MONTHS[0]} .. {MONTHS[-1]})")
print(f"weeks (billing)      : {len(weeks)}")
print(f"weeks (non-billing)  : {len(n['weekly'])}")
ex = d["sku_list"][0]["sku"]
print(f"example {name_of[ex]}: peak hour {timing[ex]['peak_hour']}:00 "
      f"({timing[ex]['hour_share']}%), peak day {timing[ex]['peak_wd']}, "
      f"peak month {timing[ex]['peak_month']}")
print(f"top in 2026-11        : {top_by_month.get('2026-11')}")
print(f"json size             : {os.path.getsize(os.path.join(HERE,'intelligence.json'))/1e6:.2f} MB")

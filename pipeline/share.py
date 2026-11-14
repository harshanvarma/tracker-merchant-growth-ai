"""
"Your Share" — the only layer that needs BOTH sides of the market.

Paytm sees the same shopper paying at many merchants. That makes four things
knowable that a merchant cannot possibly work out alone, and that no competitor
can supply: wallet share, leakage, catchment blind spots, and adjacent demand.

This file SIMULATES that cross-merchant view. Everything else in this project is
computed from the transaction file; this is the one part that is modelled, and
the app says so on screen. Figures are tied to the merchant's real revenue so
nothing contradicts anything else.
"""
import json, os
import numpy as np

HERE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app")
RNG = np.random.default_rng(31)

for FN, OUT in (("intelligence.json", "share_billing"),
                ("intelligence_nonbilling.json", "share_nonbilling")):
    d = json.load(open(os.path.join(HERE, FN)))
    months = [m["ym"] for m in d["monthly"]]
    full = [m for m in d["monthly"] if m.get("days", 30) >= 25]
    mrev = float(np.mean([m["revenue"] for m in full[-6:]]))      # merchant's own monthly revenue
    cust = d["customers"]["total"]
    attributed = d["customers"]["attributed_share"] / 100.0
    kirana = d["merchant"]["type"] == "billing"

    # --- wallet share -------------------------------------------------------
    from_known = mrev * attributed                 # what identified customers bring in
    share_pct = 22.4 if kirana else 31.8           # of their category wallet in this area
    wallet = from_known / (share_pct / 100)        # their total category spend nearby
    per_cust = wallet / max(cust, 1)

    # 13 months of share, drifting down as quick commerce takes hold
    drift = np.linspace(share_pct + 3.4, share_pct, len(months))
    noise = RNG.normal(0, 0.45, len(months))
    share_series = [dict(ym=m, share=round(float(max(5, s + n)), 1),
                         wallet=round(float(wallet * RNG.normal(1, .05)), 0))
                    for m, s, n in zip(months, drift, noise)]

    # --- where the rest of the money goes -----------------------------------
    rest = wallet - from_known
    if kirana:
        split = [("Two kirana shops within 500 m", .34, +2.1, "kirana"),
                 ("A supermarket 1.8 km away", .27, +0.8, "supermarket"),
                 ("Quick commerce apps", .22, +31.4, "quick"),
                 ("Weekly vegetable market", .17, -4.2, "market")]
    else:
        split = [("Other tea and snack stalls nearby", .41, +1.4, "kirana"),
                 ("Cafes and chains", .24, +12.7, "supermarket"),
                 ("Quick commerce apps", .19, +28.9, "quick"),
                 ("Office canteens", .16, -2.8, "market")]
    leakage = [dict(where=w, amount=round(rest * f, 0),
                    pct=round(f * 100, 1), trend=t, kind=k)
               for w, f, t, k in split]

    # --- the switchers ------------------------------------------------------
    n_switch = int(cust * (0.077 if kirana else 0.052))
    basket_before = (from_known / cust) / 4.3      # per visit, roughly
    switchers = dict(
        count=n_switch,
        started="2026-08",
        still_visiting=int(n_switch * 0.74),
        stopped=int(n_switch * 0.26),
        basket_drop=35 if kirana else 28,
        basket_before=round(float(basket_before), 0),
        basket_after=round(float(basket_before * (0.65 if kirana else 0.72)), 0),
        monthly_loss=round(float(n_switch * basket_before * 0.35 * 4.3), 0),
        annual_loss=round(float(n_switch * basket_before * 0.35 * 4.3 * 12), 0),
        # what they moved to quick commerce, by what they buy
        moved=[("Packaged staples", 38), ("Dairy", 24), ("Snacks", 19),
               ("Home care", 12), ("Personal care", 7)] if kirana
              else [("Evening snacks", 44), ("Cold drinks", 31), ("Tea", 25)],
    )

    # --- catchment blind spot ----------------------------------------------
    bands = [("Under 300 m", 480, 0.61), ("300 – 600 m", 910, 0.34),
             ("600 m – 1 km", 1640, 0.11), ("1 – 2 km", 3100, 0.03)]
    catchment = []
    for label, users, reach in bands:
        u = int(users * RNG.normal(1, .04))
        r = int(u * reach)
        catchment.append(dict(band=label, users=u, reached=r, never=u - r,
                              reach=round(reach * 100, 1)))
    never_total = sum(c["never"] for c in catchment[:3])
    # the cluster worth chasing: close by, high density, low reach
    cluster = dict(users=int(catchment[1]["never"] * 0.42),
                   direction="north-east, past the bus stop",
                   dist="450 m",
                   spend=round(float(per_cust * 0.86), 0),
                   worth=round(float(catchment[1]["never"] * 0.42 * per_cust * 0.86 * 0.10), 0))

    # --- adjacent demand ----------------------------------------------------
    if kirana:
        adj = [("Chemist / OTC medicines", 31200, "No chemist within 700 m", True),
               ("Fresh fruit", 24800, "Only the weekly market stocks it", True),
               ("Bakery and eggs", 18400, "One shop, closes by 7 pm", True),
               ("Stationery", 7600, "Seasonal, peaks in June", False)]
    else:
        adj = [("Packaged breakfast", 14300, "Nothing open before 8 am nearby", True),
               ("Filter coffee", 11900, "Customers walk 600 m for it", True),
               ("Cigarettes and pan", 9100, "Two stalls already serve this", False)]
    adjacent = [dict(cat=c, monthly=v, note=n, gap=g) for c, v, n, g in adj]

    out = dict(
        simulated=True,
        customers=cust,
        attributed_share=round(attributed * 100, 1),
        from_known=round(from_known, 0),
        wallet=round(wallet, 0),
        per_customer=round(per_cust, 0),
        share_pct=share_pct,
        share_series=share_series,
        share_change=round(share_series[-1]["share"] - share_series[0]["share"], 1),
        leakage=leakage,
        rest=round(rest, 0),
        switchers=switchers,
        catchment=catchment,
        never_total=never_total,
        cluster=cluster,
        adjacent=adjacent,
        adjacent_total=sum(a["monthly"] for a in adjacent if a["gap"]),
    )
    json.dump(out, open(os.path.join(HERE, OUT + ".json"), "w"), separators=(",", ":"))
    print(f"{OUT:<18} customers={cust:<5} wallet=₹{wallet:,.0f}/mo  "
          f"share={share_pct}% ({out['share_change']:+.1f}pt)  "
          f"switchers={n_switch}  losing ₹{switchers['annual_loss']:,.0f}/yr  "
          f"never-visited={never_total:,}")

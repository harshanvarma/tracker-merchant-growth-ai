/* ==================================================================
   Tracker — the question engine.

   Deliberately NOT a language model doing arithmetic. The question is
   parsed into an intent and a date range, the numbers are computed in
   code, and only then are they put into a sentence. It can fail to
   understand you. It cannot invent a figure.
   ================================================================== */

const MONTH_WORDS = {
  january:0, jan:0, february:1, feb:1, march:2, mar:2, april:3, apr:3, may:4,
  june:5, jun:5, july:6, jul:6, august:7, aug:7, september:8, sep:8, sept:8,
  october:9, oct:9, november:10, nov:10, december:11, dec:11,
};
const DAY_WORDS = { monday:0, mon:0, tuesday:1, tue:1, tues:1, wednesday:2, wed:2,
  thursday:3, thu:3, thur:3, friday:4, fri:4, saturday:5, sat:5, sunday:6, sun:6,
  somvar:0, mangalvar:1, budhvar:2, guruvar:3, shukravar:4, shanivar:5, ravivar:6 };

/* ------------------------- date ranges --------------------------- */
function rng(spec) {
  const d = D(), n = d.meta.days, asof = new Date(d.meta.asof + "T00:00:00");
  const mk = (a, b, label) => ({ a: Math.max(0, a), b: Math.min(n - 1, b), label });
  switch (spec.kind) {
    case "today": return mk(n - 1, n - 1, "today");
    case "yesterday": return mk(n - 2, n - 2, "yesterday");
    case "last7": return mk(n - 7, n - 1, "the last 7 days");
    case "last30": return mk(n - 30, n - 1, "the last 30 days");
    case "last90": return mk(n - 90, n - 1, "the last 3 months");
    case "thisweek": {
      const wd = (asof.getDay() + 6) % 7;
      return mk(n - 1 - wd, n - 1, "this week so far");
    }
    case "lastweek": {
      const wd = (asof.getDay() + 6) % 7;
      return mk(n - 1 - wd - 7, n - 2 - wd, "last week");
    }
    case "thismonth": return mk(n - asof.getDate(), n - 1, "this month so far");
    case "lastmonth": {
      const ms = d.monthly.filter(m => (m.days || 30) >= 25);
      const ym = ms[ms.length - 1].ym;
      return ymRange(ym);
    }
    case "month": return ymRange(spec.ym);
    case "year": return mk(0, n - 1, "the whole period");
    default: return mk(n - 30, n - 1, "the last 30 days");
  }
}
function ymRange(ym) {
  const d = D();
  const y = +ym.slice(0, 4), m = +ym.slice(5, 7);
  const base = Date.UTC(+d.meta.day0.slice(0, 4), +d.meta.day0.slice(5, 7) - 1,
                        +d.meta.day0.slice(8, 10));
  const first = Date.UTC(y, m - 1, 1);
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();   // days in that month
  const a = Math.round((first - base) / 864e5);
  return { a: Math.max(0, a), b: Math.min(d.meta.days - 1, a + dim - 1),
           label: ymFull(ym), ym };
}
function agg(r) {
  const dl = daily().slice(r.a, r.b + 1);
  const rev = sum(dl.map(x => x.revenue));
  const cg = sum(dl.map(x => x.cogs || 0));
  const tx = sum(dl.map(txOf));
  return { rev, cogs: cg, tx, days: dl.length, rows: dl,
    profit: tracked() ? rev - cg : rev * marginPct() / 100,
    atv: tx ? rev / tx : 0 };
}

/* ------------------------- understanding -------------------------- */
function parse(qRaw) {
  const q = " " + qRaw.toLowerCase().replace(/[?.,!]/g, " ").replace(/\s+/g, " ") + " ";
  const has = (...w) => w.some(x => q.includes(" " + x) || q.includes(x + " "));

  /* --- time range --- */
  let time = null;
  if (has("today", "aaj", "ఈరోజు", "இன்று")) time = { kind: "today" };
  else if (has("yesterday", "kal", "నిన్న", "நேற்று")) time = { kind: "yesterday" };
  else if (has("last week", "pichle hafte", "previous week", "గత వారం", "கடந்த வாரம்")) time = { kind: "lastweek" };
  else if (has("this week", "is hafte", "ఈ వారం", "இந்த வாரம்")) time = { kind: "thisweek" };
  else if (has("last month", "pichle mahine", "pichle mahina", "previous month", "గత నెల", "கடந்த மாதம்")) time = { kind: "lastmonth" };
  else if (has("this month", "is mahine", "ఈ నెల", "இந்த மாதம்")) time = { kind: "thismonth" };
  else if (has("last 7", "past 7", "7 days", "week")) time = { kind: "last7" };
  else if (has("last 30", "past 30", "30 days")) time = { kind: "last30" };
  else if (has("last 3 month", "90 days", "quarter")) time = { kind: "last90" };
  else if (has("this year", "year", "saal", "all time", "overall", "total")) time = { kind: "year" };
  else {
    for (const w in MONTH_WORDS) {
      if (q.includes(" " + w)) {
        const mo = MONTH_WORDS[w], d = D();
        const cand = (d.timing_months || d.monthly.map(m => m.ym))
          .filter(ym => +ym.split("-")[1] - 1 === mo);
        if (cand.length) { time = { kind: "month", ym: cand[cand.length - 1] }; break; }
      }
    }
  }

  /* --- weekday asked about --- */
  let weekday = null;
  for (const w in DAY_WORDS) if (q.includes(" " + w)) { weekday = DAY_WORDS[w]; break; }

  /* --- product named --- */
  let prod = null;
  if (tracked()) {
    const items = D().sku_list;
    let best = null, bestLen = 0;
    for (const p of items) {
      const nm = p.name.toLowerCase();
      const words = nm.split(/[\s,()]+/).filter(w => w.length > 3);
      for (const w of words) {
        if (q.includes(w) && w.length > bestLen) { best = p; bestLen = w.length; }
      }
      if (q.includes(nm)) { best = p; bestLen = 99; }
    }
    prod = best;
  }

  /* --- intent --- */
  const both = (a, b) => has(a) && has(b);
  const asksDay = has("day", "din", "dinn", "రోజు", "நாள்");
  const asksWorst = has("worst", "lowest", "least", "weakest", "slowest", "bad", "kharab", "kam",
                        "poor", "down");
  const asksBest = has("best", "highest", "top", "most", "strongest", "acha", "accha", "zyada");

  let intent = null;
  if (has("most sold", "sold most", "sold the most", "best selling", "best seller", "sells most",
          "sabse zyada", "top product", "most selling", "zyada bika", "highest selling",
          "which product", "what product", "ఎక్కువ అమ్మ", "அதிகம்") && !asksDay)
    intent = "topproduct";
  else if (has("least sold", "worst selling", "slowest", "not selling", "kam bika", "dead stock",
               "not moving"))
    intent = "deadproduct";
  else if (prod && has("when", "what time", "which hour", "kab", "peak", "ఎప్పుడు", "எப்போது"))
    intent = "producttime";
  else if (prod) intent = "productinfo";
  else if (asksDay && asksWorst) intent = "worstday";
  else if (asksDay && asksBest) intent = "bestday";
  else if (has("least earning", "kam kamai", "lowest earning", "sabse kam")) intent = "worstday";
  else if (has("week") && asksWorst) intent = "worstweek";
  else if (has("month", "mahina", "mahine") && asksWorst && !time) intent = "worstmonth";
  else if (has("month", "mahina", "mahine") && asksBest && !time) intent = "bestmonth";
  else if (has("why") && asksWorst && has("week")) intent = "worstweek";
  else if (has("why") && asksWorst) intent = "worstday";
  else if (has("busiest hour", "peak hour", "busy time", "what time", "which hour", "rush",
               "peak time", "kaun sa time"))
    intent = "peakhour";
  else if (has("average", "normal", "typical", "ausat", "సగటు", "சராசரி")) intent = "average";
  else if (has("profit", "margin", "munafa", "bacha", "kept", "earn after", "లాభం", "லாபம்"))
    intent = "profit";
  else if (has("loan", "credit", "borrow", "score", "karz", "udhaar le", "రుణం", "கடன்"))
    intent = "credit";
  else if (has("share", "wallet", "competitor", "blinkit", "zepto", "quick commerce", "losing",
               "leak", "elsewhere", "hissa"))
    intent = "share";
  else if (has("customer", "regular", "grahak", "lapsed", "stopped coming", "కస్టమర్", "வாடிக்கையாளர்"))
    intent = "customers";
  else if (has("how many bill", "how many payment", "how many transaction", "kitne bill",
               "number of bill", "transactions"))
    intent = "count";
  else if (has("compare", "vs", "versus", "better than", "worse than")) intent = "compare";
  else if (has("how much", "kitna", "kitne", "earn", "kamaya", "kamai", "sale", "sales", "revenue",
               "made", "collected", "total", "ఎంత", "எவ்வளவு"))
    intent = "earnings";
  if (!intent && time) intent = "earnings";
  if (!intent && weekday !== null) intent = "weekday";
  return { intent, time, weekday, prod, q: qRaw };
}

/* ---------------------------- answering --------------------------- */
function answer(p) {
  const d = D(), f = F();
  if (!p.intent) return null;
  const R = p.time ? rng(p.time) : rng({ kind: "last30" });

  switch (p.intent) {
    case "earnings": case "count": case "profit": {
      const a = agg(R);
      const prevR = { a: R.a - (R.b - R.a + 1), b: R.a - 1 };
      const pa = prevR.a >= 0 ? agg(prevR) : null;
      const isP = p.intent === "profit", isC = p.intent === "count";
      const val = isP ? a.profit : isC ? a.tx : a.rev;
      const pv = pa ? (isP ? pa.profit : isC ? pa.tx : pa.rev) : null;
      const ch = pv ? (val / pv - 1) * 100 : null;
      return {
        tag: isP && !tracked() ? "g" : "m",
        value: isC ? nf(val) : inrF(val),
        sub: `${isC ? (tracked() ? "bills" : "payments") : isP ? "kept" : "received"} \u00b7 ${R.label}`,
        means: ch == null ? `Over ${a.days} day${a.days === 1 ? "" : "s"}, averaging ${inrF(a.rev / a.days)} a day.`
          : `That is ${pc(ch)} against the ${a.days} days before it` +
            (isP ? `, at a ${(a.profit / a.rev * 100).toFixed(1)}% margin.`
                 : `, from ${nf(a.tx)} ${tracked() ? "bills" : "payments"} of ${inrF(a.atv)} each.`),
        act: ch == null ? null : ch >= 3 ? "Nothing to fix here \u2014 whatever you changed is working."
          : ch <= -3 ? `Open ${t("low")} to see whether fewer people came or they spent less. The fixes are different.`
          : "Flat. Worth looking at your weakest day for the easiest gain.",
        actTab: ch != null && ch <= -3 ? "low" : null,
        est: isP && !tracked(),
        ev: [["Period", `${dLong(dateAt(R.a))} \u2192 ${dLong(dateAt(R.b))}`],
             ["Days counted", nf(a.days)],
             ["Money received", inrF(a.rev)],
             ...(tracked() ? [["Cost of goods", inrF(a.cogs)]] : [["Margin applied", marginPct() + "% (declared)"]]),
             [tracked() ? "Bills" : "Payments", nf(a.tx)],
             ["Average sale", inrF(a.atv)],
             ...(pa ? [["Previous period", inrF(isP ? pa.profit : isC ? pa.tx : pa.rev)]] : [])],
      };
    }
    case "worstday": case "bestday": {
      const w = f.wd.slice().sort((a, b) => a.revenue - b.revenue);
      const x = p.intent === "worstday" ? w[0] : w[w.length - 1];
      const gap = Math.abs(x.revenue - f.wdMean);
      return { tag: "m", value: WDFULL[x.wd],
        sub: `${inrF(x.revenue)} on an average ${WDFULL[x.wd]}`,
        means: `${pc(x.vs_avg)} against your other days. Across a year that is ${inr(gap * 52)} ${p.intent === "worstday" ? "less than a normal day would bring" : "more than a normal day brings"}.`,
        act: p.intent === "worstday"
          ? `Recovering half the gap is worth ${inr(gap * 0.5 * 52)} a year. A standing ${WDFULL[x.wd]} offer is the cheapest way to test it.`
          : `Make sure you never run short of stock or help on a ${WDFULL[x.wd]}.`,
        actTab: "low",
        ev: f.wd.map(y => [WDFULL[y.wd], inrF(y.revenue) + "  (" + pc(y.vs_avg) + ")"]) };
    }
    case "weekday": {
      const x = f.wd[p.weekday];
      return { tag: "m", value: inrF(x.revenue), sub: `on an average ${WDFULL[x.wd]}`,
        means: `${pc(x.vs_avg)} against your other days. ${x.vs_avg < 0 ? "It is one of your weaker days." : "It is one of your stronger days."}`,
        act: x.vs_avg < -8 ? `The gap to a normal day is ${inrF(f.wdMean - x.revenue)} every week \u2014 ${inr((f.wdMean - x.revenue) * 52)} a year.` : null,
        actTab: x.vs_avg < -8 ? "low" : null,
        ev: f.wd.map(y => [WDFULL[y.wd], inrF(y.revenue)]) };
    }
    case "worstweek": case "bestmonth": case "worstmonth": {
      if (p.intent === "worstweek") {
        const w = f.wk.slice(-5, -1).slice().sort((a, b) => a.revenue - b.revenue)[0];
        const m = mean(f.wk.slice(-13, -1).map(x => x.revenue));
        const nTx = mean(f.wk.slice(-13, -1).map(x => x.bills));
        const dTx = (w.bills / nTx - 1) * 100;
        const dAtv = ((w.revenue / w.bills) / (m / nTx) - 1) * 100;
        const why = Math.abs(dTx) > Math.abs(dAtv) * 1.6 ? "fewer people came"
          : Math.abs(dAtv) > Math.abs(dTx) * 1.6 ? "the same people spent less" : "both fell together";
        return { tag: "m", value: inrF(w.revenue),
          sub: `week of ${dLong(new Date(w.w + "T00:00:00"))} \u2014 your weakest recent week`,
          means: `${pc((w.revenue / m - 1) * 100)} against your normal week. Taking it apart: ${why} (${pc(dTx, 0)} people, ${pc(dAtv, 0)} per basket).`,
          act: why.startsWith("fewer")
            ? "That is a footfall problem. Discounting your existing customers will not help \u2014 they already came."
            : "That is a basket problem. Usually it means you were out of stock on something people wanted.",
          actTab: "low",
          ev: f.wk.slice(-5, -1).map(x => ["Week of " + dShort(new Date(x.w + "T00:00:00")),
            inrF(x.revenue) + "  \u00b7  " + nf(x.bills) + " " + (tracked() ? "bills" : "payments")]) };
      }
      const ms = f.full.slice().sort((a, b) => a.revenue - b.revenue);
      const x = p.intent === "worstmonth" ? ms[0] : ms[ms.length - 1];
      const mn = mean(f.full.map(y => y.revenue));
      return { tag: "m", value: inrF(x.revenue), sub: ymFull(x.ym),
        means: `${pc((x.revenue / mn - 1) * 100)} against your average month of ${inrF(mn)}.`,
        act: null, ev: f.full.map(y => [ymFull(y.ym), inrF(y.revenue)]) };
    }
    case "peakhour": {
      const h = f.hr.slice().sort((a, b) => b.revenue - a.revenue);
      const t3 = h.slice(0, 3);
      return { tag: "m", value: h[0].h + ":00",
        sub: `${h[0].share.toFixed(1)}% of a day's money arrives in that hour`,
        means: `Your three busiest hours are ${t3.map(x => x.h + ":00").join(", ")}, carrying ${sum(t3.map(x => x.share)).toFixed(0)}% of everything between them.`,
        act: `Being out of stock or short of help at ${h[0].h}:00 costs more than at any other time of day.`,
        actTab: "trends",
        ev: h.slice(0, 6).map(x => [x.h + ":00 \u2013 " + (x.h + 1) + ":00",
          inrF(x.revenue) + "  (" + x.share.toFixed(1) + "%)"]) };
    }
    case "average": {
      const dl = f.dl.filter(x => x.revenue > 0);
      const ad = mean(dl.map(x => x.revenue));
      return { tag: "m", value: inrF(ad), sub: "on a normal day",
        means: `A normal week is ${inr(ad * 7)} and a normal month ${inr(ad * 30.4)}, from about ${nf(mean(dl.map(txOf)), 0)} ${tracked() ? "bills" : "payments"} a day of ${inrF(ad / mean(dl.map(txOf)))} each.`,
        act: `Anything under ${inrF(dl.map(x => x.revenue).sort((a, b) => a - b)[Math.floor(dl.length * .1)])} is genuinely a slow day for you. One below average means nothing \u2014 five in a row means something.`,
        actTab: "avg",
        ev: [["A normal day", inrF(ad)], ["A normal week", inrF(ad * 7)],
             ["A normal month", inrF(ad * 30.4)],
             ["Days counted", nf(dl.length)],
             ["A really good day", inrF(dl.map(x => x.revenue).sort((a, b) => b - a)[Math.floor(dl.length * .1)])],
             ["A slow day", inrF(dl.map(x => x.revenue).sort((a, b) => a - b)[Math.floor(dl.length * .1)])]] };
    }
    case "topproduct": case "deadproduct": {
      if (!tracked()) return lockedAnswer();
      const items = d.sku_list;
      if (p.time && p.time.kind === "month" && d.top_by_month[p.time.ym]) {
        const x = d.top_by_month[p.time.ym];
        return { tag: "m", value: x.name, sub: `${nf(x.qty)} units in ${ymFull(p.time.ym)}`,
          means: `It brought in ${inrF(x.revenue)} that month.`,
          act: null,
          ev: Object.entries(d.top_by_month).slice(-6).reverse()
            .map(([m, y]) => [ymFull(m), y.name + " \u00b7 " + nf(y.qty) + " units"]) };
      }
      if (p.intent === "deadproduct") {
        const dead = d.dead_stock || [];
        if (!dead.length) return { tag: "m", value: "Nothing", sub: "every item has sold recently",
          means: "No product has gone three weeks without a sale.", act: null, ev: [] };
        const x = dead[0];
        return { tag: "m", value: x.name, sub: `nothing sold for ${x.days_since_sale} days`,
          means: `${x.on_hand} units are sitting on the shelf, which is ${inrF(x.value)} of your money doing nothing. ${dead.length} items are in this state, worth ${inr(d.totals.dead_capital)} together.`,
          act: "Bundle it with something that sells fast, or clear it at a discount and put the cash into stock that moves.",
          actTab: "prod",
          ev: dead.slice(0, 6).map(y => [y.name, y.on_hand + " units \u00b7 " + y.days_since_sale + " days quiet \u00b7 " + inrF(y.value)]) };
      }
      const x = items[0], tm = d.timing[x.sku] || {};
      const byQty = items.slice().sort((a, b) => b.qty - a.qty)[0];
      return { tag: "m", value: x.name,
        sub: `${inr(x.revenue)} over the year \u00b7 ${nf(x.qty)} units`,
        means: `By units the busiest is ${byQty.name} at ${nf(byQty.qty)}. ${x.name} earns most because of its price, at a ${x.margin_pct.toFixed(1)}% margin.`,
        act: tm.peak_hour != null
          ? `It sells hardest around ${tm.peak_hour}:00 and on ${tm.peak_wd}. Keep it stocked before that, not after.`
          : null,
        actTab: "prod",
        ev: items.slice(0, 6).map(y => [y.name, inrF(y.revenue) + " \u00b7 " + nf(y.qty) + " units"]) };
    }
    case "producttime": {
      if (!tracked()) return lockedAnswer();
      const x = p.prod, tm = d.timing[x.sku] || {};
      return { tag: "m", value: (tm.peak_hour ?? "?") + ":00",
        sub: `when ${x.name} sells hardest`,
        means: `${tm.hour_share}% of it goes in that single hour. Its best day is ${tm.peak_wd} and its best month was ${ymFull(tm.peak_month)}.`,
        act: tm.hour_share >= 14
          ? `Being empty at ${tm.peak_hour}:00 does not delay the sale \u2014 it loses it. Restock before then.`
          : "It sells steadily through the day, so a short gap hurts less here.",
        actTab: "prod",
        ev: (d.timing_hours || []).map((h, i) => [h + ":00", nf(tm.hours[i]) + " units"])
          .filter((_, i) => tm.hours[i] > 0).slice(0, 8) };
    }
    case "productinfo": {
      if (!tracked()) return lockedAnswer();
      const x = p.prod, tm = d.timing[x.sku] || {};
      return { tag: "m", value: inr(x.revenue), sub: `${x.name} over the year`,
        means: `${nf(x.qty)} units at a ${x.margin_pct.toFixed(1)}% margin, which left you ${inr(x.gross_profit)}. It appeared in ${nf(x.bills)} bills.`,
        act: tm.peak_hour != null ? `Peaks at ${tm.peak_hour}:00, best on ${tm.peak_wd}.` : null,
        actTab: "prod",
        ev: [["Units sold", nf(x.qty)], ["Money", inrF(x.revenue)],
             ["Cost of goods", inrF(x.cogs)], ["Kept", inrF(x.gross_profit)],
             ["Margin", x.margin_pct.toFixed(1) + "%"], ["On the shelf now", nf(x.on_hand)]] };
    }
    case "credit": {
      const c = d.credit, cf = d.cashflow;
      const gap = Math.max(0, cf.peak_stock_need - Math.max(cf.net30, 0));
      return { tag: "m", value: inr(c.limit), sub: `pre-approved at ${c.rate}% for ${c.tenor_months} months`,
        means: `Your score is ${c.score} (${c.band}), worked out from ${nf(d.meta.days)} days of your own payments \u2014 no paperwork. EMI would be ${inrF(c.emi)}.`,
        act: gap > 0
          ? `You are projected to be short by about ${inr(gap)} around ${cf.peak_window_start}. That is when to take it, not after.`
          : "You are not projected to be short, so there is no reason to borrow right now.",
        actTab: "credit",
        ev: c.drivers.map(x => [x.f, x.v + (/^[% ]/.test(x.unit) ? x.unit : " " + x.unit)]) };
    }
    case "share": {
      const s = SHARE();
      return { tag: "s", value: s.share_pct + "%", sub: "of what your own regulars spend nearby",
        means: `They spend about ${inr(s.wallet)} a month on what you sell. ${inr(s.from_known)} comes to you. Your share has moved ${s.share_change} points over the year.`,
        act: `${s.switchers.count} of them moved part of their basket to quick commerce \u2014 that alone is ${inr(s.switchers.annual_loss)} a year.`,
        actTab: "share", est: true,
        ev: s.leakage.map(l => [l.where, inrF(l.amount) + " a month  (" + pc(l.trend, 0) + ")"]) };
    }
    case "customers": {
      const c = d.customers;
      return { tag: "m", value: nf(c.total), sub: "customers Tracker can recognise",
        means: `${c.attributed_share}% of your sales come from a payer it has seen before. The top 20% of them bring ${c.pareto}% of that money. ${c.winback.length} regulars have gone quiet.`,
        act: c.winback.length ? `Those ${c.winback.length} are worth about ${inr(c.at_risk)} over three months. A small cashback is the cheapest way to test whether they come back.` : null,
        actTab: "share",
        ev: c.segments.map(s => [s.segment, nf(s.customers) + " people \u00b7 " + inrF(s.revenue)]) };
    }
    case "compare": {
      const a = agg(rng({ kind: "thismonth" })), b = agg(rng({ kind: "lastmonth" }));
      return { tag: "m", value: pc((a.rev / b.rev - 1) * 100),
        sub: "this month so far against last month",
        means: `${inrF(a.rev)} over ${a.days} days against ${inrF(b.rev)} over ${b.days}. Per day that is ${inrF(a.rev / a.days)} against ${inrF(b.rev / b.days)}.`,
        act: a.rev / a.days >= b.rev / b.days ? "Running ahead on a per-day basis." : "Running behind on a per-day basis \u2014 worth checking your weakest day.",
        actTab: "low",
        ev: [["This month so far", inrF(a.rev) + " over " + a.days + " days"],
             ["Last month", inrF(b.rev) + " over " + b.days + " days"],
             ["Per day now", inrF(a.rev / a.days)], ["Per day then", inrF(b.rev / b.days)]] };
    }
  }
  return null;
}
function lockedAnswer() {
  return { tag: "g", value: "I cannot tell you that", sub: "this shop does not record what it sells",
    means: "A payment only says how much arrived, never what was in the bag. There is no item data to look at.",
    act: "Start recording bills and this becomes answerable, along with profit per item and reorder alerts.",
    actTab: null, locked: true, ev: [] };
}

/* ---------------------------- rendering --------------------------- */
const SUGS = {
  billing: ["How much did I earn last month?", "Which day is my worst?",
    "What sells most and when?", "Why was last week bad?",
    "When does Amul Taaza Milk sell most?", "How much loan can I get?",
    "What is my share of my customers?", "What is not selling?"],
  nonbilling: ["How much did I earn last month?", "Which day is my worst?",
    "What is my busiest hour?", "Why was last week bad?",
    "What is a normal day for me?", "How much loan can I get?",
    "What is my share of my customers?", "What sells most?"],
};
function vTracker() {
  const sg = SUGS[S.who];
  return `<div class="tk">
    <div class="chat">
      <div class="feed" id="feed"></div>
      <div class="bar">
        <button class="snd ${S.speak ? "on" : ""}" id="sndBtn" onclick="toggleSpeak()"
          title="Speak answers aloud">${ic(S.speak ? "vol" : "mute", 19)}</button>
        <input id="qbox" placeholder="${t("placeholder")}"
          onkeydown="if(event.key==='Enter')ask(this.value)">
        <button class="mic" id="micBtn" onclick="micToggle()" title="Speak your question">
          ${ic("mic", 19)}</button>
        <button class="mic" onclick="ask(document.getElementById('qbox').value)"
          style="background:var(--navy)">${ic("send", 18)}</button>
      </div>
    </div>
    <div>
      <div class="mb">${svPanel()}</div>
      <div class="card mb"><div class="ch"><div class="ct2">${t("ask")}
        <div class="cs">Tap one, or type in your own words.</div></div></div>
        <div class="cb"><div class="sug">${sg.map(s =>
          `<button class="sg" onclick="ask('${esc(s).replace(/'/g, "\\'")}')">${esc(s)}</button>`).join("")}</div>
        </div></div>
      <div class="card"><div class="cb">
        <div style="font-weight:640;font-size:13px;margin-bottom:7px">Why it cannot lie to you</div>
        <div style="color:var(--ink-2);font-size:12.5px;line-height:1.6">
          ${SV.on
            ? `The question retrieves the handful of facts that bear on it, the arithmetic is done in
               code, and <b>${esc(SV.chat)}</b> is handed both and asked only to write the sentence.
               It never sees the raw data and is never asked what a number is.`
            : `Tracker works out every figure in code, straight from your records, then fills a
               sentence. It can tell you it did not understand. It cannot make up a number.`}</div>
        <div class="hr"></div>
        <div style="display:flex;gap:7px;flex-wrap:wrap">${TAG.m()} ${TAG.g()} ${TAG.s()}</div>
        <div class="s2" style="margin-top:7px">Every answer carries one of these.</div>
      </div></div>
    </div>
  </div>`;
}
function trackerMount() {
  const f = document.getElementById("feed");
  if (!S.chat.length) {
    S.chat.push({ me: false, greet: true });
  }
  renderFeed();
  setTimeout(() => { const b = document.getElementById("qbox"); if (b) b.focus(); }, 80);
}
function renderFeed() {
  const f = document.getElementById("feed");
  if (!f) return;
  f.innerHTML = S.chat.map(m => {
    if (m.greet) {
      const d = D();
      return `<div class="msg"><div class="ma"><div class="ans-s" style="border:0">
        <div class="ans-t">Namaste. I am looking at <b>${esc(d.merchant.name)}</b> \u2014
        ${nf(d.meta.days)} days of records, up to ${dLong(new Date(d.meta.asof + "T00:00:00"))}.
        Ask me anything about it.${tracked() ? "" : " This shop does not record what it sells, so I cannot answer product questions \u2014 I will say so rather than guess."}</div>
      </div></div></div>`;
    }
    if (m.sys) return `<div class="msg" style="max-width:100%"><div class="note g">
      ${ic("check", 15)}<div>${esc(m.sys)}</div></div></div>`;
    if (m.me) return `<div class="msg u"><div class="mu">${m.spoken ? ic("mic", 13) + " " : ""}${esc(m.text)}</div></div>`;
    if (m.typing) return `<div class="msg"><div class="ma"><div class="typing"><i></i><i></i><i></i></div></div></div>`;
    if (!m.a) return `<div class="msg"><div class="ma"><div class="ans-s" style="border:0">
      <div class="ans-t">${m.err ? `<b>Something went wrong.</b> ${esc(m.err)}`
        : `<b>${t("notsure")}.</b> Try something like
      \u201chow much did I earn last month\u201d, \u201cwhich day is my worst\u201d or
      \u201cwhat sells most\u201d.${SV.on ? "" : " Connect Sarvam to ask in your own words."}`}
      </div></div></div></div>`;
    const a = m.a;
    return `<div class="msg"><div class="ma">
      <div class="ans-n">
        <div style="display:flex;align-items:flex-start;gap:9px">
          <div style="flex:1;min-width:0">
            <div class="ans-v" style="${a.locked ? "font-size:17px;" : ""}">${esc(a.value)}</div>
            <div class="ans-sub">${esc(a.sub)}</div></div>
          ${TAG[a.tag]()}</div>
      </div>
      <div class="ans-s"><div class="ans-l">${t("means")}</div>
        <div class="ans-t">${esc(a.means)}</div></div>
      ${a.act ? `<div class="ans-act"><div class="ans-l">${ic("star", 11)} ${t("doit")}</div>
        <div class="ans-t">${esc(a.act)}</div>
        ${a.actTab ? `<button class="aa b" style="margin-top:9px;font-size:12px;padding:6px 12px"
          onclick="go('${a.actTab}')">Open ${esc(t(a.actTab))}</button>` : ""}</div>` : ""}
      ${a.live ? `<div class="ev" style="display:flex;gap:7px;flex-wrap:wrap;align-items:center">
        <span class="tg tg-s" style="background:#E7F7F1;color:#0C7E56">${esc(SV.chat)}</span>
        <span class="s2">wrote this from ${a.used.length} retrieved facts${
          a.verified ? " and one verified computation" : ""}</span></div>` : ""}
      ${a.degraded ? `<div class="ev"><span class="s2" style="color:#A1640D">
        Model unreachable (${esc(a.degraded.slice(0, 70))}) \u2014 answered offline instead.</span></div>` : ""}
      ${a.ev && a.ev.length ? `<details class="ev"><summary>${t("evidence")}</summary>
        <table><tbody>${a.ev.map(([k, v]) => `<tr><td style="color:var(--mut)">${esc(k)}</td>
          <td class="r num" style="font-weight:600">${esc(String(v))}</td></tr>`).join("")}</tbody></table>
        </details>` : ""}
    </div></div>`;
  }).join("");
  f.scrollTop = f.scrollHeight;
}
function ask(q) {
  q = (q || "").trim();
  if (!q) return;
  const box = document.getElementById("qbox"); if (box) box.value = "";
  S.chat.push({ me: true, text: q });
  askNow(q);
}
window.ask = ask;

/* Arithmetic in code, language from the model. If the model is not
   reachable, the code answer is shown on its own. */
async function askNow(q, srcLang) {
  S.chat.push({ typing: true });
  renderFeed();
  let a = null;
  if (SV.on) {
    try {
      a = await svAsk(q);
      SV.lastErr = null;
    } catch (e) {
      SV.lastErr = e.message;
      a = answer(parse(q));
      if (a) a.degraded = e.message;
    }
  } else {
    await new Promise(r => setTimeout(r, 360));
    a = answer(parse(q));
  }
  S.chat.pop();
  S.chat.push({ a });
  renderFeed();
  if (a && S.speak) {
    if (SV.on) {
      svSpeak(a, srcLang).catch(() => speak(a));
    } else speak(a);
  }
}
window.askNow = askNow;

/* ------------------------------ voice ----------------------------- */
function speak(a) {
  try {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const txt = `${a.value}. ${a.sub}. ${a.means}${a.act ? " " + a.act : ""}`;
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = VOICE[S.lang] || "en-IN";
    u.rate = 0.98;
    const v = speechSynthesis.getVoices().find(x => x.lang === u.lang);
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { /* speaking is a bonus, never a requirement */ }
}
function toggleSpeak() {
  S.speak = !S.speak;
  if (!S.speak && window.speechSynthesis) speechSynthesis.cancel();
  const b = document.getElementById("sndBtn");
  b.className = "snd" + (S.speak ? " on" : "");
  b.innerHTML = ic(S.speak ? "vol" : "mute", 19);
}
window.toggleSpeak = toggleSpeak;

let REC = null, RECING = false;
function micToggle() {
  if (SV.on) return svListen();
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = document.getElementById("micBtn");
  if (!SR) return micBlocked("This browser has no speech recognition.");
  if (RECING) { try { REC.stop(); } catch (e) {} return; }
  try {
    REC = new SR();
    REC.lang = VOICE[S.lang] || "en-IN";
    REC.interimResults = false;
    REC.maxAlternatives = 1;
    REC.onstart = () => { RECING = true; btn.classList.add("rec"); };
    REC.onend = () => { RECING = false; btn.classList.remove("rec"); };
    REC.onerror = e => {
      RECING = false; btn.classList.remove("rec");
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        micBlocked("The microphone is blocked here.");
    };
    REC.onresult = e => ask(e.results[0][0].transcript);
    REC.start();
  } catch (e) { micBlocked("The microphone could not start."); }
}
function micBlocked(why) {
  say("Speaking your question", `<p>${esc(why)}</p>
    <p>A published page runs inside a sandbox that <b>blocks microphone access</b>, so voice input
    cannot work here. Open the same file directly in a browser and it does.</p>
    <p>Everything else works: <b>type your question</b> and Tracker will still read the answer out
    loud in ${esc({ en: "English", hi: "Hindi", te: "Telugu", ta: "Tamil" }[S.lang])}.</p>`);
}
window.micToggle = micToggle;

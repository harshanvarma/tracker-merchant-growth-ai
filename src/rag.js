/* ==================================================================
   Tracker — retrieval layer.

   Every computed figure is written out as a short, self-describing
   fact. A question retrieves the handful of facts that bear on it, and
   only those go to the model. The model never sees the whole dataset
   and is never asked to do arithmetic.
   ================================================================== */

let KB = null, KB_FOR = null;

function buildKB() {
  const d = D(), s = SHARE(), f = F(), kb = [];
  const add = (id, topic, text, keys) =>
    kb.push({ id, topic, text, keys: (keys || "").toLowerCase() });

  /* --- the shop itself --- */
  add("shop", "shop",
    `${d.merchant.name} is a ${S.setup.sub || d.merchant.category} in ${d.merchant.city}, trading since ${d.merchant.since}. `
    + `${tracked() ? "It records every bill, so item-level data is available." : "It takes payments by QR only and does not record what it sells, so there is no item-level data at all."} `
    + `Tracker has ${nf(d.meta.days)} days of records, from ${dLong(new Date(d.meta.day0 + "T00:00:00"))} to ${dLong(new Date(d.meta.asof + "T00:00:00"))}.`,
    "shop business about store name city");

  add("totals", "totals",
    `Over the whole ${nf(d.meta.days)} days the shop received ${inrF(d.totals.revenue)} across ${nf(d.totals.bills || d.totals.txns)} ${tracked() ? "bills" : "payments"}. `
    + (tracked()
      ? `Goods cost ${inrF(d.totals.cogs)}, leaving ${inrF(d.totals.gross_profit)} kept, a margin of ${d.totals.margin_pct}%. It stocks ${nf(d.merchant.skus)} different products.`
      : `At the declared margin of ${d.totals.declared_margin}% that is about ${inrF(d.totals.est_gross)} kept, which is an estimate and not measured.`),
    "total overall year revenue sales profit margin everything");

  /* --- period figures --- */
  const periods = [
    ["today", rng({ kind: "today" })], ["yesterday", rng({ kind: "yesterday" })],
    ["the last 7 days", rng({ kind: "last7" })], ["the last 30 days", rng({ kind: "last30" })],
    ["this week so far", rng({ kind: "thisweek" })], ["last week", rng({ kind: "lastweek" })],
    ["this month so far", rng({ kind: "thismonth" })], ["last month", rng({ kind: "lastmonth" })],
  ];
  periods.forEach(([name, r], i) => {
    const a = agg(r);
    add("period" + i, "earnings",
      `In ${name} (${dLong(dateAt(r.a))} to ${dLong(dateAt(r.b))}, ${a.days} days) the shop received ${inrF(a.rev)} `
      + `from ${nf(a.tx)} ${tracked() ? "bills" : "payments"}, averaging ${inrF(a.atv)} per sale and ${inrF(a.rev / a.days)} per day. `
      + `${tracked() ? `Goods cost ${inrF(a.cogs)}, so ${inrF(a.profit)} was kept.` : `At the declared margin about ${inrF(a.profit)} was kept, estimated.`}`,
      `${name} earn earned earnings revenue sales income profit kamaya kitna`);
  });

  /* --- every month --- */
  d.monthly.forEach((m, i) => {
    add("month" + i, "earnings",
      `In ${ymFull(m.ym)} the shop received ${inrF(m.revenue)} over ${m.days} trading days from `
      + `${nf(m.bills || m.txns)} ${tracked() ? "bills" : "payments"}`
      + (tracked() ? `, goods cost ${inrF(m.cogs)} and ${inrF(m.gross_profit)} was kept.` : `.`)
      + (m.days < 25 ? " That month is incomplete." : ""),
      `${ymFull(m.ym).toLowerCase()} ${MONTHFULL_L(m.ym)} month earnings revenue`);
  });

  /* --- weeks --- */
  (d.weekly || []).slice(-14).forEach((w, i) => {
    add("week" + i, "earnings",
      `The week starting ${dLong(new Date(w.w + "T00:00:00"))} brought ${inrF(w.revenue)} from ${nf(w.bills)} `
      + `${tracked() ? "bills" : "payments"}, averaging ${inrF(w.revenue / w.bills)} per sale.`,
      "week weekly hafta earnings");
  });

  /* --- weekdays --- */
  f.wd.forEach(w => {
    add("wd" + w.wd, "weekday",
      `On an average ${WDFULL[w.wd]} the shop takes ${inrF(w.revenue)}, which is ${pc(w.vs_avg)} against its other days. `
      + (w.vs_avg < -5 ? `That gap costs about ${inrF(f.wdMean - w.revenue)} every week, or ${inr((f.wdMean - w.revenue) * 52)} a year.` : "")
      + (w.wd === f.worst.wd ? " This is the weakest day of the week." : "")
      + (w.wd === f.best.wd ? " This is the strongest day of the week." : ""),
      `${WDFULL[w.wd].toLowerCase()} ${WDN[w.wd].toLowerCase()} day weekday worst best weakest strongest din`);
  });
  add("wdsum", "weekday",
    `Across the week the best day is ${WDFULL[f.best.wd]} at ${inrF(f.best.revenue)} and the worst is `
    + `${WDFULL[f.worst.wd]} at ${inrF(f.worst.revenue)}. A normal day is ${inrF(f.wdMean)}. `
    + `The gap between best and worst is ${inrF(f.best.revenue - f.worst.revenue)} a week, ${inr((f.best.revenue - f.worst.revenue) * 52)} a year.`,
    "worst day best day weakest lowest highest which day kaunsa din");

  /* --- hours --- */
  const hs = f.hr.slice().sort((a, b) => b.revenue - a.revenue);
  add("hours", "hour",
    `The busiest hour is ${hs[0].h}:00, carrying ${hs[0].share.toFixed(1)}% of a day's money. `
    + `The three busiest hours are ${hs.slice(0, 3).map(x => x.h + ":00").join(", ")}, together ${sum(hs.slice(0, 3).map(x => x.share)).toFixed(0)}%. `
    + `The quietest is ${hs[hs.length - 1].h}:00 at ${hs[hs.length - 1].share.toFixed(1)}%.`,
    "hour time busiest peak rush when what time kab samay");
  d.hourly.forEach(h => add("hr" + h.h, "hour",
    `Between ${h.h}:00 and ${h.h + 1}:00 the shop takes ${inrF(h.revenue)} over the whole period, `
    + `${h.share.toFixed(1)}% of all its money.`, `${h.h} hour time oclock`));

  /* --- averages --- */
  const open = f.dl.filter(x => x.revenue > 0);
  const srt = open.map(x => x.revenue).sort((a, b) => a - b);
  add("avg", "average",
    `A normal day is ${inrF(mean(open.map(x => x.revenue)))}, a normal week ${inrF(mean(open.map(x => x.revenue)) * 7)} `
    + `and a normal month ${inrF(mean(open.map(x => x.revenue)) * 30.4)}. A normal sale is ${inrF(f.atv30)}. `
    + `A really good day is above ${inrF(srt[Math.floor(srt.length * .9)])} and a genuinely slow day is below ${inrF(srt[Math.floor(srt.length * .1)])}.`,
    "average normal typical usual ausat mean");

  /* --- growth --- */
  add("growth", "growth",
    `Over the last 30 days the shop took ${inrF(f.r30)}, which is ${pc(f.g30)} against the 30 days before. `
    + `${tracked() ? "Bills" : "Payments"} moved ${pc(f.tg30)} and the average sale moved ${pc((f.atv30 / f.atv30p - 1) * 100)}. `
    + `${Math.abs(f.tg30) > Math.abs((f.atv30 / f.atv30p - 1) * 100) * 1.5
      ? "So the change is driven by how many people came, not by how much each spent."
      : "So the change is driven by how much each person spent, not by how many came."}`,
    "growth growing shrinking trend better worse improving falling");

  /* --- the decomposition of the worst recent week --- */
  const wks = (d.weekly || []).slice(-13, -1);
  if (wks.length) {
    const worstW = wks.slice(-4).slice().sort((a, b) => a.revenue - b.revenue)[0];
    const nTx = mean(wks.map(x => x.bills)), nRev = mean(wks.map(x => x.revenue));
    const dTx = (worstW.bills / nTx - 1) * 100;
    const dAtv = ((worstW.revenue / worstW.bills) / (nRev / nTx) - 1) * 100;
    add("worstweek", "diagnosis",
      `The weakest recent week started ${dLong(new Date(worstW.w + "T00:00:00"))} with ${inrF(worstW.revenue)}, `
      + `${pc((worstW.revenue / nRev - 1) * 100)} against a normal week. Breaking it apart: the number of customers moved `
      + `${pc(dTx)} and the spend per customer moved ${pc(dAtv)}. `
      + (Math.abs(dTx) > Math.abs(dAtv) * 1.6
        ? "So this was a footfall problem: fewer people walked in, while baskets held up. Offering a discount to existing customers will not fix that, because they already came."
        : Math.abs(dAtv) > Math.abs(dTx) * 1.6
        ? "So this was a basket problem: roughly the usual number of people came but each spent less, which usually means something they wanted was out of stock."
        : "Both fell together, so footfall should be dealt with first as it is the larger and easier of the two."),
      "why bad week drop fell down decline weak reason problem footfall basket");
  }

  /* --- anomalies --- */
  (d.anomalies || []).slice(0, 8).forEach((a, i) => add("anom" + i, "anomaly",
    `On ${dLong(new Date(a.d + "T00:00:00"))} the shop took ${inrF(a.actual)} when ${inrF(a.expected)} was expected, `
    + `a ${a.kind} of ${pc((a.actual / a.expected - 1) * 100, 0)}. `
    + (a.festival ? `This is explained by ${a.festival}.` : "There is no known explanation for this one."),
    `${a.d} unusual spike dip strange odd anomaly ${a.festival || ""}`));

  /* --- products --- */
  if (tracked()) {
    const items = d.sku_list, tm = d.timing || {};
    add("prodsum", "product",
      `By money the top sellers are ${items.slice(0, 5).map(p => `${p.name} (${inrF(p.revenue)})`).join(", ")}. `
      + `By units the busiest is ${items.slice().sort((a, b) => b.qty - a.qty)[0].name}. `
      + `The top ten items together make ${items.slice(0, 10).reduce((a, p) => a + p.profit_share, 0).toFixed(0)}% of all the profit.`,
      "product item sells most best selling top what sells saman bika");
    items.slice(0, 45).forEach((p, i) => {
      const t2 = tm[p.sku] || {};
      add("sku:" + p.sku, "product",
        `${p.name} (${p.cat}) sold ${nf(p.qty)} units for ${inrF(p.revenue)}, cost ${inrF(p.cogs)}, kept ${inrF(p.gross_profit)} `
        + `at a ${p.margin_pct.toFixed(1)}% margin. It appeared in ${nf(p.bills)} bills and ${nf(p.on_hand)} units are on the shelf now. `
        + (t2.peak_hour != null
          ? `It sells hardest at ${t2.peak_hour}:00 (${t2.hour_share}% of it goes in that hour), its best day is ${t2.peak_wd} and its best month was ${ymFull(t2.peak_month)}.`
          : ""),
        `${p.name.toLowerCase()} ${p.cat.toLowerCase()} product item when sells peak hour`);
    });
    (d.top_by_month ? Object.entries(d.top_by_month) : []).forEach(([m, x], i) =>
      add("tbm" + i, "product",
        `In ${ymFull(m)} the single most sold item by units was ${x.name}, ${nf(x.qty)} units worth ${inrF(x.revenue)}.`,
        `${ymFull(m).toLowerCase()} most sold top product month`));
    if ((d.dead_stock || []).length) add("dead", "product",
      `${d.dead_stock.length} items have not sold for three weeks or more, holding ${inrF(d.totals.dead_capital)} of stock. `
      + `The worst are ${d.dead_stock.slice(0, 4).map(x => `${x.name} (${x.on_hand} units, ${x.days_since_sale} days quiet, ${inrF(x.value)})`).join("; ")}.`,
      "dead stock not selling slow nothing moving stuck unsold");
    if ((d.stockout || []).length) add("stockout", "product",
      `${d.stockout.length} items will run out within two days. The most urgent are `
      + `${d.stockout.slice(0, 4).map(x => `${x.name} (${x.on_hand} left, ${nf(x.d7, 0)} forecast this week, supplier takes ${x.lead} day${x.lead === 1 ? "" : "s"})`).join("; ")}.`,
      "stock out running low reorder order finish khatam");
  } else {
    add("noitem", "product",
      `This shop does not record what it sells. A payment only says how much money arrived, never which items were bought. `
      + `So there is no answer to any question about products, margins per item, stock or reordering, and Tracker must say so rather than guess.`,
      "product item sells most stock margin reorder what sells");
  }

  /* --- customers --- */
  const c = d.customers;
  add("cust", "customer",
    `Tracker recognises ${nf(c.total)} repeat customers, covering ${c.attributed_share}% of sales. `
    + `The top fifth of them bring ${c.pareto}% of that money. By segment: `
    + `${c.segments.filter(x => x.customers).map(x => `${x.customers} ${x.segment}`).join(", ")}. `
    + `${c.winback.length} regulars have gone quiet and are worth about ${inrF(c.at_risk)} over three months.`,
    "customer regular grahak people repeat loyal lapsed quiet stopped coming");

  /* --- credit --- */
  const cr = d.credit, cf = d.cashflow;
  add("credit", "credit",
    `The shop is pre-approved for ${inrF(cr.limit)} at ${cr.rate}% over ${cr.tenor_months} months, EMI ${inrF(cr.emi)}. `
    + `Its score is ${cr.score} out of 900, band ${cr.band}, with an applied default risk of ${cr.pd}% `
    + `(the model said ${cr.pd_model}% and a ${cr.floor}% floor is applied for risk payments cannot see). `
    + `No paperwork is needed because it is underwritten from the payment history itself.`,
    "loan credit borrow money score karz udhaar finance emi");
  add("cash", "credit",
    `Over the next 30 days collections are forecast at ${inrF(cf.inflow30)}. Restocking will take ${inrF(cf.restock30)} and `
    + `fixed costs ${inrF(cf.fixed30)}, leaving ${inrF(cf.net30)}. The heaviest stocking window is `
    + `${cf.peak_window_start} to ${cf.peak_window_end}, needing about ${inrF(cf.peak_stock_need)}`
    + (cf.peak_stock_need > Math.max(cf.net30, 0)
      ? `, so the shop will be short by roughly ${inrF(cf.peak_stock_need - Math.max(cf.net30, 0))} and that is when to borrow.`
      : `, which the projected cash covers.`),
    "cash flow money next month shortfall short need stock buy");

  /* --- share (simulated) --- */
  if (s) {
    add("share", "share",
      `SIMULATED FIGURE. The shop's ${nf(s.customers)} regulars spend about ${inrF(s.wallet)} a month on this category nearby. `
      + `${inrF(s.from_known)} of that comes to this shop, a share of ${s.share_pct}%, which has moved ${s.share_change} points over the year. `
      + `The other ${inrF(s.rest)} a month goes to: ${s.leakage.map(l => `${l.where} ${inrF(l.amount)} (${pc(l.trend, 0)} this year)`).join("; ")}.`,
      "share wallet competitor elsewhere losing leak blinkit zepto quick commerce other shops hissa");
    add("switch", "share",
      `SIMULATED FIGURE. ${s.switchers.count} regulars moved part of their basket to quick commerce. `
      + `${s.switchers.still_visiting} of them still visit, but the basket fell from ${inrF(s.switchers.basket_before)} to ${inrF(s.switchers.basket_after)}, `
      + `costing ${inrF(s.switchers.monthly_loss)} a month or ${inrF(s.switchers.annual_loss)} a year. `
      + `What moved: ${s.switchers.moved.map(([k, v]) => `${k} ${v}%`).join(", ")}. They kept buying fresh and last-minute items here and moved the planned, packaged part.`,
      "quick commerce blinkit zepto instamart switching losing customers basket smaller");
    add("catch", "share",
      `SIMULATED FIGURE. Within walking distance there are Paytm users the shop has never served: `
      + `${s.catchment.map(x => `${x.band}: ${nf(x.users)} users, ${x.reach}% reached`).join("; ")}. `
      + `A cluster of about ${nf(s.cluster.users)} people ${s.cluster.dist} ${s.cluster.direction} walks past to reach the market, `
      + `spending about ${inrF(s.cluster.spend)} a month each.`,
      "nearby area catchment new customers never visited reach neighbourhood");
    add("adj", "share",
      `SIMULATED FIGURE. The shop's own customers spend money nearby on things it does not stock: `
      + `${s.adjacent.map(a => `${a.cat} ${inrF(a.monthly)} a month (${a.note})`).join("; ")}. `
      + `The gaps worth filling total about ${inrF(s.adjacent_total)} a month.`,
      "what else stock new products expand opportunity categories not selling");
  }

  /* --- expenses --- */
  add("exp", "costs",
    `Fixed costs are ${inrF(d.fixed_monthly)} a month: `
    + Object.entries(d.expenses).map(([k, v]) => `${k.replace(/_/g, " ")} ${inrF(v)}`).join(", ")
    + `. Break-even needs about ${inrF(d.fixed_monthly / (marginPct() / 100) / 30)} of sales a day.`,
    "cost expense rent staff salary electricity fixed kharcha break even");

  return kb;
}
function MONTHFULL_L(ym) { return MONFULL[+ym.split("-")[1] - 1].toLowerCase(); }

function kb() {
  const key = S.who;
  if (!KB || KB_FOR !== key) { KB = buildKB(); KB_FOR = key; }
  return KB;
}

/* ------------------------- BM25 retrieval ------------------------- */
const STOP = new Set(("a an the is are was were be been of to in on for my me i you your it this that and or "
  + "how much many what which when where why do does did can could should shall will would tell show give "
  + "mujhe mera meri ka ki ke ko se hai hain kya").split(" "));
const tok = s => (s || "").toLowerCase().replace(/[^\p{L}\p{N}\s:]/gu, " ")
  .split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));

let IDF = null, IDF_FOR = null;
function idf() {
  if (IDF && IDF_FOR === S.who) return IDF;
  const docs = kb(), df = new Map();
  docs.forEach(d2 => {
    new Set(tok(d2.text + " " + d2.keys)).forEach(w => df.set(w, (df.get(w) || 0) + 1));
  });
  const N = docs.length, m = new Map();
  df.forEach((v, w) => m.set(w, Math.log(1 + (N - v + 0.5) / (v + 0.5))));
  IDF = m; IDF_FOR = S.who;
  return m;
}
function retrieve(q, k = 8) {
  const docs = kb(), I = idf(), qt = tok(q);
  if (!qt.length) return docs.slice(0, k);

  // If the question names a specific product, lexical scoring alone buries its
  // own fact under every other chunk that happens to mention it. The parser
  // already identifies the item, so pin that fact to the front.
  let pinned = [];
  try {
    const named = parse(q).prod;
    if (named) {
      const own = docs.find(d2 => d2.id === "sku:" + named.sku);
      if (own) pinned = [own];
    }
  } catch (e) {}
  const avg = mean(docs.map(d2 => tok(d2.text).length)) || 1;
  const k1 = 1.4, b = 0.72;
  const scored = docs.map(d2 => {
    const dt = tok(d2.text + " " + d2.keys), len = dt.length;
    const tf = new Map();
    dt.forEach(w => tf.set(w, (tf.get(w) || 0) + 1));
    let s = 0;
    qt.forEach(w => {
      const t2 = tf.get(w) || 0;
      if (!t2) return;
      s += (I.get(w) || 0.2) * (t2 * (k1 + 1)) / (t2 + k1 * (1 - b + b * len / avg));
      if ((d2.keys || "").includes(w)) s += 1.1;     // a keyword hit is a strong signal
    });
    return { d: d2, s };
  }).filter(x => x.s > 0).sort((a, b2) => b2.s - a.s);
  const rest = scored.map(x => x.d).filter(d2 => !pinned.includes(d2));
  return pinned.concat(rest).slice(0, k);
}
window.retrieve = retrieve;

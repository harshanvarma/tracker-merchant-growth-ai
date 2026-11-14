/* ==================================================================
   Tracker — shell and all screens except Tracker itself
   ================================================================== */
const TABS = [
  ["today", "today", "home"], ["txn", "txn", "list"], ["trends", "trends", "trend"],
  ["low", "low", "down"], ["avg", "avg", "avg"], ["prod", "prod", "box"],
  ["share", "share", "pie"], ["credit", "credit", "cash"], ["tracker", "tracker", "chat"],
];
const SUBT = {
  today: "What changed, what it costs you, and what to do",
  txn: "Money received, by day, week or month",
  trends: "How the shop moves — and against what",
  low: "Not just which day was worst, but why",
  avg: "Your normal, so you can spot the abnormal",
  prod: "What sells, and exactly when it sells",
  share: "What your customers do when they are not in your shop",
  credit: "What you can borrow, and when you will need it",
  tracker: "Ask in your own words",
  about: "What is real here and what is modelled",
};

function shell() {
  const d = D(), m = d.merchant;
  document.getElementById("mName").textContent = m.name;
  document.getElementById("mMeta").textContent =
    `${S.setup.sub || m.category} · ${m.city}`;
  const tag = document.getElementById("mTag");
  tag.textContent = tracked() ? "BILLING TRACKED" : "NOT TRACKED";
  tag.className = "tagb" + (tracked() ? " on" : "");
  document.getElementById("tabs").innerHTML = TABS.map(([k, key, icon]) => {
    const lock = !tracked() && k === "prod";
    const b = k === "today" ? opps().filter(o => o.sev === "hi").length : 0;
    return `<button class="tab ${S.tab === k ? "on" : ""} ${lock ? "lk" : ""}"
      onclick="go('${k}')">${ic(lock ? "lock" : icon, 15)}<span>${t(key)}</span>
      ${b ? `<span class="bdg">${b}</span>` : ""}</button>`;
  }).join("");
}
function go(k) {
  if (!tracked() && k === "prod") k = "prodlock";
  S.tab = k === "prodlock" ? "prod" : k;
  const view = document.getElementById("view");
  view.innerHTML = ({ today: vToday, txn: vTxn, trends: vTrends, low: vLow, avg: vAvg,
    prod: k === "prodlock" ? vProdLock : vProd, share: vShare, credit: vCredit,
    tracker: vTracker, about: vAbout }[k] || vToday)();
  shell();
  if (k === "tracker") trackerMount();
  scrollTo(0, 0);
}
window.go = go;
function switchMerchant() {
  S.who = S.who === "billing" ? "nonbilling" : "billing";
  S.setup.sub = S.who === "billing" ? "General store" : "Tea stall";
  S.setup.cat = S.who === "billing" ? "kirana" : "street";
  S.chat = [];
  go(S.tab === "prod" && S.who === "nonbilling" ? "today" : S.tab);
}
window.switchMerchant = switchMerchant;
function setLang(v) { S.lang = v; go(S.tab); }
window.setLang = setLang;

/* ===================== shared figures ===================== */
function F() {
  const d = D(), dl = daily(), n = dl.length;
  const last = dl[n - 1], prev = dl[n - 2];
  const r30 = sum(dl.slice(-30).map(x => x.revenue));
  const r30p = sum(dl.slice(-60, -30).map(x => x.revenue));
  const t30 = sum(dl.slice(-30).map(txOf)), t30p = sum(dl.slice(-60, -30).map(txOf));
  const mg = marginPct() / 100;
  const wd = d.weekday, wdMean = mean(wd.map(x => x.revenue));
  const worst = wd.slice().sort((a, b) => a.revenue - b.revenue)[0];
  const best = wd.slice().sort((a, b) => b.revenue - a.revenue)[0];
  const hr = d.hourly.slice().sort((a, b) => b.revenue - a.revenue);
  const wk = d.weekly || [];
  const full = d.monthly.filter(m => (m.days || 30) >= 25);
  return { d, dl, n, last, prev, r30, r30p,
    g30: r30p ? (r30 / r30p - 1) * 100 : 0, t30, t30p,
    tg30: t30p ? (t30 / t30p - 1) * 100 : 0,
    atv30: t30 ? r30 / t30 : 0, atv30p: t30p ? r30p / t30p : 0,
    mg, gp30: r30 * mg, fixed: d.fixed_monthly, net30: r30 * mg - d.fixed_monthly,
    wd, wdMean, worst, best, hr, wk, full,
    dayAvg: r30 / 30 };
}

/* ============ opportunities, ranked by rupees at stake ============
   A loss is money leaving now. An upside is money that was never yours.
   They are never added together, because that would flatter the number. */
function opps() {
  const f = F(), d = f.d, sh = SHARE(), out = [];
  const push = o => out.push(o);

  // --- losses -------------------------------------------------------
  const gap = f.wdMean - f.worst.revenue;
  push({ kind: "loss", worth: gap * 0.5 * 52, annual: gap * 0.5 * 52, per: "a year", sev: "md", icon: "down",
    title: `${WDFULL[f.worst.wd]} is your weakest day`, tag: "m",
    body: `${WDFULL[f.worst.wd]} brings in ${inrF(f.worst.revenue)} against ${inrF(f.wdMean)} on a normal day — ${Math.abs(f.worst.vs_avg).toFixed(0)}% down. Recovering half that gap is worth ${inr(gap * 0.5 * 52)} a year.`,
    act: "Send a deal to nearby customers", via: "Paytm Ads / Deals", tab: "low" });

  if (sh) push({ kind: "loss", worth: sh.switchers.annual_loss, annual: sh.switchers.annual_loss,
    per: "a year", sev: "hi", icon: "pie",
    title: `${sh.switchers.count} regulars started buying from quick commerce`, tag: "s",
    body: `They still come to you, but their basket fell from ${inrF(sh.switchers.basket_before)} to ${inrF(sh.switchers.basket_after)}. That is ${inr(sh.switchers.monthly_loss)} a month leaving the shop.`,
    act: "See what they moved", via: "Your Share", tab: "share" });

  const c = d.customers;
  if (c.winback && c.winback.length) push({ kind: "loss", worth: c.at_risk, annual: c.at_risk * 4, per: "over 3 months",
    sev: "md", icon: "users", title: `${c.winback.length} regulars have gone quiet`, tag: "m",
    body: `Together worth about ${inr(c.at_risk)} over the next three months. The top one came ${c.winback[0].visits} times and has not been back for ${c.winback[0].recency} days.`,
    act: "Send a cashback offer", via: "Paytm Cashback", tab: "share" });

  if (tracked()) {
    if ((d.stockout || []).length) {
      const so = d.stockout, lost = sum(so.map(x => x.d7 * x.cost * 1.12));
      push({ kind: "loss", worth: lost, annual: lost * 12, per: "at risk this week",
        sev: "hi", icon: "box",
        title: `${so.length} items run out within 2 days`, tag: "m",
        body: `${so[0].name} has ${so[0].on_hand} left against ${nf(so[0].d7, 0)} forecast for the week. Lead time is ${so[0].lead} day${so[0].lead === 1 ? "" : "s"} — order today or lose the sales.`,
        act: "See the reorder list", via: "Products", tab: "prod" });
    }
    if (d.totals.dead_capital > 0) push({ kind: "loss", worth: d.totals.dead_capital,
      annual: d.totals.dead_capital, per: "stuck right now", sev: "md", icon: "alert",
      title: `${d.dead_stock.length} items are sitting dead on the shelf`, tag: "m",
      body: `Nothing has sold from them in three weeks or more. The worst is ${d.dead_stock[0].name} — ${d.dead_stock[0].on_hand} units, nothing sold for ${d.dead_stock[0].days_since_sale} days.`,
      act: "Bundle it with a fast mover", via: "Paytm Deals", tab: "prod" });
  }

  const cf = d.cashflow, short = cf.peak_stock_need - Math.max(cf.net30, 0);
  if (short > 0) push({ kind: "loss", worth: short, annual: short, per: "shortfall",
    sev: "hi", icon: "cash",
    title: "You will be short of stock money", tag: "m",
    body: `Your heaviest 10-day window (${cf.peak_window_start} to ${cf.peak_window_end}) needs about ${inr(cf.peak_stock_need)}. Projected free cash is ${inr(Math.max(cf.net30, 0))}.`,
    act: `Pre-approved ${inr(d.credit.limit)}`, via: "Paytm Business Loan", tab: "credit" });

  // --- upside -------------------------------------------------------
  if (sh) push({ kind: "upside", worth: sh.cluster.worth * 12, annual: sh.cluster.worth * 12,
    per: "a year if you win them",
    sev: "lo", icon: "users",
    title: `${nf(sh.cluster.users)} people ${sh.cluster.dist} away have never paid you`, tag: "s",
    body: `A cluster ${sh.cluster.direction} walks past you to reach the market. They spend about ${inrF(sh.cluster.spend)} a month on what you sell, so winning even a tenth of them is ${inr(sh.cluster.worth)} a month.`,
    act: "Advertise to this pincode", via: "Paytm Ads", tab: "share" });

  if (sh && sh.adjacent_total) push({ kind: "upside", worth: sh.adjacent_total * 12,
    annual: sh.adjacent_total * 12, per: "a year if you stock it", sev: "lo", icon: "star",
    title: "Your customers buy things nearby that you do not stock", tag: "s",
    body: `${inr(sh.adjacent_total)} a month is spent by people already walking into your shop, on categories you do not keep.`,
    act: "See what they buy", via: "Your Share", tab: "share" });

  // Ranked on an annual equivalent so a weekly exposure and a yearly leak can be
  // compared honestly. Each card still shows its own natural period.
  const L = out.filter(o => o.kind === "loss").sort((a, b) => b.annual - a.annual);
  const U = out.filter(o => o.kind === "upside").sort((a, b) => b.annual - a.annual);
  const r = L.concat(U);
  r.losses = L; r.upsides = U;
  r.lossTotal = sum(L.map(o => o.annual));
  return r;
}

/* ============================= TODAY ============================= */
function vToday() {
  const f = F(), d = f.d, O = opps();
  const lastD = new Date(d.meta.asof + "T00:00:00");
  const vsPrev = f.prev ? (f.last.revenue / f.prev.revenue - 1) * 100 : 0;
  const sameWd = f.dl.filter((_, i) => i % 7 === (f.n - 1) % 7 && i < f.n - 1).slice(-6);
  const wdAvg = mean(sameWd.map(x => x.revenue));
  const vsWd = wdAvg ? (f.last.revenue / wdAvg - 1) * 100 : 0;
  const spk = f.dl.slice(-30).map(x => x.revenue);

  return head()
  + `<div class="g g21 mb">
    <div class="card"><div class="cb" style="padding:18px 20px">
      <div style="display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap">
        <div>
          <div class="kl">${dLong(lastD)} · latest day</div>
          <div class="num" style="font-size:40px;font-weight:720;letter-spacing:-.04em;margin:3px 0">
            ${inrF(f.last.revenue)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:5px">
            <span class="pill ${vsPrev >= 0 ? "p-g" : "p-r"}">${pc(vsPrev)} vs previous day</span>
            <span class="pill ${vsWd >= 0 ? "p-g" : "p-r"}">${pc(vsWd)} vs usual ${WDN[(lastD.getDay() + 6) % 7]}</span>
          </div>
          <div style="color:var(--mut);font-size:12.5px;margin-top:9px">
            ${nf(txOf(f.last))} ${tracked() ? "bills" : "payments"} ·
            ${inrF(f.last.revenue / txOf(f.last))} each</div>
        </div>
        <div style="text-align:right">
          <div class="kl" style="justify-content:flex-end">Last 30 days</div>
          <div class="num" style="font-size:20px;font-weight:690;margin-top:4px">${inr(f.r30)}</div>
          <div class="${f.g30 >= 0 ? "up" : "dn"}" style="font-size:12.5px">${pc(f.g30)} vs previous 30</div>
        </div>
      </div>
      <div style="margin-top:13px;padding-top:12px;border-top:1px solid var(--line-2)">
        ${barChart({ data: spk, labels: spk.map((_, i) => dateAt(f.n - 30 + i).getDate()),
          h: 124, ml: 50, thick: .66, r: 3, yFmt: v => inr(v, 0),
          colorFn: (v, i) => i === spk.length - 1 ? C.navy : v >= Math.max(...spk) * .98 ? C.ok : "#9BE0F8",
          hover: i => `<b>${dShort(dateAt(f.n - 30 + i))}</b><br>${inrF(spk[i])}<br>${nf(txOf(f.dl[f.n - 30 + i]))} ${tracked() ? "bills" : "payments"}` })}
      </div>
    </div></div>
    <div class="card"><div class="cb">
      <div class="kl">Costing you right now</div>
      <div class="num" style="font-size:30px;font-weight:720;letter-spacing:-.04em;margin:5px 0 2px;
        color:var(--bad)">${inr(O.lossTotal)}</div>
      <div style="color:var(--mut);font-size:12.5px">a year once each one is put on the same
        footing · ${O.losses.length} leaks</div>
      <div class="hr"></div>
      ${O.losses.map(o => `<div style="display:flex;justify-content:space-between;gap:9px;
        font-size:12.5px;padding:5px 0;border-bottom:1px solid var(--line-2)">
        <span style="color:var(--ink-2);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;
          white-space:nowrap">${esc(o.title)}</span>
        <span class="num" style="font-weight:650;flex:0 0 auto">${inr(o.annual)}</span></div>`).join("")}
      ${O.upsides.length ? `<div style="margin-top:11px;padding-top:9px;border-top:1px solid var(--line)">
        <div class="kl" style="font-size:10px">Upside — money that was never yours</div>
        ${O.upsides.map(o => `<div style="display:flex;justify-content:space-between;gap:9px;
          font-size:12.5px;padding:5px 0">
          <span style="color:var(--mut);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;
            white-space:nowrap">${esc(o.title)}</span>
          <span class="num" style="font-weight:600;color:var(--mut);flex:0 0 auto">${inr(o.annual)}</span>
        </div>`).join("")}</div>` : ""}
    </div></div>
  </div>

  <div style="display:flex;align-items:baseline;gap:10px;margin:2px 2px 11px">
    <h2 style="font-size:16px">What to do about it</h2>
    <span style="color:var(--mut);font-size:12.5px">biggest money first</span></div>
  ${O.map((o, i) => `
    ${i === O.losses.length && O.upsides.length ? `<div style="display:flex;align-items:baseline;
      gap:10px;margin:20px 2px 11px"><h2 style="font-size:16px">Worth going after</h2>
      <span style="color:var(--mut);font-size:12.5px">money that was never yours \u2014 upside, not loss</span></div>` : ""}
    <div class="act ${o.sev}">
    <span class="ai">${ic(o.icon, 18)}</span>
    <span class="ab">
      <span class="aw num">${inr(o.worth)} <span style="font-size:13px;font-weight:600;
        color:var(--mut);letter-spacing:0">${esc(o.per)}</span></span>
      <span class="at">${esc(o.title)} ${TAG[o.tag]()}</span>
      <span class="ad">${esc(o.body)}</span>
      <span class="arow">
        <button class="aa b" onclick="act('${esc(o.act)}','${esc(o.via)}')">${esc(o.act)}</button>
        <button class="aa" onclick="go('${o.tab}')">Look into it</button>
        <span class="via">through ${esc(o.via)}</span>
      </span></span></div>`).join("")}

  ${!tracked() ? `<div class="note w" style="margin-top:14px">${ic("lock", 16)}<div>
    <b>Products is locked for this shop.</b> Nothing here was guessed from payments — a
    ₹140 payment does not say what was in the bag. Start recording bills and that screen
    switches on, along with profit per item and reorder alerts.</div></div>` : ""}`;
}
function head() { return ""; }
function act(label, via) {
  say(label, `<p>In a real deployment this fires through <b>${esc(via)}</b> — which Paytm
    already runs. Tracker's job is not to build a new channel, it is to say
    <b>which channel to use, on whom, and when</b>.</p>
    <p>The audience is picked from hashed payer IDs. The merchant never sees a name or a phone
    number, and a held-out control group measures whether it actually worked.</p>`);
}
window.act = act;

/* ========================= TRANSACTIONS ========================== */
function vTxn() {
  const f = F(), d = f.d;
  let labels, rev, cogs, tx, unit;
  if (S.win === "day") {
    const w = f.dl.slice(-60);
    labels = w.map((_, i) => dShort(dateAt(f.n - 60 + i)));
    rev = w.map(x => x.revenue); cogs = w.map(x => x.cogs || 0);
    tx = w.map(txOf); unit = "day";
  } else if (S.win === "week") {
    const w = f.wk.slice(-26);
    labels = w.map(x => dShort(new Date(x.w + "T00:00:00")));
    rev = w.map(x => x.revenue); cogs = w.map(x => x.cogs || 0);
    tx = w.map(x => x.bills); unit = "week";
  } else {
    const w = d.monthly;
    labels = w.map(x => ymL(x.ym));
    rev = w.map(x => x.revenue); cogs = w.map(x => x.cogs || 0);
    tx = w.map(x => x.bills || x.txns); unit = "month";
  }
  const prof = rev.map((v, i) => tracked() ? v - cogs[i] : v * f.mg);
  const mavg = mean(rev);

  return `<div class="g g4 mb">
    ${kpi("Last 30 days", inr(f.r30), `<span class="${f.g30 >= 0 ? "up" : "dn"}">${pc(f.g30)}</span> vs previous 30`, "m")}
    ${kpi(tracked() ? "Gross profit · 30d" : "Estimated profit · 30d", inr(f.gp30),
      `${f.mg * 100 >= 0 ? (f.mg * 100).toFixed(1) : "—"}% margin`, tracked() ? "m" : "g")}
    ${kpi(tracked() ? "Bills · 30d" : "Payments · 30d", nf(f.t30),
      `<span class="${f.tg30 >= 0 ? "up" : "dn"}">${pc(f.tg30)}</span> vs previous 30`, "m")}
    ${kpi("Average sale", inrF(f.atv30),
      `<span class="${f.atv30 >= f.atv30p ? "up" : "dn"}">${pc((f.atv30 / f.atv30p - 1) * 100)}</span> vs previous 30`, "m")}
  </div>

  <div class="card mb"><div class="ch"><div class="ct2">Money received
    <div class="cs">Every figure here is added up straight from the payment records. Nothing is modelled.</div></div>
    <div class="seg">${[["day", t("day")], ["week", t("week")], ["month", t("month")]]
      .map(([k, l]) => `<button class="${S.win === k ? "on" : ""}" onclick="S.win='${k}';go('txn')">${l}</button>`).join("")}</div>
    </div><div class="cb">
    ${S.win === "day"
      ? lineChart({ series: [{ data: rev, color: "#A9DCF2", w: 1.3 },
                             { data: movAvg(rev, 7), color: C.pb, w: 2.6, fill: true }],
          labels, h: 250, yFmt: v => inr(v, 0), xCount: 8, lastLabel: true,
          hover: i => `<b>${labels[i]}</b><br>${inrF(rev[i])}<br>${nf(tx[i])} ${tracked() ? "bills" : "payments"}<br>7-${unit} average ${inrF(movAvg(rev, 7)[i])}` })
      : barChart({ data: rev, labels, h: 250, yFmt: v => inr(v, 0), thick: .6,
          xStep: S.win === "week" ? 2 : 1,
          colorFn: (v, i) => i === rev.length - 1 ? "#9FB6D4" : v < mavg * .88 ? C.warn : C.pb,
          hover: i => `<b>${labels[i]}</b><br>${inrF(rev[i])}<br>${nf(tx[i])} ${tracked() ? "bills" : "payments"}<br>${pc((rev[i] / mavg - 1) * 100)} vs the average ${unit}` })}
    <div class="leg"><span><i class="sw2" style="background:${C.pb}"></i>Money received</span>
      ${S.win !== "day" ? `<span><i class="sw2" style="background:${C.warn}"></i>Below your average ${unit}</span>` : `<span><i class="sw2" style="background:${C.pb}"></i>7-day average (the real trend)</span>`}
      <span style="color:var(--faint)">last ${unit} is still running</span></div>
    </div></div>

  <div class="card"><div class="ch"><div class="ct2">
    ${tracked() ? "What you kept" : "What you probably kept"} ${TAG[tracked() ? "m" : "g"]()}
    <div class="cs">${tracked()
      ? "Money received minus what the goods cost you. Both figures come from your bills."
      : `No cost data for this shop, so Tracker applies the ${f.mg * 100}% margin for a ${esc(S.setup.sub || "shop")} and labels it a guess. It will never show this as fact.`}</div></div></div>
    <div class="cb">${lineChart({
      series: [{ data: rev, color: C.navy, w: 2 }, { data: prof, color: C.ok, w: 2.4, fill: true }],
      labels, h: 210, yFmt: v => inr(v, 0), xCount: 8, lastLabel: true,
      hover: i => `<b>${labels[i]}</b><br>Received ${inrF(rev[i])}<br>Kept ${inrF(prof[i])}<br>${(prof[i] / rev[i] * 100).toFixed(1)}% margin` })}
    <div class="leg"><span><i class="sw2" style="background:${C.navy}"></i>Money received</span>
      <span><i class="sw2" style="background:${C.ok}"></i>${tracked() ? "Kept after cost of goods" : "Estimated keep"}</span></div>
    </div></div>`;
}
function kpi(l, v, f2, tag, col) {
  return `<div class="kpi"><div class="kl">${l}${tag ? " " + TAG[tag]() : ""}</div>
    <div class="kv num" ${col ? `style="color:${col}"` : ""}>${v}</div>
    <div class="kf">${f2}</div></div>`;
}

/* ============================ TRENDS ============================= */
function vTrends() {
  const f = F(), d = f.d;
  const wd = f.wd, wmax = Math.max(...wd.map(x => x.revenue));
  const hr = d.hourly, hmax = Math.max(...hr.map(x => x.revenue));
  const top3 = hr.slice().sort((a, b) => b.share - a.share).slice(0, 3);
  const mo = f.full;
  return `<div class="g g4 mb">
    ${kpi("Growth · 30d vs 30d", pc(f.g30), f.g30 >= 0 ? "getting better" : "getting worse", "m",
      f.g30 >= 0 ? C.ok : C.bad)}
    ${kpi("Best day", WDFULL[f.best.wd], `${inrF(f.best.revenue)} on average`, "m")}
    ${kpi("Busiest hour", top3[0].h + ":00", `${top3[0].share.toFixed(1)}% of a day's money`, "m")}
    ${kpi("Busiest 3 hours", sum(top3.map(x => x.share)).toFixed(0) + "%", "of everything you take", "m")}
  </div>

  <div class="g g2 mb">
    <div class="card"><div class="ch"><div class="ct2">Day of the week ${TAG.m()}
      <div class="cs">Average across the year. Green is your best, red your worst.</div></div></div>
      <div class="cb">${barChart({ data: wd.map(x => x.revenue), labels: wd.map(x => x.name),
        h: 205, yFmt: v => inr(v, 0),
        colorFn: v => v === wmax ? C.ok : v === Math.min(...wd.map(x => x.revenue)) ? C.bad : C.pb,
        hover: i => `<b>${WDFULL[wd[i].wd]}</b><br>${inrF(wd[i].revenue)} average<br>${pc(wd[i].vs_avg)} vs your other days` })}
      <div class="note" style="margin-top:4px">${ic("info", 15)}<div>
        The gap between ${WDFULL[f.best.wd]} and ${WDFULL[f.worst.wd]} is
        <b>${inrF(f.best.revenue - f.worst.revenue)} every week</b> —
        ${inr((f.best.revenue - f.worst.revenue) * 52)} a year.</div></div></div></div>

    <div class="card"><div class="ch"><div class="ct2">Hour of the day ${TAG.m()}
      <div class="cs">Where your staff and your stock actually need to be.</div></div></div>
      <div class="cb">${barChart({ data: hr.map(x => x.revenue), labels: hr.map(x => x.h),
        h: 205, yFmt: v => inr(v, 0), thick: .72,
        colorFn: v => v === hmax ? C.navy : C.pb,
        hover: i => `<b>${hr[i].h}:00 – ${hr[i].h + 1}:00</b><br>${inrF(hr[i].revenue)}<br>${hr[i].share.toFixed(1)}% of all your money` })}
      <div class="note" style="margin-top:4px">${ic("clock", 15)}<div>
        ${top3.map(x => x.h + ":00").join(", ")} carry
        <b>${sum(top3.map(x => x.share)).toFixed(0)}%</b> of the day. Running out of stock or short of
        help in those hours costs more than at any other time.</div></div></div></div>
  </div>

  <div class="card mb"><div class="ch"><div class="ct2">Week × hour ${TAG.m()}
    <div class="cs">Darker means busier. The dark blocks are the only hours worth optimising.</div></div></div>
    <div class="cb">${heatMap({ matrix: d.heatmap, rows: WDN, cols: d.heatmap_hours })}</div></div>

  <div class="card"><div class="ch"><div class="ct2">Month by month ${TAG.m()}
    <div class="cs">Part months are excluded so you are never comparing 13 days against 31.</div></div></div>
    <div class="cb">${barChart({ data: mo.map(m => m.revenue), labels: mo.map(m => ymL(m.ym)),
      h: 200, yFmt: v => inr(v, 0), thick: .58,
      colorFn: v => v === Math.max(...mo.map(m => m.revenue)) ? C.ok
        : v === Math.min(...mo.map(m => m.revenue)) ? C.warn : C.pb,
      hover: i => `<b>${ymFull(mo[i].ym)}</b><br>${inrF(mo[i].revenue)}<br>${nf(mo[i].bills || mo[i].txns)} ${tracked() ? "bills" : "payments"} over ${mo[i].days} days` })}
    </div></div>`;
}

/* ========================= LOW EARNINGS ========================== */
/* The decomposition: earnings = how many people came x how much each spent. */
function vLow() {
  const f = F(), d = f.d;
  const wd = f.wd.slice().sort((a, b) => a.revenue - b.revenue);
  const w = f.wk.slice(-5, -1);               // last 4 complete weeks
  const wAll = f.wk.slice(-13, -1);
  const worstWk = w.slice().sort((a, b) => a.revenue - b.revenue)[0];
  const bestWk = w.slice().sort((a, b) => b.revenue - a.revenue)[0];
  const wkMean = mean(wAll.map(x => x.revenue));

  // decompose the worst week against the 12-week norm
  const nTx = mean(wAll.map(x => x.bills)), nAtv = wkMean / nTx;
  const wTx = worstWk.bills, wAtv = worstWk.revenue / worstWk.bills;
  const dTx = (wTx / nTx - 1) * 100, dAtv = (wAtv / nAtv - 1) * 100;
  const verdict = Math.abs(dTx) > Math.abs(dAtv) * 1.6 ? "footfall"
    : Math.abs(dAtv) > Math.abs(dTx) * 1.6 ? "basket" : "both";
  const VER = {
    footfall: { t: "Fewer people came", c: C.bad,
      d: "Your basket size held up. The shortfall is almost entirely people who did not walk in.",
      fix: "This is a footfall problem. An offer, a sign, or checking whether something changed on your street. Discounting your existing customers will not fix it — they already came." },
    basket: { t: "The same people spent less", c: C.warn,
      d: "Roughly the usual number of customers came, but each one spent less than normal.",
      fix: "This is a basket problem. Most often it means you were out of stock on something people came for, or a high-value line stopped moving. Check the Products screen first." },
    both: { t: "Both moved against you", c: C.bad,
      d: "Fewer customers, and the ones who came spent less. These usually have different causes.",
      fix: "Treat footfall first — it is the larger of the two and the easier to influence." },
  }[verdict];

  return `<div class="note mb">${ic("info", 16)}<div>
    <b>Knowing which day was worst is not useful on its own — you already feel that.</b>
    What matters is <i>why</i>. Every rupee you take is
    <b>how many people came × how much each one spent</b>. When earnings fall, exactly one of
    those two usually moved. They need completely different fixes.</div></div>

  <div class="card mb"><div class="ch"><div class="ct2">Your worst recent week, taken apart ${TAG.m()}
    <div class="cs">Week of ${dLong(new Date(worstWk.w + "T00:00:00"))}, measured against your last 12 weeks.</div></div></div>
    <div class="cb">
      <div class="g g3" style="gap:12px;margin-bottom:16px">
        <div style="padding:14px 16px;background:var(--bg);border-radius:var(--r-s)">
          <div class="kl" style="font-size:10.5px">That week</div>
          <div class="num" style="font-size:23px;font-weight:700;margin-top:4px">${inrF(worstWk.revenue)}</div>
          <div class="s2">${pc((worstWk.revenue / wkMean - 1) * 100)} vs your normal week</div></div>
        <div style="padding:14px 16px;background:${Math.abs(dTx) > 3 ? "var(--bad-l)" : "var(--bg)"};
          border-radius:var(--r-s)">
          <div class="kl" style="font-size:10.5px">People who came</div>
          <div class="num" style="font-size:23px;font-weight:700;margin-top:4px;
            color:${dTx < -3 ? C.bad : "inherit"}">${pc(dTx)}</div>
          <div class="s2">${nf(wTx)} vs ${nf(nTx, 0)} normally</div></div>
        <div style="padding:14px 16px;background:${Math.abs(dAtv) > 3 ? "var(--warn-l)" : "var(--bg)"};
          border-radius:var(--r-s)">
          <div class="kl" style="font-size:10.5px">Spend per person</div>
          <div class="num" style="font-size:23px;font-weight:700;margin-top:4px;
            color:${dAtv < -3 ? C.warn : "inherit"}">${pc(dAtv)}</div>
          <div class="s2">${inrF(wAtv)} vs ${inrF(nAtv)} normally</div></div>
      </div>
      <div style="padding:15px 17px;border-radius:var(--r-s);background:#fff;
        border:1px solid var(--line);border-left:3px solid ${VER.c}">
        <div style="font-weight:660;font-size:15px;color:${VER.c}">${VER.t}</div>
        <div style="color:var(--ink-2);font-size:13px;margin-top:5px;line-height:1.55">${VER.d}</div>
        <div class="hr" style="margin:12px 0"></div>
        <div class="kl" style="font-size:10px;margin-bottom:4px">${t("doit")}</div>
        <div style="font-size:13px;color:var(--ink-2);line-height:1.55">${VER.fix}</div>
      </div>
    </div></div>

  <div class="g g2 mb">
    <div class="card"><div class="ch"><div class="ct2">Days ranked, worst first ${TAG.m()}
      <div class="cs">Average across the whole year.</div></div></div>
      <div class="cb"><div class="tw"><table>
        <thead><tr><th>Day</th><th class="r">Average</th><th class="r">vs normal</th>
          <th class="r">Costing you</th></tr></thead>
        <tbody>${wd.map((x, i) => `<tr>
          <td class="nm">${WDFULL[x.wd]}${i === 0 ? ` <span class="pill p-r">worst</span>` : ""}</td>
          <td class="r num">${inrF(x.revenue)}</td>
          <td class="r num ${x.vs_avg >= 0 ? "up" : "dn"}">${pc(x.vs_avg)}</td>
          <td class="r num">${x.revenue < f.wdMean ? inr((f.wdMean - x.revenue) * 52) + " / yr" : "—"}</td>
        </tr>`).join("")}</tbody></table></div></div></div>

    <div class="card"><div class="ch"><div class="ct2">Last four complete weeks ${TAG.m()}
      <div class="cs">Which week was weakest, and whether it was people or basket.</div></div></div>
      <div class="cb">${barChart({ data: w.map(x => x.revenue),
        labels: w.map(x => dShort(new Date(x.w + "T00:00:00"))), h: 180, yFmt: v => inr(v, 0),
        thick: .5, colorFn: v => v === worstWk.revenue ? C.bad : v === bestWk.revenue ? C.ok : C.pb,
        hover: i => `<b>Week of ${dShort(new Date(w[i].w + "T00:00:00"))}</b><br>${inrF(w[i].revenue)}<br>${nf(w[i].bills)} ${tracked() ? "bills" : "payments"}<br>${inrF(w[i].revenue / w[i].bills)} each` })}
        <div class="hr"></div>
        ${w.map(x => {
          const tx = (x.bills / nTx - 1) * 100, av = (x.revenue / x.bills / nAtv - 1) * 100;
          const why = Math.abs(tx) > Math.abs(av) * 1.6 ? "fewer people"
            : Math.abs(av) > Math.abs(tx) * 1.6 ? "smaller baskets" : "both";
          return `<div style="display:flex;gap:10px;align-items:center;font-size:12.5px;padding:6px 0;
            border-bottom:1px solid var(--line-2)">
            <span style="flex:1">Week of ${dShort(new Date(x.w + "T00:00:00"))}</span>
            <span class="num s2" style="width:62px;text-align:right">${pc(tx, 0)} people</span>
            <span class="num s2" style="width:66px;text-align:right">${pc(av, 0)} basket</span>
            <span class="pill ${x.revenue < wkMean ? "p-a" : "p-g"}" style="width:104px;justify-content:center">
              ${x.revenue < wkMean ? why : "above normal"}</span></div>`;
        }).join("")}
      </div></div>
  </div>

  <div class="card"><div class="ch"><div class="ct2">Days that broke the pattern ${TAG.m()}
    <div class="cs">Days too far from the expected level to be ordinary noise.</div></div></div>
    <div class="cb"><div class="tw"><table>
      <thead><tr><th>Date</th><th class="r">Actual</th><th class="r">Expected</th>
        <th class="r">Gap</th><th>Likely reason</th></tr></thead>
      <tbody>${(d.anomalies || []).slice(0, 12).map(a => {
        const dt = new Date(a.d + "T00:00:00");
        return `<tr><td class="nm">${dShort(dt)} ${dt.getFullYear()}
          <div class="s2">${WDFULL[(dt.getDay() + 6) % 7]}</div></td>
          <td class="r num">${inrF(a.actual)}</td><td class="r num s2">${inrF(a.expected)}</td>
          <td class="r num ${a.kind === "spike" ? "up" : "dn"}">${pc((a.actual / a.expected - 1) * 100, 0)}</td>
          <td>${a.festival ? `<span class="pill p-a">${esc(a.festival)}</span> ${TAG.m()}`
            : `<span class="pill ${a.kind === "spike" ? "p-g" : "p-r"}">unexplained ${a.kind}</span> ${TAG.g()}`}</td></tr>`;
      }).join("")}</tbody></table></div>
      <div class="note w" style="margin-top:12px">${ic("info", 15)}<div>
        A festival is a <b>measured</b> explanation — the date is known.
        An unexplained spike or dip is tagged a <b>guess</b>, because Tracker can see that something
        happened but has no idea what. It will not invent a reason.</div></div>
    </div></div>`;
}

/* ============================ AVERAGES =========================== */
function vAvg() {
  const f = F(), d = f.d;
  const dl = f.dl, full = f.full;
  const openDays = dl.filter(x => x.revenue > 0);
  const avgDay = mean(openDays.map(x => x.revenue));
  const avgWk = mean(f.wk.slice(0, -1).map(x => x.revenue));
  const avgMo = mean(full.map(x => x.revenue));
  const avgTx = mean(openDays.map(txOf));
  const atv = avgDay / avgTx;
  const r90 = mean(dl.slice(-90).map(x => x.revenue));
  const r90p = mean(dl.slice(-180, -90).map(x => x.revenue));
  const bands = [
    ["A really good day", dl.map(x => x.revenue).sort((a, b) => b - a)[Math.floor(dl.length * .1)], C.ok],
    ["A normal day", avgDay, C.pb],
    ["A slow day", dl.map(x => x.revenue).sort((a, b) => a - b)[Math.floor(dl.length * .1)], C.warn],
  ];
  return `<div class="note mb">${ic("info", 16)}<div>
    These are your <b>normals</b>. On their own they are boring — their job is to let you tell
    a bad day apart from a bad trend. One day below average means nothing. Five in a row means
    something.</div></div>

  <div class="g g4 mb">
    ${kpi("A normal day", inrF(avgDay), `${nf(avgTx, 0)} ${tracked() ? "bills" : "payments"}`, "m")}
    ${kpi("A normal week", inr(avgWk), `${nf(avgTx * 7, 0)} ${tracked() ? "bills" : "payments"}`, "m")}
    ${kpi("A normal month", inr(avgMo), `over ${full.length} complete months`, "m")}
    ${kpi("A normal sale", inrF(atv), tracked() ? `${(d.totals.units / d.totals.bills).toFixed(1)} items a bill` : "per payment", "m")}
  </div>

  <div class="g g2 mb">
    <div class="card"><div class="ch"><div class="ct2">What counts as good, normal and slow ${TAG.m()}
      <div class="cs">Your own top and bottom 10% of days, not someone else's benchmark.</div></div></div>
      <div class="cb">${hBars({ rows: bands.map(([l, v, c]) => ({ label: l, v, color: c })), fmt: inrF })}
      <div class="hr"></div>
      <div style="font-size:12.5px;color:var(--ink-2);line-height:1.6">
        Anything under <b>${inrF(bands[2][1])}</b> is a genuinely slow day for you — it happens
        about ${nf(dl.filter(x => x.revenue < bands[2][1]).length)} days a year.
        Anything over <b>${inrF(bands[0][1])}</b> is a strong one.</div>
      </div></div>

    <div class="card"><div class="ch"><div class="ct2">Is the normal itself moving? ${TAG.m()}
      <div class="cs">An average is only useful if you know which way it is drifting.</div></div></div>
      <div class="cb">
        <div style="display:flex;gap:16px;align-items:baseline;flex-wrap:wrap">
          <div><div class="kl" style="font-size:10.5px">Last 90 days</div>
            <div class="num" style="font-size:26px;font-weight:700">${inrF(r90)}</div>
            <div class="s2">a day</div></div>
          <div style="font-size:21px;color:var(--faint)">→</div>
          <div><div class="kl" style="font-size:10.5px">90 days before that</div>
            <div class="num" style="font-size:26px;font-weight:700;color:var(--mut)">${inrF(r90p)}</div>
            <div class="s2">a day</div></div>
          <div style="margin-left:auto">
            <span class="pill ${r90 >= r90p ? "p-g" : "p-r"}" style="font-size:14px;padding:5px 13px">
              ${pc((r90 / r90p - 1) * 100)}</span></div>
        </div>
        <div class="hr"></div>
        ${lineChart({ series: [{ data: movAvg(dl.map(x => x.revenue), 30), color: C.pb, w: 2.6, fill: true }],
          labels: dl.map((_, i) => dShort(dateAt(i))), h: 150, yFmt: v => inr(v, 0), xCount: 6, ticks: 3,
          hover: i => `<b>${dShort(dateAt(i))}</b><br>30-day average ${inrF(movAvg(dl.map(x => x.revenue), 30)[i])}` })}
        <div class="s2" style="margin-top:4px">30-day rolling average — the line that actually
          tells you whether the shop is growing.</div>
      </div></div>
  </div>

  <div class="card"><div class="ch"><div class="ct2">Normal, broken down ${TAG.m()}</div></div>
    <div class="cb"><div class="tw"><table>
      <thead><tr><th>Period</th><th class="r">Money</th><th class="r">${tracked() ? "Bills" : "Payments"}</th>
        <th class="r">Per sale</th><th class="r">${tracked() ? "Kept" : "Kept (est.)"}</th></tr></thead>
      <tbody>
        ${[["A normal day", avgDay, avgTx], ["A normal week", avgWk, avgTx * 7],
           ["A normal month", avgMo, avgTx * 30.4], ["A whole year", avgMo * 12, avgTx * 365]]
          .map(([l, v, tx]) => `<tr><td class="nm">${l}</td>
            <td class="r num">${inrF(v)}</td><td class="r num">${nf(tx, 0)}</td>
            <td class="r num">${inrF(v / tx)}</td>
            <td class="r num" style="color:${C.ok};font-weight:620">${inrF(v * f.mg)}</td></tr>`).join("")}
      </tbody></table></div>
      ${!tracked() ? `<div class="note w" style="margin-top:11px">${ic("info", 15)}<div>
        The "kept" column uses the ${(f.mg * 100).toFixed(0)}% margin for a
        ${esc(S.setup.sub || "shop")}. It is a reasonable estimate, not your real profit.</div></div>` : ""}
    </div></div>`;
}

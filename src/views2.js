/* ==================================================================
   Tracker — Products, Your Share, Credit, About
   ================================================================== */

/* =========================== PRODUCTS ============================ */
let PSEL = null;
function vProd() {
  const d = D(), items = d.sku_list, tm = d.timing, H = d.timing_hours;
  const top = items.slice(0, 1)[0];
  const sel = items.find(x => x.sku === PSEL) || top;
  const st = tm[sel.sku] || { hours: [], wd: [], months: [], peak_hour: "-", peak_wd: "-" };
  const mos = d.timing_months;
  const so = d.stockout || [], dead = d.dead_stock || [];
  const tbm = d.top_by_month || {};
  const lastMo = mos[mos.length - 1];

  return `<div class="g g4 mb">
    ${kpi("Most sold, all year", top.name, `${nf(top.qty)} units · ${inr(top.revenue)}`, "m")}
    ${kpi("Most sold this month", (tbm[lastMo] || {}).name || "—",
      tbm[lastMo] ? `${nf(tbm[lastMo].qty)} units in ${ymFull(lastMo)}` : "", "m")}
    ${kpi("Running out in 2 days", so.length, so.length ? "order these today" : "nothing urgent", "m",
      so.length ? C.bad : C.ok)}
    ${kpi("Dead on the shelf", inr(d.totals.dead_capital), `${dead.length} items not moving`, "m",
      dead.length ? C.warn : C.ok)}
  </div>

  ${so.length ? `<div class="act hi" style="margin-bottom:14px">
    <span class="ai">${ic("alert", 18)}</span>
    <span class="ab"><span class="at">${so.length} items run out within 2 days ${TAG.m()}</span>
    <span class="ad">${esc(so[0].name)} has ${so[0].on_hand} left against ${nf(so[0].d7, 0)} forecast for
      the week. Supplier takes ${so[0].lead} day${so[0].lead === 1 ? "" : "s"}.
      ${(() => { const t2 = tm[so[0].sku]; return t2 && t2.peak_hour
        ? `It sells hardest around <b>${t2.peak_hour}:00</b> — being empty then costs you the most.` : ""; })()}</span>
    <span class="arow"><button class="aa b" onclick="act('Order from distributor','Paytm merchant ordering')">Order now</button></span>
    </span></div>` : ""}

  <div class="g g12 mb">
    <div class="card"><div class="ch"><div class="ct2">Pick a product
      <div class="cs">Top sellers by money. Click one to see when it sells.</div></div></div>
      <div class="cb"><div class="tw" style="max-height:470px">
        ${items.slice(0, 26).map(p => `<button onclick="PSEL='${p.sku}';go('prod')"
          style="display:flex;gap:9px;width:100%;text-align:left;padding:8px 9px;border-radius:8px;
          align-items:center;background:${p.sku === sel.sku ? "var(--pb-l)" : "transparent"};
          border:1px solid ${p.sku === sel.sku ? "#BDEBFB" : "transparent"};margin-bottom:2px">
          <span style="flex:1;min-width:0">
            <span class="nm" style="display:block;font-size:12.5px;overflow:hidden;
              text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</span>
            <span class="s2">${nf(p.qty)} units · ${(tm[p.sku] || {}).peak_hour ?? "?"}:00 peak</span>
          </span>
          <span class="num" style="font-weight:620;font-size:12.5px">${inr(p.revenue)}</span>
        </button>`).join("")}
      </div></div></div>

    <div class="card"><div class="ch"><div class="ct2">${esc(sel.name)} — when it sells ${TAG.m()}
      <div class="cs">${nf(sel.qty)} units and ${inr(sel.revenue)} over the year, at
        ${sel.margin_pct.toFixed(1)}% margin. ${st.peak_hour != null
        ? `Peaks at <b>${st.peak_hour}:00</b> and on <b>${st.peak_wd}</b>.` : ""}</div></div></div>
      <div class="cb">
        <div class="kl" style="font-size:10.5px;margin-bottom:4px">By hour of day</div>
        ${barChart({ data: st.hours, labels: H, h: 160, thick: .72, ml: 44,
          yFmt: v => nf(v), colorFn: v => v === Math.max(...st.hours) ? C.navy : C.pb,
          hover: i => `<b>${H[i]}:00 – ${H[i] + 1}:00</b><br>${nf(st.hours[i])} units sold<br>${(st.hours[i] / (sum(st.hours) || 1) * 100).toFixed(1)}% of this item` })}
        <div class="g g2" style="gap:14px;margin-top:14px">
          <div><div class="kl" style="font-size:10.5px;margin-bottom:4px">By day of week</div>
            ${barChart({ data: st.wd, labels: WDN, h: 140, thick: .6, ml: 40, yFmt: v => nf(v),
              colorFn: v => v === Math.max(...st.wd) ? C.ok : C.pb,
              hover: i => `<b>${WDFULL[i]}</b><br>${nf(st.wd[i])} units` })}</div>
          <div><div class="kl" style="font-size:10.5px;margin-bottom:4px">By month</div>
            ${barChart({ data: st.months, labels: mos.map(ymL), h: 140, thick: .6, ml: 40,
              yFmt: v => nf(v), xStep: 2,
              colorFn: v => v === Math.max(...st.months) ? C.warn : C.pb,
              hover: i => `<b>${ymFull(mos[i])}</b><br>${nf(st.months[i])} units` })}</div>
        </div>
        <div class="note" style="margin-top:12px">${ic("clock", 15)}<div>
          ${st.hour_share >= 14
            ? `<b>${st.hour_share}% of this item sells in a single hour (${st.peak_hour}:00).</b>
               If you are empty at that hour you do not sell it later — you lose the sale.`
            : `It sells steadily through the day, so a short gap in stock is less damaging here.`}
          Heaviest day is <b>${st.peak_wd}</b>, heaviest month was <b>${ymFull(st.peak_month)}</b>.</div></div>
      </div></div>
  </div>

  <div class="g g2 mb">
    <div class="card"><div class="ch"><div class="ct2">What sells most, and when ${TAG.m()}</div></div>
      <div class="cb"><div class="tw"><table>
        <thead><tr><th>Item</th><th class="r">Units</th><th class="r">Money</th>
          <th class="r">Margin</th><th class="c">Peak hour</th><th class="c">Peak day</th></tr></thead>
        <tbody>${items.slice(0, 25).map(p => { const x = tm[p.sku] || {};
          return `<tr><td class="nm">${esc(p.name)}</td>
            <td class="r num">${nf(p.qty)}</td><td class="r num">${inr(p.revenue)}</td>
            <td class="r num" style="color:${p.margin_pct > 15 ? C.ok : p.margin_pct < 8 ? C.warn : "inherit"}">
              ${p.margin_pct.toFixed(1)}%</td>
            <td class="c num">${x.peak_hour ?? "—"}:00</td>
            <td class="c">${x.peak_wd ?? "—"}</td></tr>`; }).join("")}
        </tbody></table></div></div></div>

    <div class="card"><div class="ch"><div class="ct2">Top seller, month by month ${TAG.m()}
      <div class="cs">What people actually came for, in each month.</div></div></div>
      <div class="cb"><div class="tw"><table>
        <thead><tr><th>Month</th><th>Most sold</th><th class="r">Units</th><th class="r">Money</th></tr></thead>
        <tbody>${mos.slice().reverse().map(m => { const x = tbm[m]; if (!x) return "";
          return `<tr><td class="nm">${ymFull(m)}</td><td>${esc(x.name)}</td>
            <td class="r num">${nf(x.qty)}</td><td class="r num">${inrF(x.revenue)}</td></tr>`; }).join("")}
        </tbody></table></div></div></div>
  </div>

  ${dead.length ? `<div class="card"><div class="ch"><div class="ct2">Not moving ${TAG.m()}
    <div class="cs">Money you already spent, sitting still.</div></div></div>
    <div class="cb"><div class="tw"><table>
      <thead><tr><th>Item</th><th class="r">Units left</th><th class="r">Quiet for</th>
        <th class="r">Money stuck</th><th></th></tr></thead>
      <tbody>${dead.map(x => `<tr><td class="nm">${esc(x.name)}<div class="s2">${esc(x.cat)}</div></td>
        <td class="r num">${x.on_hand}</td>
        <td class="r num" style="color:${C.bad};font-weight:620">${x.days_since_sale} days</td>
        <td class="r num">${inrF(x.value)}</td>
        <td class="r"><button class="btn btn-o btn-s"
          onclick="act('Bundle &amp; discount','Paytm Deals')">Clear it</button></td></tr>`).join("")}
      </tbody></table></div>
      <div class="note" style="margin-top:11px">${ic("tag", 15)}<div>
        Clearing all of it at 30% off frees about <b>${inr(d.totals.dead_capital * 0.7)}</b> you can
        put into items that actually move.</div></div>
    </div></div>` : ""}`;
}
window.PSEL = PSEL;

function vProdLock() {
  const d = D();
  return `<div class="lockbox">
    <div class="li">${ic("lock", 26)}</div>
    <h2 style="font-size:20px">Products needs you to record what you sell</h2>
    <div style="color:var(--mut);max-width:54ch;margin:10px auto 0;font-size:13.5px;line-height:1.6">
      ${esc(d.merchant.name)} takes payments through a QR code. A payment of ${inrF(45)} tells Tracker
      that ${inrF(45)} arrived — not what was sold, and not what it cost.
      <b>Tracker will not guess it.</b> Everything on this screen would be invented, so it stays shut.</div>
    <ul class="ul">${["What sells most, and at what hour", "Profit and margin per item",
      "Reorder alerts before you run out", "Dead stock and money stuck on the shelf",
      "Which items sell together"].map(x => `<li>${ic("lock", 14)}${esc(x)}</li>`).join("")}</ul>
    <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
      <button class="btn btn-b" onclick="act('Start recording bills','Paytm Billing')">Start recording bills</button>
      <button class="btn btn-o" onclick="switchMerchant()">See a shop that does</button></div>
    <div class="s2" style="margin-top:16px">Everything else in Tracker works for this shop as normal.</div>
  </div>`;
}

/* ========================== YOUR SHARE =========================== */
function vShare() {
  const d = D(), s = SHARE(), f = F();
  const ser = s.share_series;
  const KIND = { kirana: C.pb, supermarket: C.navy2, quick: C.bad, market: C.grey };
  return `<div class="note w mb">${ic("info", 16)}<div>
    <b>This screen is different from every other one.</b> Everywhere else, Tracker only uses your own
    shop's records. Here it uses what Paytm sees when your customers pay
    <i>somewhere else</i> — aggregated, never one person. It is the only thing in this app that no
    other company could build, because it needs both the shopper's side and the shop's side.
    <b>The figures here are simulated</b> for the demo; the method is real.</div></div>

  <div class="g g4 mb">
    ${kpi("Your share of their spending", s.share_pct + "%",
      `${s.share_change < 0 ? "<span class='dn'>" + s.share_change + " points</span>" : "<span class='up'>+" + s.share_change + "</span>"} over the year`, "s", C.pb)}
    ${kpi("What they spend nearby", inr(s.wallet),
      `a month, across ${nf(s.customers)} regulars`, "s")}
    ${kpi("What comes to you", inr(s.from_known), `${s.attributed_share}% of your sales are traceable`, "m")}
    ${kpi("Going elsewhere", inr(s.rest), "a month, within walking distance", "s", C.bad)}
  </div>

  <div class="g g21 mb">
    <div class="card"><div class="ch"><div class="ct2">Your share, month by month ${TAG.s()}
      <div class="cs">Of everything your own regulars spend on what you sell, in this area.</div></div></div>
      <div class="cb">${lineChart({
        series: [{ data: ser.map(x => x.share), color: C.pb, w: 2.8, fill: true }],
        labels: ser.map(x => ymL(x.ym)), h: 220, yFmt: v => v.toFixed(1) + "%", xStep: 1,
        min: Math.max(0, Math.floor(Math.min(...ser.map(x => x.share)) - 3)),
        max: Math.ceil(Math.max(...ser.map(x => x.share)) + 2), ticks: 5,
        hover: i => `<b>${ymFull(ser[i].ym)}</b><br>You had ${ser[i].share}% of their spending<br>They spent about ${inrF(ser[i].wallet)} in total` })}
      <div class="note" style="margin-top:4px">${ic("info", 15)}<div>
        You think of these ${nf(s.customers)} people as your customers. They are — for
        <b>${s.share_pct}%</b> of what they buy. The other
        <b>${(100 - s.share_pct).toFixed(1)}%</b> goes to four other places, all within walking
        distance.</div></div></div></div>

    <div class="card"><div class="ch"><div class="ct2">Where the rest goes ${TAG.s()}</div></div>
      <div class="cb">
        ${stackBar(s.leakage.map(l => ({ label: l.where, v: l.amount, color: KIND[l.kind] })), 15)}
        <div style="margin-top:13px">${s.leakage.map(l => `
          <div style="display:flex;gap:9px;align-items:flex-start;padding:9px 0;
            border-bottom:1px solid var(--line-2)">
            <i class="sw2" style="background:${KIND[l.kind]};margin-top:4px"></i>
            <div style="flex:1;min-width:0">
              <div style="font-size:12.5px;font-weight:570;line-height:1.35">${esc(l.where)}</div>
              <div class="s2">${l.pct}% of what leaves you</div></div>
            <div style="text-align:right;flex:0 0 auto">
              <div class="num" style="font-weight:650;font-size:12.5px">${inr(l.amount)}</div>
              <div class="s2 ${l.trend > 0 ? "dn" : "up"}">${pc(l.trend, 0)} this year</div></div>
          </div>`).join("")}</div>
      </div></div>
  </div>

  <div class="card mb"><div class="ch"><div class="ct2" style="color:${C.bad}">
    ${ic("alert", 16)} ${s.switchers.count} of your regulars moved part of their basket to quick commerce ${TAG.s()}
    <div class="cs">They did not stop coming. That is why you never noticed.</div></div></div>
    <div class="cb">
      <div class="g g4" style="gap:12px;margin-bottom:15px">
        ${["Still visiting you", s.switchers.still_visiting + " of " + s.switchers.count,
           "Basket before", inrF(s.switchers.basket_before),
           "Basket now", inrF(s.switchers.basket_after),
           "Costing you", inr(s.switchers.annual_loss) + " a year"]
          .reduce((a, v, i) => { if (i % 2 === 0) a.push([v]); else a[a.length - 1].push(v); return a; }, [])
          .map(([k, v], i) => `<div style="padding:12px 14px;border-radius:var(--r-s);
            background:${i === 3 ? "var(--bad-l)" : "var(--bg)"}">
            <div class="kl" style="font-size:10px">${k}</div>
            <div class="num" style="font-size:19px;font-weight:690;margin-top:3px;
              color:${i === 3 ? C.bad : "inherit"}">${v}</div></div>`).join("")}
      </div>
      <div class="kl" style="font-size:10.5px;margin-bottom:6px">What they moved away from you</div>
      ${hBars({ rows: s.switchers.moved.map(([c, p]) => ({ label: c, v: p, color: C.bad })),
        fmt: v => v + "%" })}
      <div class="hr"></div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <div style="flex:1;min-width:260px;font-size:13px;color:var(--ink-2);line-height:1.6">
          They still buy fresh and last-minute things from you. They moved the
          <b>planned, heavy, packaged</b> part of the basket — which is exactly the part that
          carried your volume. The fix is not price; it is being the easier option for a planned
          order.</div>
        <button class="aa b" onclick="act('Offer these 39 customers a standing order','Paytm Deals + Payment Links')">
          Win the planned basket back</button>
      </div>
    </div></div>

  <div class="g g2">
    <div class="card"><div class="ch"><div class="ct2">People near you who have never paid you ${TAG.s()}
      <div class="cs">Paytm users within walking distance, and how many you actually reach.</div></div></div>
      <div class="cb"><div class="tw" style="max-height:none"><table>
        <thead><tr><th>Distance</th><th class="r">Paytm users</th><th class="r">Your customers</th>
          <th class="r">Reach</th></tr></thead>
        <tbody>${s.catchment.map(c => `<tr><td class="nm">${esc(c.band)}</td>
          <td class="r num">${nf(c.users)}</td><td class="r num">${nf(c.reached)}</td>
          <td class="r"><span class="pill ${c.reach > 50 ? "p-g" : c.reach > 25 ? "p-a" : "p-r"}">
            ${c.reach}%</span></td></tr>`).join("")}
        </tbody></table></div>
        <div class="note" style="margin-top:12px">${ic("users", 15)}<div>
          A cluster of about <b>${nf(s.cluster.users)} people ${s.cluster.dist} ${esc(s.cluster.direction)}</b>
          walks past you to reach the market. At ${inrF(s.cluster.spend)} a month each, winning even
          a tenth of them is <b>${inr(s.cluster.worth)} a month</b>.</div></div>
        <button class="aa b" style="margin-top:11px"
          onclick="act('Advertise to this cluster','Paytm Ads')">Advertise to them</button>
      </div></div>

    <div class="card"><div class="ch"><div class="ct2">What they buy that you do not sell ${TAG.s()}
      <div class="cs">Spending by your own customers, on categories you do not stock.</div></div></div>
      <div class="cb">${s.adjacent.map(a => `
        <div style="display:flex;gap:11px;align-items:flex-start;padding:11px 0;
          border-bottom:1px solid var(--line-2)">
          <span style="width:30px;height:30px;border-radius:9px;display:grid;place-items:center;
            flex:0 0 auto;background:${a.gap ? "var(--ok-l)" : "var(--bg)"};
            color:${a.gap ? C.ok : C.faint}">${ic(a.gap ? "star" : "info", 15)}</span>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px">${esc(a.cat)}</div>
            <div class="s2">${esc(a.note)}</div></div>
          <div style="text-align:right;flex:0 0 auto">
            <div class="num" style="font-weight:650;font-size:13px">${inrF(a.monthly)}</div>
            <div class="s2">a month</div></div>
        </div>`).join("")}
        <div class="note g" style="margin-top:12px">${ic("star", 15)}<div>
          <b>${inr(s.adjacent_total)} a month</b> is being spent by people already walking into your
          shop, on things you do not keep. Not every gap is worth filling — but you cannot decide
          that without knowing the number.</div></div>
      </div></div>
  </div>

  <div class="note mb" style="margin-top:14px">${ic("lock", 16)}<div>
    <b>How this stays safe.</b> Tracker never shows you a name, a number or one person's purchases.
    Every figure is an aggregate over at least 30 people, and anything smaller is withheld rather than
    rounded. You see that <i>${s.switchers.count} regulars</i> shifted spending — never which
    ones. Offers go out through Paytm, so the merchant never holds a customer's contact at all.</div></div>`;
}

/* ============================ CREDIT ============================= */
function vCredit() {
  const d = D(), cr = d.credit, cf = d.cashflow, f = F();
  const need = cf.peak_stock_need, have = Math.max(cf.net30, 0), gap = Math.max(0, need - have);
  const col = cr.band === "Prime" ? C.ok : cr.band === "Near-prime" ? C.pb
    : cr.band === "Watch" ? C.warn : C.bad;
  return `<div class="g g21 mb">
    <div class="card"><div class="ch"><div class="ct2">Pre-approved, nothing to fill in ${TAG.m()}
      <div class="cs">Worked out from ${nf(d.meta.days)} days of your own payments. No balance sheet,
        no ITR, no collateral, no shop visit.</div></div></div>
      <div class="cb"><div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center">
        <div style="text-align:center">
          ${gauge({ value: cr.score, min: 300, max: 900, color: col, label: cr.band,
            zones: [[0,.33,"#F6CFD1"],[.33,.55,"#F8E0BA"],[.55,.78,"#B9EAFA"],[.78,1,"#BCE8D7"]] })}
          <div class="s2">Tracker credit score</div></div>
        <div style="flex:1;min-width:230px">
          <div class="g g2" style="gap:11px">
            ${[["You can borrow", inr(cr.limit)], ["Interest", cr.rate + "% a year"],
               ["Over", cr.tenor_months + " months"], ["Monthly EMI", inrF(cr.emi)]]
              .map(([k, v]) => `<div style="padding:11px 13px;background:var(--bg);border-radius:var(--r-s)">
                <div class="kl" style="font-size:10px">${k}</div>
                <div class="num" style="font-size:19px;font-weight:690;margin-top:3px">${v}</div></div>`).join("")}
          </div>
          <div style="margin-top:12px;display:flex;gap:9px;flex-wrap:wrap">
            <button class="btn btn-p" onclick="act('Accept ' + '${inr(cr.limit)}','Paytm Business Loan')">
              Accept ${inr(cr.limit)}</button>
            <button class="btn btn-o" onclick="go('txn')">See why I need it</button></div>
          <div class="s2" style="margin-top:8px">EMI is
            ${(cr.emi / Math.max(f.gp30, 1) * 100).toFixed(0)}% of what you keep in a normal month.</div>
        </div>
      </div></div></div>

    <div class="card"><div class="ch"><div class="ct2">When you will need it
      <div class="cs">This is the part that matters, not the score.</div></div></div>
      <div class="cb">
        <div style="padding:13px;border-radius:var(--r-s);border-left:3px solid ${gap > 0 ? C.warn : C.ok};
          background:${gap > 0 ? "var(--warn-l)" : "var(--ok-l)"}">
          <div style="font-weight:650;font-size:13.5px">${gap > 0 ? "A gap is coming" : "No gap right now"}</div>
          <div style="font-size:12.5px;color:var(--ink-2);margin-top:5px;line-height:1.55">
            ${gap > 0 ? `Your heaviest stocking window is <b>${cf.peak_window_start}</b> to
              <b>${cf.peak_window_end}</b> and needs about ${inrF(need)}. You are projected to have
              ${inrF(have)}.` : `You are projected to have ${inrF(have)} against ${inrF(need)} of stock to buy.`}</div>
        </div>
        ${hBars({ rows: [{ label: "Stock to buy", v: need, color: C.warn },
          { label: "Cash you will have", v: have, color: C.pb },
          ...(gap > 0 ? [{ label: "Short by", v: gap, color: C.bad }] : [])], fmt: inrF })}
        <div class="hr"></div>
        <div style="font-size:12.5px;color:var(--ink-2);line-height:1.6">
          Shopkeepers rarely fail to get a loan. They fail because the money arrives
          <b>after</b> the festival. Tracker watches the forecast and raises this
          <b>10 to 14 days before</b> the squeeze.</div>
      </div></div>
  </div>

  <div class="g g2">
    <div class="card"><div class="ch"><div class="ct2">What was looked at ${TAG.m()}
      <div class="cs">All of it measured from your payments. None of it from a credit bureau.</div></div></div>
      <div class="cb">${cr.drivers.map(x => `
        <div style="display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--line-2)">
          <span style="width:22px;height:22px;border-radius:7px;display:grid;place-items:center;
            flex:0 0 auto;background:${x.good ? "var(--ok-l)" : "var(--bad-l)"};
            color:${x.good ? C.ok : C.bad}">${ic(x.good ? "check" : "alert", 13)}</span>
          <span style="flex:1;font-size:13px">${esc(x.f)}</span>
          <span class="num" style="font-weight:650;font-size:13.5px">${x.v}${
            /^[% ]/.test(x.unit) ? esc(x.unit) : " " + esc(x.unit)}</span></div>`).join("")}
        <div class="note" style="margin-top:13px">${ic("info", 15)}<div>
          A shop with no books and no borrowing history still has a year of payments nobody can fake.
          That turns out to carry most of the signal.</div></div>
      </div></div>

    <div class="card"><div class="ch"><div class="ct2">How the number was built
      <div class="cs">No model output goes to a lender untouched.</div></div></div>
      <div class="cb">
        ${[["Range check", (cr.clipped && cr.clipped.length) ? cr.clipped.length + " clipped" : "all in range",
            (cr.clipped && cr.clipped.length)
              ? cr.clipped.map(c => `${c.f} was ${c.raw}, scored at ${c.used}`).join("; ")
                + " — a model asked to work outside its training range returns a confident wrong answer"
              : "every input sits inside the range the model was trained on, so nothing had to be clipped"],
           ["What the model said", cr.pd_model + "% chance of default", "from payment behaviour alone"],
           ["Floor for this kind of shop", cr.floor + "%",
            "risk a payment stream genuinely cannot see — no audited books, family borrowing, tenancy"],
           ["What gets priced", cr.pd + "%", "the higher of the two, always"],
           ["Ceiling", inr(cr.cap), "before the risk haircut"],
           ["Final", inr(cr.limit), "ceiling × (1 − risk), rounded down"]]
          .map(([k, v, w]) => `<div style="padding:9px 0;border-bottom:1px solid var(--line-2)">
            <div style="display:flex;justify-content:space-between;gap:10px">
              <span style="font-weight:600;font-size:13px">${k}</span>
              <span class="num" style="font-weight:680">${v}</span></div>
            <div class="s2" style="margin-top:2px">${w}</div></div>`).join("")}
      </div></div>
  </div>`;
}

/* ============================= ABOUT ============================= */
function vAbout() {
  const d = D();
  return `<div class="note mb">${ic("info", 16)}<div>
    A demo that hides what is fake is worth less than one that says so. Here is exactly what is
    computed, what is assumed, and what is modelled.</div></div>

  <div class="g g3 mb">
    ${[["\u{1F7E6} Measured", "Added up or fitted from the transaction file. Reproducible — run the same maths on the same rows and you get the same answer.",
        "Earnings, trends, averages, peak hours, products, margins, the credit features", C.pb],
       ["\u{1F7E8} Guess", "A reasonable explanation Tracker cannot prove. Always labelled, never dressed up as fact.",
        "Why an unexplained dip happened, margin for a shop with no cost data", C.warn],
       ["\u{1F7EA} Simulated", "Modelled for this demo because the real feed is not wired up here.",
        "Everything on Your Share — the cross-merchant view", "#6A4FD8"]]
      .map(([t2, d2, w, c]) => `<div class="card"><div class="cb">
        <div style="font-weight:660;font-size:14px;color:${c}">${t2}</div>
        <div style="color:var(--ink-2);font-size:12.5px;margin-top:6px;line-height:1.55">${d2}</div>
        <div class="hr" style="margin:11px 0"></div>
        <div class="s2">${w}</div></div></div>`).join("")}
  </div>

  <div class="g g2 mb">
    <div class="card"><div class="ch"><div class="ct2">The data behind this demo</div></div>
      <div class="cb">${[
        ["Shop", d.merchant.name + " · " + d.merchant.city],
        ["Window", dLong(new Date(d.meta.day0 + "T00:00:00")) + " to " + dLong(new Date(d.meta.asof + "T00:00:00"))],
        ["Days", nf(d.meta.days)],
        [tracked() ? "Bills" : "Payments", nf(d.totals.bills || d.totals.txns)],
        ...(tracked() ? [["Line items", nf(d.totals.units)], ["Products", nf(d.merchant.skus)]] : []),
        ["Customers seen", nf(d.customers.total)],
        ["Money", inr(d.totals.revenue)],
      ].map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;
        border-bottom:1px solid var(--line-2);font-size:13px">
        <span style="color:var(--mut)">${k}</span><span class="num" style="font-weight:600">${v}</span></div>`).join("")}
        <div class="note w" style="margin-top:12px">${ic("info", 15)}<div>
          This shop is synthetic — generated with realistic weekday rhythm, salary-cycle bumps,
          festival spikes, monsoon effects, genuine dead stock and customers who lapse. It is not a
          real merchant's data, and no real merchant's data was used.</div></div>
      </div></div>

    <div class="card"><div class="ch"><div class="ct2">What Tracker refuses to do</div></div>
      <div class="cb">${[
        ["Invent what was sold", "For a shop with no billing, Products stays locked. A ₹140 payment carries no item and no model is run against it."],
        ["Call an estimate a fact", "Profit without cost data is labelled a guess on every screen it appears on."],
        ["Let a language model do arithmetic", "Every number is computed in code first. The assistant only puts those numbers into words, so it cannot invent one."],
        ["Show one customer", "Your Share aggregates over at least 30 people. Below that, the figure is withheld, not rounded."],
        ["Hand a raw model output to a lender", "A floor is applied for risk the data genuinely cannot see."],
      ].map(([k, v]) => `<div style="padding:10px 0;border-bottom:1px solid var(--line-2)">
        <div style="font-weight:620;font-size:13px">${k}</div>
        <div style="color:var(--ink-2);font-size:12.5px;margin-top:3px;line-height:1.5">${v}</div></div>`).join("")}
      </div></div>
  </div>

  <div class="card"><div class="ch"><div class="ct2">Models used, and what they scored</div></div>
    <div class="cb"><div class="tw"><table>
      <thead><tr><th>Model</th><th>Job</th><th class="r">Score</th><th>Against</th></tr></thead>
      <tbody>${(d.model_report || []).map(r => `<tr>
        <td class="nm">${esc(r.model)}<div class="s2">${esc(r.note)}</div></td>
        <td style="font-size:12.5px">${esc(r.task)}</td>
        <td class="r"><span class="num" style="font-weight:680">${esc(String(r.value))}</span>
          <div class="s2">${esc(r.metric)}</div></td>
        <td class="s2" style="max-width:250px">${esc(r.baseline)}</td></tr>`).join("")}
      </tbody></table></div></div></div>`;
}

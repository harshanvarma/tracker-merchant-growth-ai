/* ==================================================================
   Tracker — core: state, money formatting, icons, charts, languages
   ================================================================== */
const DB = { billing: window.__B__, nonbilling: window.__N__ };
const SH = { billing: window.__SB__, nonbilling: window.__SN__ };
const S = {
  who: "billing", tab: "today", lang: "en",
  setup: { step: 0, cat: null, sub: null, tracked: null },
  win: "day",            // transactions filter: day | week | month
  speak: true, chat: [],
};
const D = () => DB[S.who];
const SHARE = () => SH[S.who];
const tracked = () => S.who === "billing";

/* ------------------------------ money ----------------------------- */
const R = "₹";
function inr(n, dp) {
  if (n == null || isNaN(n)) return "—";
  const a = Math.abs(n), s = n < 0 ? "-" : "";
  if (a >= 1e7) return s + R + (a / 1e7).toFixed(dp ?? 2) + " Cr";
  if (a >= 1e5) return s + R + (a / 1e5).toFixed(dp ?? 2) + " L";
  return s + R + Math.round(a).toLocaleString("en-IN");
}
const inrF = n => (n == null || isNaN(n)) ? "—"
  : (n < 0 ? "-" : "") + R + Math.round(Math.abs(n)).toLocaleString("en-IN");
const nf = (n, d = 0) => (n == null || isNaN(n)) ? "—"
  : Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const pc = (n, d = 1) => (n == null || isNaN(n)) ? "—" : (n > 0 ? "+" : "") + n.toFixed(d) + "%";
const esc = s => String(s ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONFULL = ["January","February","March","April","May","June","July","August",
                 "September","October","November","December"];
const WDN = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const WDFULL = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
function dateAt(i) { const d = new Date(D().meta.day0 + "T00:00:00"); d.setDate(d.getDate() + i); return d; }
const dShort = d => d.getDate() + " " + MON[d.getMonth()];
const dLong = d => d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear();
const ymL = ym => MON[+ym.split("-")[1] - 1] + " " + ym.split("-")[0].slice(2);
const ymFull = ym => MONFULL[+ym.split("-")[1] - 1] + " " + ym.split("-")[0];

/* --------------------------- languages ---------------------------- */
const T = {
  en: { today:"Today", txn:"Transactions", trends:"Trends", low:"Low Earnings",
        avg:"Averages", prod:"Products", share:"Your Share", credit:"Credit",
        tracker:"Tracker", about:"About the data",
        measured:"Measured", guess:"Guess", simulated:"Simulated",
        number:"The number", means:"What it means", doit:"What to do",
        ask:"Ask me about your business", placeholder:"Ask in your own words…",
        evidence:"Show the numbers behind this", notsure:"I did not understand that",
        day:"Day", week:"Week", month:"Month",
        earned:"earned", lastmonth:"last month", thismonth:"this month",
        lastweek:"last week", today_w:"today", yesterday:"yesterday" },
  hi: { today:"आज", txn:"लेन-देन", trends:"रुझान", low:"कम कमाई",
        avg:"औसत", prod:"सामान", share:"आपका हिस्सा", credit:"लोन",
        tracker:"ट्रैकर", about:"डेटा के बारे में",
        measured:"मापा गया", guess:"अनुमान", simulated:"नकली डेटा",
        number:"आँकड़ा", means:"इसका मतलब", doit:"क्या करें",
        ask:"अपने धंधे के बारे में पूछिए", placeholder:"अपने शब्दों में पूछिए…",
        evidence:"इसके पीछे के आँकड़े देखें", notsure:"मैं समझ नहीं पाया",
        day:"दिन", week:"हफ़्ता", month:"महीना",
        earned:"कमाए", lastmonth:"पिछले महीने", thismonth:"इस महीने",
        lastweek:"पिछले हफ़्ते", today_w:"आज", yesterday:"कल" },
  te: { today:"ఈరోజు", txn:"లావాదేవీలు", trends:"ధోరణులు", low:"తక్కువ ఆదాయం",
        avg:"సగటు", prod:"వస్తువులు", share:"మీ వాటా", credit:"రుణం",
        tracker:"ట్రాకర్", about:"డేటా గురించి",
        measured:"కొలిచినది", guess:"అంచనా", simulated:"నకిలీ డేటా",
        number:"సంఖ్య", means:"దీని అర్థం", doit:"ఏం చేయాలి",
        ask:"మీ వ్యాపారం గురించి అడగండి", placeholder:"మీ మాటల్లో అడగండి…",
        evidence:"వెనుక ఉన్న సంఖ్యలు చూడండి", notsure:"నాకు అర్థం కాలేదు",
        day:"రోజు", week:"వారం", month:"నెల",
        earned:"సంపాదించారు", lastmonth:"గత నెల", thismonth:"ఈ నెల",
        lastweek:"గత వారం", today_w:"ఈరోజు", yesterday:"నిన్న" },
  ta: { today:"இன்று", txn:"பரிவர்த்தனைகள்", trends:"போக்குகள்", low:"குறைந்த வருமானம்",
        avg:"சராசரி", prod:"பொருட்கள்", share:"உங்கள் பங்கு", credit:"கடன்",
        tracker:"டிராக்கர்", about:"தரவு பற்றி",
        measured:"அளவிடப்பட்டது", guess:"யூகம்", simulated:"போலி தரவு",
        number:"எண்", means:"இதன் பொருள்", doit:"என்ன செய்வது",
        ask:"உங்கள் வணிகம் பற்றி கேளுங்கள்", placeholder:"உங்கள் வார்த்தைகளில் கேளுங்கள்…",
        evidence:"பின்னால் உள்ள எண்களைப் பார்க்க", notsure:"எனக்குப் புரியவில்லை",
        day:"நாள்", week:"வாரம்", month:"மாதம்",
        earned:"சம்பாதித்தீர்கள்", lastmonth:"கடந்த மாதம்", thismonth:"இந்த மாதம்",
        lastweek:"கடந்த வாரம்", today_w:"இன்று", yesterday:"நேற்று" },
};
const t = k => (T[S.lang] && T[S.lang][k]) || T.en[k] || k;
const VOICE = { en: "en-IN", hi: "hi-IN", te: "te-IN", ta: "ta-IN" };

/* ------------------------------ icons ----------------------------- */
const IC = {
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.6" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.6" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.6" cy="18" r="1.2" fill="currentColor" stroke="none"/>',
  trend:'<path d="M3 17l5-5 4 3 5-7 4 4"/>',
  down:'<path d="M3 7l5 5 4-3 5 7 4-4"/>',
  avg:'<path d="M3 12h18"/><path d="M6 8l3 8 3-10 3 8 3-6"/>',
  box:'<path d="M3 8l9-5 9 5v8l-9 5-9-5V8z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  pie:'<path d="M12 3a9 9 0 1 0 9 9h-9V3z"/>',
  cash:'<path d="M12 2v20"/><path d="M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.8c0 4.7 10 2.4 10 7.2 0 2.2-2.2 3.4-5 3.4s-5-1.2-5-3.1"/>',
  chat:'<path d="M21 11.5a8 8 0 0 1-8.5 8 9 9 0 0 1-3.8-.8L3 20.5l1.8-5.2A8 8 0 0 1 4 11.5a8 8 0 0 1 8.5-8 8 8 0 0 1 8.5 8z"/>',
  mic:'<rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M5 11.5a7 7 0 0 0 14 0"/><path d="M12 18.5V22"/>',
  vol:'<path d="M11 5 6.5 9H3v6h3.5L11 19V5z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a8 8 0 0 1 0 11"/>',
  mute:'<path d="M11 5 6.5 9H3v6h3.5L11 19V5z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
  send:'<path d="M21.5 2.5 11 13"/><path d="M21.5 2.5 15 21l-4-8-8-4 18.5-6.5z"/>',
  lock:'<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.2"/><path d="M8 10.5V7.4a4 4 0 0 1 8 0v3.1"/>',
  alert:'<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 9.5v4.5"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',
  clock:'<circle cx="12" cy="12" r="9.2"/><path d="M12 7.2V12l3.4 2"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 8.2a3 3 0 0 1 0 5.6"/><path d="M19 20a5.6 5.6 0 0 0-2.4-4.3"/>',
  star:'<path d="m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.3 6.4 20.3l1.2-6.3L3 9.6l6.3-.8L12 3z"/>',
  check:'<path d="M20 6.5 9.4 17.1 4 11.7"/>',
  info:'<circle cx="12" cy="12" r="9.2"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".95" fill="currentColor" stroke="none"/>',
  shop:'<path d="M3.5 9.5h17V20h-17z"/><path d="M2.5 9.5 5 4h14l2.5 5.5"/><path d="M9.5 20v-5.5h5V20"/>',
  qr:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4"/><path d="M14 14h2.5v2.5H14zM18.5 14H21v2.5h-2.5zM14 18.5h2.5V21H14zM18.5 18.5H21V21h-2.5z" fill="currentColor" stroke="none"/>',
  bill:'<path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2v-19z"/><path d="M9.5 8h5M9.5 12h5"/>',
  mega:'<path d="M3 11v2a1.5 1.5 0 0 0 1.5 1.5H7l6 4.5V5L7 9.5H4.5A1.5 1.5 0 0 0 3 11z"/><path d="M17 8.5a5 5 0 0 1 0 7"/>',
  gift:'<rect x="3" y="9" width="18" height="12" rx="1.6"/><path d="M3 13.5h18M12 9v12"/><path d="M12 9S9.5 4 7.5 5s.5 4 4.5 4zM12 9s2.5-5 4.5-4-.5 4-4.5 4z"/>',
  tag:'<path d="M20.6 12.6 12 21.2 3 12.2V3.4h8.8l8.8 8.8a1.4 1.4 0 0 1 0 .4z"/><circle cx="7.6" cy="7.6" r="1.4"/>',
};
const ic = (n, s = 17, w = 1.7) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ""}</svg>`;

/* ---------------------------- tag chips --------------------------- */
const TAG = {
  m: () => `<span class="tg tg-m">${ic("check", 10, 2.6)} ${t("measured")}</span>`,
  g: () => `<span class="tg tg-g">${ic("info", 10, 2.2)} ${t("guess")}</span>`,
  s: () => `<span class="tg tg-s">${ic("info", 10, 2.2)} ${t("simulated")}</span>`,
};

/* ----------------------------- tooltip ---------------------------- */
const TIP = () => document.getElementById("tip");
function tipOn(e, html) {
  const x = TIP(); x.innerHTML = html; x.classList.add("on");
  const r = x.getBoundingClientRect();
  let px = e.clientX + 13, py = e.clientY - r.height - 9;
  if (px + r.width > innerWidth - 8) px = e.clientX - r.width - 13;
  if (py < 6) py = e.clientY + 15;
  x.style.left = px + "px"; x.style.top = py + "px";
}
const tipOff = () => TIP().classList.remove("on");
addEventListener("scroll", tipOff, true);

/* ------------------------------ modal ----------------------------- */
function say(title, html) {
  document.getElementById("mdT").textContent = title;
  document.getElementById("mdB").innerHTML = html;
  document.getElementById("mask").classList.add("on");
}
const closeModal = () => document.getElementById("mask").classList.remove("on");
addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
window.say = say; window.closeModal = closeModal; window.tipOn = tipOn; window.tipOff = tipOff;

/* ============================= CHARTS ============================= */
const C = { pb: "#00BAF2", navy: "#002970", navy2: "#013E8F", ok: "#17A673",
            warn: "#E8921B", bad: "#E0393E", vio: "#6A4FD8", grey: "#A9B7CA" };
function niceMax(v) {
  if (v <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e;
}
function lineChart(o) {
  const W = o.w || 780, H = o.h || 230, ml = o.ml ?? 56, mr = o.mr ?? 12, mt = 10, mb = o.mb ?? 26;
  const iw = W - ml - mr, ih = H - mt - mb, all = [];
  o.series.forEach(s => s.data.forEach(v => v != null && all.push(v)));
  (o.band || []).forEach(b => { all.push(b[0]); all.push(b[1]); });
  const max = o.max ?? niceMax(Math.max(...all) * 1.05);
  const min = o.min ?? (Math.min(...all) < 0 ? -niceMax(-Math.min(...all)) : 0);
  const n = o.series[0].data.length;
  const X = i => ml + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const Y = v => mt + ih - ((v - min) / (max - min || 1)) * ih;
  let g = "", ticks = o.ticks ?? 4;
  for (let k = 0; k <= ticks; k++) {
    const v = min + (k / ticks) * (max - min), y = Y(v);
    g += `<line class="gl" x1="${ml}" y1="${y}" x2="${W - mr}" y2="${y}"/>
      <text class="ax" x="${ml - 8}" y="${y + 3.5}" text-anchor="end">${o.yFmt ? o.yFmt(v) : nf(v)}</text>`;
  }
  let band = "";
  if (o.band) {
    const up = o.band.map((b, i) => `${X(i)},${Y(b[1])}`).join(" ");
    const dn = o.band.map((b, i) => `${X(i)},${Y(b[0])}`).reverse().join(" ");
    band = `<polygon points="${up} ${dn}" fill="${o.bandColor || C.pb}" opacity=".15"/>`;
  }
  let p = "";
  o.series.forEach(s => {
    const pts = []; s.data.forEach((v, i) => { if (v != null) pts.push([X(i), Y(v)]); });
    if (!pts.length) return;
    const d = pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
    if (s.fill) p += `<path d="${d} L ${pts[pts.length - 1][0]} ${Y(min)} L ${pts[0][0]} ${Y(min)} Z"
      fill="${s.color}" opacity="${s.fillOp || .11}"/>`;
    p += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.w || 2.2}"
      stroke-linejoin="round" stroke-linecap="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""}/>`;
  });
  let mk = "";
  (o.marks || []).forEach(m => {
    const x = X(m.i);
    mk += `<line x1="${x}" y1="${mt}" x2="${x}" y2="${mt + ih}" stroke="${m.color || C.warn}"
      stroke-width="1.2" stroke-dasharray="3 3" opacity=".8"/>`;
    if (m.label) mk += `<text class="ax" x="${x}" y="${mt - 1}" text-anchor="middle"
      fill="${m.color || C.warn}" font-weight="650">${esc(m.label)}</text>`;
  });
  let xl = "", step = o.xStep || Math.max(1, Math.ceil(n / (o.xCount || 7)));
  for (let i = 0; i < n; i += step)
    xl += `<text class="ax" x="${X(i)}" y="${H - 7}" text-anchor="middle">${esc(o.labels[i] ?? "")}</text>`;
  if (o.lastLabel && n > 1)
    xl += `<text class="ax" x="${X(n - 1)}" y="${H - 7}" text-anchor="end">${esc(o.labels[n - 1])}</text>`;
  let hot = "";
  if (o.hover) {
    const bw = iw / Math.max(n - 1, 1);
    for (let i = 0; i < n; i++)
      hot += `<rect x="${X(i) - bw / 2}" y="${mt}" width="${bw}" height="${ih}" fill="transparent"
        onmousemove='tipOn(event,${JSON.stringify(o.hover(i)).replace(/'/g, "&apos;")})'
        onmouseleave="tipOff()"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">${g}${band}${p}${mk}${xl}${hot}</svg>`;
}
function barChart(o) {
  const W = o.w || 780, H = o.h || 210, ml = o.ml ?? 56, mr = 12, mt = 14, mb = 28;
  const iw = W - ml - mr, ih = H - mt - mb, n = o.data.length;
  const max = o.max ?? niceMax(Math.max(...o.data, 0) * 1.06);
  const mn = Math.min(0, ...o.data), lo = mn < 0 ? -niceMax(-mn) : 0;
  const Y = v => mt + ih - ((v - lo) / (max - lo || 1)) * ih;
  const bw = (iw / n) * (o.thick || .62), gap = iw / n;
  let g = "";
  for (let k = 0; k <= 4; k++) {
    const v = lo + (k / 4) * (max - lo), y = Y(v);
    g += `<line class="gl" x1="${ml}" y1="${y}" x2="${W - mr}" y2="${y}"/>
      <text class="ax" x="${ml - 8}" y="${y + 3.5}" text-anchor="end">${o.yFmt ? o.yFmt(v) : nf(v)}</text>`;
  }
  let b = "";
  o.data.forEach((v, i) => {
    const x = ml + i * gap + (gap - bw) / 2;
    const y = v >= 0 ? Y(v) : Y(0), h = Math.abs(Y(v) - Y(0));
    const col = o.colorFn ? o.colorFn(v, i) : C.pb;
    b += `<rect class="hb" x="${x}" y="${y}" width="${bw}" height="${Math.max(h, 1.5)}"
      rx="${o.r ?? 4}" fill="${col}"${o.hover ?
      ` onmousemove='tipOn(event,${JSON.stringify(o.hover(i)).replace(/'/g, "&apos;")})' onmouseleave="tipOff()"` : ""}/>`;
    if (o.valFmt) b += `<text class="ax" x="${x + bw / 2}" y="${y - 5}" text-anchor="middle"
      font-weight="620" fill="#36465C">${esc(o.valFmt(v, i))}</text>`;
    if (!o.xStep || i % o.xStep === 0)
      b += `<text class="ax" x="${x + bw / 2}" y="${H - 9}" text-anchor="middle">${esc(o.labels[i] ?? "")}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">${g}${b}</svg>`;
}
function hBars(o) {
  const max = niceMax(Math.max(...o.rows.map(r => Math.abs(r.v)), 1));
  return o.rows.map(r => `<div class="br">
    <div class="bl" title="${esc(r.label)}">${esc(r.label)}</div>
    <div class="bt2"><div class="bf" style="width:${(Math.abs(r.v) / max * 100).toFixed(1)}%;
      background:${r.color || C.pb}"></div></div>
    <div class="bv num">${o.fmt ? o.fmt(r.v) : inr(r.v)}</div></div>`).join("");
}
function ring(o) {
  const sz = o.size || 110, sw = o.sw || 10, r = (sz - sw) / 2, L = 2 * Math.PI * r;
  const f = clamp(o.value / (o.max || 100), 0, 1);
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">
    <circle cx="${sz/2}" cy="${sz/2}" r="${r}" fill="none" stroke="#E8EEF5" stroke-width="${sw}"/>
    <circle cx="${sz/2}" cy="${sz/2}" r="${r}" fill="none" stroke="${o.color}" stroke-width="${sw}"
      stroke-linecap="round" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - f)}"
      transform="rotate(-90 ${sz/2} ${sz/2})"/>
    <text x="${sz/2}" y="${sz/2 + (o.sub ? 0 : 6)}" text-anchor="middle" font-size="${o.vs || 24}"
      font-weight="700" fill="#0B1524" style="font-variant-numeric:tabular-nums">${esc(o.text ?? o.value)}</text>
    ${o.sub ? `<text x="${sz/2}" y="${sz/2 + 17}" text-anchor="middle" font-size="10.5"
      fill="#6B7A90" font-weight="600">${esc(o.sub)}</text>` : ""}</svg>`;
}
function gauge(o) {
  const W = 250, H = 142, cx = W / 2, cy = 120, r = 92, sw = 15;
  const f = clamp((o.value - o.min) / (o.max - o.min), 0, 1);
  const pol = a => [cx + r * Math.cos(Math.PI - Math.PI * a), cy - r * Math.sin(Math.PI - Math.PI * a)];
  const arc = (a0, a1, col) => { const [x0, y0] = pol(a0), [x1, y1] = pol(a1);
    return `<path d="M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}" fill="none" stroke="${col}"
      stroke-width="${sw}" stroke-linecap="round"/>`; };
  let s = arc(0, 1, "#E8EEF5");
  (o.zones || []).forEach(z => s += arc(z[0], z[1], z[2]));
  const [nx, ny] = pol(f);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:250px;height:auto">${s}
    <circle cx="${nx}" cy="${ny}" r="8.5" fill="#fff" stroke="${o.color}" stroke-width="4"/>
    <text x="${cx}" y="${cy - 32}" text-anchor="middle" font-size="36" font-weight="730"
      fill="#0B1524" style="font-variant-numeric:tabular-nums">${esc(o.value)}</text>
    <text x="${cx}" y="${cy - 13}" text-anchor="middle" font-size="12" font-weight="650"
      fill="${o.color}">${esc(o.label || "")}</text>
    <text class="ax" x="${cx - r}" y="${cy + 18}" text-anchor="middle">${esc(o.min)}</text>
    <text class="ax" x="${cx + r}" y="${cy + 18}" text-anchor="middle">${esc(o.max)}</text></svg>`;
}
function heatMap(o) {
  const cols = o.cols, rows = o.rows, m = o.matrix, W = 780;
  const cw = (W - 46) / cols.length, ch = 25, H = rows.length * ch + 26;
  const max = Math.max(...m.flat(), 1);
  let s = "";
  rows.forEach((rn, ri) => {
    s += `<text class="ax" x="38" y="${ri * ch + 17}" text-anchor="end" font-weight="600">${esc(rn)}</text>`;
    m[ri].forEach((v, ci) => {
      const q = v / max;
      const col = q < .02 ? "#F4F7FA"
        : `rgb(${Math.round(229 - 229 * q)},${Math.round(247 - 61 * q)},${Math.round(254 - 12 * q)})`;
      s += `<rect class="hb" x="${46 + ci * cw}" y="${ri * ch + 3}" width="${cw - 2.5}"
        height="${ch - 4.5}" rx="3.5" fill="${col}"
        onmousemove='tipOn(event,${JSON.stringify(`<b>${rn} · ${cols[ci]}:00</b><br>${inrF(v)}`).replace(/'/g, "&apos;")})'
        onmouseleave="tipOff()"/>`;
    });
  });
  cols.forEach((c, ci) => { if (ci % 2) return;
    s += `<text class="ax" x="${46 + ci * cw + cw / 2}" y="${rows.length * ch + 17}"
      text-anchor="middle">${c}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">${s}</svg>`;
}
function stackBar(segs, h = 14) {
  const tot = segs.reduce((a, s) => a + s.v, 0) || 1;
  return `<div style="display:flex;height:${h}px;border-radius:7px;overflow:hidden;gap:1.5px">
    ${segs.map(s => `<div title="${esc(s.label)}" style="width:${(s.v / tot * 100).toFixed(2)}%;
      background:${s.color}"></div>`).join("")}</div>`;
}
function spark(data, color = C.pb, w = 92, h = 26) {
  if (!data || !data.length) return "";
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const X = i => (i / Math.max(data.length - 1, 1)) * w;
  const Y = v => h - ((v - min) / Math.max(max - min, 1)) * (h - 3) - 1.5;
  const d = data.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" style="width:${w}px;height:${h}px">
    <path d="${d} L ${w} ${h} L 0 ${h} Z" fill="${color}" opacity=".13"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}

/* ------------------------- derived series ------------------------- */
function daily() {
  const d = D(), c = d.daily_cols;
  return d.daily.map(r => { const o = {}; c.forEach((k, i) => o[k] = r[i]); return o; });
}
function movAvg(a, k) {
  return a.map((_, i) => { const w = a.slice(Math.max(0, i - k + 1), i + 1);
    return w.reduce((x, y) => x + y, 0) / w.length; });
}
const sum = a => a.reduce((x, y) => x + y, 0);
const mean = a => a.length ? sum(a) / a.length : 0;
/* bills / txns, whichever this merchant has */
const txKey = () => tracked() ? "bills" : "txns";
function txOf(r) { return r.bills ?? r.txns ?? 0; }
/* margin: measured for billing, declared for non-billing */
function marginPct() {
  const d = D();
  if (tracked()) {
    const dl = daily().slice(-90);
    return (1 - sum(dl.map(x => x.cogs)) / sum(dl.map(x => x.revenue))) * 100;
  }
  return d.totals.declared_margin;
}
const marginIsMeasured = () => tracked();

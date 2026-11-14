/* ==================================================================
   Tracker — setup: category → subcategory → is billing tracked
   ================================================================== */
const CATS = {
  kirana: { e: "\u{1F6D2}", n: "Kirana / General", subs:
    ["General store", "Provision store", "Dairy & staples", "Organic / premium", "Mini supermarket"],
    peers: "kirana stores", margin: 12 },
  pharmacy: { e: "\u{1F48A}", n: "Pharmacy", subs:
    ["Retail chemist", "Hospital pharmacy", "Ayurvedic / homeopathy", "Surgical & devices"],
    peers: "chemists", margin: 20 },
  restaurant: { e: "\u{1F37D}", n: "Restaurant", subs:
    ["Dhaba", "Fast food", "Cafe", "Cloud kitchen", "Sweet shop / bakery", "Fine dining"],
    peers: "food outlets", margin: 62 },
  salon: { e: "\u{1F488}", n: "Salon & Spa", subs:
    ["Unisex salon", "Men's salon", "Beauty parlour", "Spa"], peers: "salons", margin: 70 },
  supermarket: { e: "\u{1F3EC}", n: "Supermarket", subs:
    ["Neighbourhood supermarket", "Departmental store", "Hypermarket"],
    peers: "supermarkets", margin: 15 },
  wholesale: { e: "\u{1F4E6}", n: "Wholesale", subs:
    ["FMCG distributor", "Grain & pulses", "Stationery", "Hardware", "Textile"],
    peers: "distributors", margin: 7 },
  services: { e: "\u{1F527}", n: "Services & Repair", subs:
    ["Mobile & electronics", "Electrical / plumbing", "Tailor", "Laundry", "Vehicle service"],
    peers: "service shops", margin: 45 },
  street: { e: "\u{1F375}", n: "Tea Stall / Street Food", subs:
    ["Tea stall", "Chaat & snacks", "Juice centre", "Tiffin centre", "Food cart"],
    peers: "tea and snack stalls", margin: 40 },
};
const STEPS = ["Business", "Type of shop", "How you sell"];

function setupRender() {
  const el = document.getElementById("scard");
  el.innerHTML = [sCat, sSub, sTracked][S.setup.step]();
}
const dots = i => `<div class="sdots">${STEPS.map((_, k) =>
  `<div class="sdot ${k === i ? "on" : k < i ? "done" : ""}"></div>`).join("")}</div>`;
const shead = (i, q, h) => dots(i)
  + `<div class="sstep">Step ${i + 1} of 3 · ${esc(STEPS[i])}</div>
     <div class="sq">${q}</div><div class="sh">${h}</div>`;
const sfoot = (back, ok, label) => `<div class="sfoot">
  ${back ? `<button class="btn btn-g" onclick="sBack()">← Back</button>`
         : `<button class="btn btn-g" onclick="skipDemo()">Skip — show me the demo</button>`}
  <button class="btn btn-p" ${ok ? "" : "disabled"} onclick="sNext()">${label || "Continue"}</button>
</div>`;

function sCat() {
  return shead(0, "What kind of business do you run?",
    "This decides which shops you get compared against, and which extra screens switch on.")
    + `<div class="cgrid">${Object.entries(CATS).map(([k, v]) =>
      `<button class="ct ${S.setup.cat === k ? "on" : ""}" onclick="pickCat('${k}')">
        <span class="ce">${v.e}</span><span class="cn">${v.n}</span></button>`).join("")}</div>`
    + sfoot(false, !!S.setup.cat);
}
function sSub() {
  const c = CATS[S.setup.cat];
  return shead(1, `What type of ${c.n.toLowerCase().replace(" & spa", "").replace(" / general", "")}?`,
    "Tracker compares you against shops of the same type, not against every merchant on Paytm.")
    + `<div class="subs">${c.subs.map(s =>
      `<button class="sub ${S.setup.sub === s ? "on" : ""}" onclick="pickSub('${esc(s)}')">${esc(s)}</button>`).join("")}</div>`
    + (S.setup.sub ? `<div class="note" style="margin-top:18px">${ic("users", 15)}
        <div>You will be benchmarked against <b>${esc(S.setup.sub.toLowerCase())}</b> ${c.peers}
        within 2 km — not against a supermarket or a chemist. A typical margin for this type is
        around <b>${c.margin}%</b>, which Tracker uses until it sees your real costs.</div></div>` : "")
    + sfoot(true, !!S.setup.sub);
}
function sTracked() {
  const T2 = S.setup.tracked;
  return shead(2, "Do you record what you sell?",
    "This is the one answer that changes how much Tracker can see. Both choices work — one just sees more.")
    + `<button class="bopt ${T2 === true ? "on" : ""}" onclick="pickTracked(true)">
        <span class="bi">${ic("bill", 20)}</span>
        <span><span class="bt">Yes — billing is tracked</span>
        <span class="bd">You make a bill, so the item, the price and the time are recorded.
        Tracker can show profit, what sells and exactly when it sells.</span></span></button>
      <button class="bopt ${T2 === false ? "on" : ""}" onclick="pickTracked(false)">
        <span class="bi">${ic("qr", 20)}</span>
        <span><span class="bt">No — billing is not tracked</span>
        <span class="bd">The customer scans and pays, nothing else is written down.
        Tracker works from payments alone: earnings, trends, your share and credit.</span></span></button>`
    + (T2 !== null ? `<div class="note ${T2 ? "g" : "w"}" style="margin-top:6px">
        ${ic(T2 ? "check" : "info", 15)}<div>${T2
        ? "All nine screens switch on, including <b>Products</b> — what sells most and at what hour."
        : "Eight screens switch on. <b>Products</b> stays locked, because a payment of ₹140 never says what was in the bag. Tracker will not guess it."}</div></div>` : "")
    + sfoot(true, T2 !== null, "Open Tracker →");
}

function pickCat(k) { S.setup.cat = k; S.setup.sub = null; setupRender(); }
function pickSub(s) { S.setup.sub = s; setupRender(); }
function pickTracked(v) { S.setup.tracked = v; setupRender(); }
function sNext() { S.setup.step = Math.min(2, S.setup.step + 1); setupRender(); }
function sBack() { S.setup.step = Math.max(0, S.setup.step - 1); setupRender(); }
window.pickCat = pickCat; window.pickSub = pickSub; window.pickTracked = pickTracked;
window.sNext = sNext; window.sBack = sBack;

function skipDemo() {
  S.setup = { step: 2, cat: "kirana", sub: "General store", tracked: true };
  enter();
}
window.skipDemo = skipDemo;

function enter() {
  if (S.setup.tracked === null) S.setup.tracked = true;
  S.who = S.setup.tracked ? "billing" : "nonbilling";
  document.getElementById("setup").classList.add("off");
  document.getElementById("app").classList.add("on");
  S.tab = "today";
  shell(); go("today");
}
window.enter = enter;
/* the Continue button on the last step finishes setup */
const _sNext = sNext;
sNext = function () {
  if (S.setup.step === 2) return enter();
  _sNext();
};
window.sNext = sNext;

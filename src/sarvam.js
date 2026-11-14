/* ==================================================================
   Tracker — Sarvam integration.

   Division of labour, and it matters:
     • Arithmetic   -> the deterministic engine, in code. Always.
     • Retrieval    -> BM25 over written-out facts, in code.
     • Language     -> sarvam-105b. Phrasing only, on supplied facts.
     • Speech in    -> saaras, any Indian language.
     • Speech out   -> bulbul, in the language that was spoken.

   The model is never asked what a number is. It is handed the numbers
   and asked to speak. If it is unreachable, the offline engine answers.
   ================================================================== */

const SV = {
  base: "https://api.sarvam.ai",
  chat: "sarvam-105b",
  tts: "bulbul:v3",
  stt: "saaras:v2.5",
  key: null,
  on: false,          // live mode
  busy: false,
  lastErr: null,
};
/* bulbul:v3 has its own speaker list; "anushka" (bulbul:v2) is rejected with a 400. */
const SPEAKER = { "en-IN": "priya", "hi-IN": "priya", "te-IN": "priya",
                  "ta-IN": "priya", "kn-IN": "priya", "ml-IN": "priya",
                  "mr-IN": "priya", "bn-IN": "priya", "gu-IN": "priya",
                  "pa-IN": "priya", "od-IN": "priya" };
const LANGNAME = { "en-IN": "English", "hi-IN": "Hindi", "te-IN": "Telugu", "ta-IN": "Tamil",
                   "kn-IN": "Kannada", "ml-IN": "Malayalam", "mr-IN": "Marathi",
                   "bn-IN": "Bengali", "gu-IN": "Gujarati", "pa-IN": "Punjabi" };

function svLoad() {
  try {
    const k = sessionStorage.getItem("sv_key");
    const b = sessionStorage.getItem("sv_base");
    if (b) SV.base = b;
    if (k) { SV.key = k; SV.on = true; }
  } catch (e) {}
}
function svSave(k, base) {
  SV.key = (k || "").trim();
  SV.base = (base || "https://api.sarvam.ai").replace(/\/+$/, "");
  SV.on = !!SV.key;
  try {
    if (SV.on) { sessionStorage.setItem("sv_key", SV.key); sessionStorage.setItem("sv_base", SV.base); }
    else { sessionStorage.removeItem("sv_key"); sessionStorage.removeItem("sv_base"); }
  } catch (e) {}
}
function svClear() { svSave("", ""); SV.lastErr = null; go("tracker"); }
window.svClear = svClear;

/* Served by proxy.js with SARVAM_KEY set? Then the key already lives on the
   server: talk to this origin and go live without asking for one. Silent
   no-op when opened as a file or from a static host. */
async function svDetectProxy() {
  if (SV.on || !/^https?:$/.test(location.protocol)) return;
  try {
    const r = await fetch("/__tracker", { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    if (j && j.proxy && j.key) {
      SV.base = location.origin;
      SV.key = "held-by-proxy";       // proxy.js replaces this with the real key
      SV.on = true;
    }
  } catch (e) {}
}
window.svDetectProxy = svDetectProxy;

async function svFetch(path, opts) {
  const r = await fetch(SV.base + path, {
    ...opts,
    headers: { "api-subscription-key": SV.key, ...(opts.headers || {}) },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`${r.status} ${r.statusText}${t ? " — " + t.slice(0, 200) : ""}`);
  }
  return r;
}

/* --------------------------- generation --------------------------- */
const SYS = `You are Tracker, a business assistant for a small Indian shopkeeper.

ABSOLUTE RULES — breaking any of these makes you useless:
1. Every number you state must appear in the FACTS or the VERIFIED ANSWER below. Never calculate, estimate, round differently, or invent a figure. If a number is not given to you, say you do not have it.
2. The VERIFIED ANSWER, when present, was computed in code from the shop's records. Use its figure exactly as given. Do not restate it differently.
3. A fact marked SIMULATED FIGURE is modelled for a demo, not measured. If you use one, say so plainly in the "means" field.
4. If the FACTS do not answer the question, say so. Never fill a gap with a guess.
5. Speak to a shopkeeper, not an analyst. Short sentences. No jargon, no bullet points, no markdown.

Reply with ONLY a JSON object, no other text:
{"value":"the single headline figure or name, very short",
 "sub":"a few words saying what it is and for what period",
 "means":"one or two sentences explaining what it means, with a comparison if the facts give one",
 "act":"one sentence on what the shopkeeper should actually do, or null if there is nothing to do",
 "tag":"m if every number came from measured records, s if you used a SIMULATED figure, g if any part is an estimate"}`;

function buildPrompt(q, det, chunks) {
  const lang = LANGNAME[VOICE[S.lang]] || "English";
  let p = `LANGUAGE: Write every field in ${lang}. Keep numbers in digits with the ₹ symbol.\n\n`;
  if (det) {
    p += `VERIFIED ANSWER (computed in code — use this figure exactly):\n`
      + `value: ${det.value}\nwhat it is: ${det.sub}\n`
      + (det.ev && det.ev.length ? `supporting rows:\n${det.ev.map(([k, v]) => `  ${k}: ${v}`).join("\n")}\n` : "")
      + `\n`;
  }
  p += `FACTS retrieved for this question:\n`
    + chunks.map((c, i) => `[${i + 1}] ${c.text}`).join("\n")
    + `\n\nQUESTION: ${q}\n`;
  return p;
}

async function svAsk(q) {
  const det = answer(parse(q));               // arithmetic first, always
  const chunks = retrieve(q, 8);
  const body = {
    model: SV.chat,
    messages: [{ role: "system", content: SYS },
               { role: "user", content: buildPrompt(q, det, chunks) }],
    temperature: 0.2,
    max_tokens: 700,
    // sarvam-105b reasons by default and spends the whole budget thinking,
    // returning content: null. It only turns off when sent explicitly as null.
    reasoning_effort: null,
    response_format: { type: "json_object" },
  };
  const r = await svFetch("/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  let txt = j.choices?.[0]?.message?.content || "";
  txt = txt.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const m = txt.match(/\{[\s\S]*\}/);
  const o = JSON.parse(m ? m[0] : txt);
  return {
    value: String(o.value ?? det?.value ?? "—"),
    sub: String(o.sub ?? det?.sub ?? ""),
    means: String(o.means ?? ""),
    act: o.act && String(o.act).toLowerCase() !== "null" ? String(o.act) : null,
    actTab: det?.actTab || null,
    tag: ["m", "s", "g"].includes(o.tag) ? o.tag : (det?.tag || "m"),
    ev: det?.ev || [],
    locked: det?.locked || false,
    live: true,
    used: chunks.map(c => c.id),
    verified: !!det,
  };
}

/* ------------------------------ speech ---------------------------- */
async function svSpeak(a, langCode) {
  const code = langCode || VOICE[S.lang] || "en-IN";
  const text = `${a.value}. ${a.sub}. ${a.means}${a.act ? " " + a.act : ""}`.slice(0, 1400);
  const r = await svFetch("/text-to-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text, target_language_code: code, model: SV.tts,
      speaker: SPEAKER[code] || "anushka", pace: 1.0,
    }),
  });
  const j = await r.json();
  const b64 = (j.audios && j.audios[0]) || j.audio;
  if (!b64) throw new Error("no audio returned");
  const au = new Audio("data:audio/wav;base64," + b64);
  au.play().catch(() => {});
  return au;
}

let MR = null, CHUNKS = [], RECING2 = false;
async function svListen() {
  const btn = document.getElementById("micBtn");
  if (RECING2) { try { MR.stop(); } catch (e) {} return; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    return micBlocked("The microphone is blocked here.");
  }
  CHUNKS = [];
  const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
  MR = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  MR.ondataavailable = e => e.data.size && CHUNKS.push(e.data);
  MR.onstart = () => { RECING2 = true; btn.classList.add("rec"); };
  MR.onstop = async () => {
    RECING2 = false; btn.classList.remove("rec");
    stream.getTracks().forEach(t2 => t2.stop());
    const blob = new Blob(CHUNKS, { type: mime || "audio/webm" });
    if (blob.size < 1200) return;
    S.chat.push({ me: true, text: "\u{1F399} …" });
    S.chat.push({ typing: true });
    renderFeed();
    try {
      const fd = new FormData();
      fd.append("file", blob, "q.webm");
      fd.append("model", SV.stt);
      const r = await svFetch("/speech-to-text-translate", { method: "POST", body: fd });
      const j = await r.json();
      const text = (j.transcript || j.text || "").trim();
      const srcLang = j.language_code || null;
      S.chat.pop();
      S.chat[S.chat.length - 1] = { me: true, text: text || "(nothing heard)", spoken: true,
                                    lang: srcLang };
      renderFeed();
      if (text) {
        if (srcLang && LANGNAME[srcLang]) {
          const ui = Object.keys(VOICE).find(k => VOICE[k] === srcLang);
          if (ui) { S.lang = ui; const sel = document.getElementById("langSel"); if (sel) sel.value = ui; }
        }
        askNow(text, srcLang);
      }
    } catch (e) {
      S.chat.pop();
      S.chat.push({ a: null, err: "Could not transcribe: " + e.message });
      renderFeed();
    }
  };
  MR.start();
  setTimeout(() => { if (RECING2) try { MR.stop(); } catch (e) {} }, 12000);
}

/* ------------------------- the key panel -------------------------- */
function svPanel() {
  if (SV.on) {
    return `<div class="card"><div class="cb">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="width:9px;height:9px;border-radius:50%;background:var(--ok);flex:0 0 auto"></span>
        <div style="font-weight:640;font-size:13px;flex:1">Sarvam is connected</div>
        <button class="btn btn-o btn-s" onclick="svClear()">Disconnect</button></div>
      <div class="s2" style="margin-top:7px;line-height:1.55">
        <b>${esc(SV.chat)}</b> writes the answer, <b>${esc(SV.stt)}</b> hears you in any Indian
        language, <b>${esc(SV.tts)}</b> speaks back. Every figure is still computed in code and handed
        to the model — it is never asked to do arithmetic.</div>
      ${SV.lastErr ? `<div class="note w" style="margin-top:9px">${ic("alert", 15)}
        <div><b>Last call failed.</b> ${esc(SV.lastErr)}<br>
        Tracker fell back to the offline engine, so answers still work.</div></div>` : ""}
      <div class="s2" style="margin-top:7px">Key is held in this tab only and never written into
        the page.</div>
    </div></div>`;
  }
  return `<div class="card"><div class="cb">
    <div style="font-weight:640;font-size:13px;margin-bottom:5px">Connect Sarvam for live AI</div>
    <div class="s2" style="line-height:1.55;margin-bottom:10px">
      Without a key Tracker answers from its built-in engine — accurate, but only the questions it
      was taught. With a key it understands open questions, replies in your language, and listens
      to speech.</div>
    <input id="svKey" type="password" placeholder="sk_..." autocomplete="off"
      style="width:100%;padding:10px 12px;border:1.5px solid var(--line);border-radius:9px;
      font-size:13px;font-family:var(--mono)">
    <input id="svBase" placeholder="https://api.sarvam.ai  (or your proxy)"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--line);border-radius:9px;
      font-size:12px;font-family:var(--mono);margin-top:7px">
    <button class="btn btn-b" style="width:100%;margin-top:9px"
      onclick="svConnect()">Connect</button>
    <div class="s2" style="margin-top:9px;line-height:1.5">
      Stored in this browser tab only. If the browser blocks the call (CORS), run the little proxy
      shipped alongside this file and put its address in the second box.</div>
  </div></div>`;
}
function svConnect() {
  const k = document.getElementById("svKey").value;
  const b = document.getElementById("svBase").value;
  if (!k.trim()) return;
  svSave(k, b);
  S.chat.push({ sys: "Sarvam connected. Ask me anything, or press the microphone and speak in your own language." });
  go("tracker");
}
window.svConnect = svConnect;
window.svLoad = svLoad;

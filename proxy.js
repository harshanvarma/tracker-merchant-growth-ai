#!/usr/bin/env node
/* ==================================================================
   Tracker — local server + Sarvam proxy.   Node 18+, no dependencies.

     node proxy.js                    serve the app, browser calls Sarvam directly
     SARVAM_KEY=sk_... node proxy.js   serve + proxy, key stays on this machine
     node proxy.js --mock              serve + fake Sarvam, for testing offline

   Why a proxy: a browser calling api.sarvam.ai directly may be refused by
   CORS, and anything in the page is readable by whoever opens it. With the
   proxy the key lives here, in your shell, and never reaches the browser.
   ================================================================== */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = +(process.env.PORT || 8000);
const KEY = process.env.SARVAM_KEY || "";
const MOCK = process.argv.includes("--mock");
const UPSTREAM = "api.sarvam.ai";
const FILE = process.argv.find(a => a.endsWith(".html")) || "index.html";
const SARVAM_PATHS = ["/v1/", "/v2/", "/text-to-speech", "/speech-to-text"];

/* a 0.2s silent wav, so mock TTS gives the player something real */
const SILENT_WAV = "UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";

function mock(req, res, body) {
  const u = req.url.split("?")[0];
  res.setHeader("Content-Type", "application/json");
  if (u.includes("chat/completions")) {
    let q = "", verified = null;
    try {
      const j = JSON.parse(body.toString());
      const user = j.messages.find(m => m.role === "user").content;
      q = (user.match(/QUESTION: (.*)$/m) || [, ""])[1];
      const v = user.match(/^value: (.*)$/m);
      verified = v ? v[1] : null;
    } catch (e) {}
    const out = {
      value: verified || "₹12,88,571",
      sub: "mock reply · last month",
      means: `This is the mock server, not a real model. It echoed the verified figure back so the chain can be tested without a key. Question was: ${q.slice(0, 90)}`,
      act: "Run without --mock and with a real key to see a genuine answer.",
      tag: "m",
    };
    res.end(JSON.stringify({
      id: "mock", object: "chat.completion", model: "sarvam-105b",
      choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(out) },
                  finish_reason: "stop" }],
    }));
    return;
  }
  if (u.includes("text-to-speech")) {
    res.end(JSON.stringify({ request_id: "mock", audios: [SILENT_WAV] }));
    return;
  }
  if (u.includes("speech-to-text")) {
    res.end(JSON.stringify({ request_id: "mock", transcript: "how much did I earn last month",
                             language_code: "hi-IN" }));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "mock has no route for " + u }));
}

function proxy(req, res, body) {
  if (!KEY) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      error: "No SARVAM_KEY set on the server. Start it with:  SARVAM_KEY=sk_... node proxy.js",
    }));
  }
  const headers = { ...req.headers, host: UPSTREAM, "api-subscription-key": KEY };
  delete headers["content-length"];
  delete headers.origin;
  delete headers.referer;
  if (body && body.length) headers["content-length"] = Buffer.byteLength(body);

  const up = https.request({ hostname: UPSTREAM, path: req.url, method: req.method, headers },
    r => {
      res.statusCode = r.statusCode;
      Object.entries(r.headers).forEach(([k, v]) => {
        if (!/^(transfer-encoding|connection|content-encoding)$/i.test(k)) res.setHeader(k, v);
      });
      r.pipe(res);
    });
  up.on("error", e => {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "upstream: " + e.message }));
  });
  if (body && body.length) up.write(body);
  up.end();
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript",
               ".css": "text/css", ".json": "application/json", ".csv": "text/csv" };

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }

  const u = req.url.split("?")[0];
  if (u === "/__tracker") {           // lets the app find this proxy and go live on its own
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ proxy: true, key: !!KEY || MOCK, mock: MOCK }));
  }
  if (SARVAM_PATHS.some(p => u.startsWith(p))) {
    const parts = [];
    req.on("data", c => parts.push(c));
    req.on("end", () => {
      const body = Buffer.concat(parts);
      console.log(`  ${req.method} ${u}  ${body.length} bytes  ${MOCK ? "[mock]" : "[upstream]"}`);
      (MOCK ? mock : proxy)(req, res, body);
    });
    return;
  }

  const name = u === "/" ? FILE : u.slice(1);
  const file = path.join(__dirname, name);
  if (!file.startsWith(__dirname) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404; return res.end("not found");
  }
  res.setHeader("Content-Type", MIME[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`\n  Tracker  ->  http://localhost:${PORT}`);
  console.log(`  serving  :  ${FILE}`);
  console.log(`  sarvam   :  ${MOCK ? "MOCK (no real calls)" : KEY ? "proxied, key held here" : "not proxied — put your key in the app, browser calls Sarvam directly"}`);
  console.log(`\n  In the app's Tracker tab, set the second box to  http://localhost:${PORT}\n`);
});

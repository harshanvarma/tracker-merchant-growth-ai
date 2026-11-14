# Tracker — Merchant Growth AI

**Paytm AI Hackathon · Track 1 — Merchant Growth AI**

> Paytm merchants already have an AI assistant. It answers when asked.
> **This one notices on its own, and tells them what it is costing them.**

An AI business partner that works for **every** merchant — the ones who record what
they sell and the ones who only take payments — and that cannot invent a number.

---

## The problem nobody else solved

Every other entry in this track assumes the shopkeeper already has a product list.
Most don't. A ₹140 UPI payment says that ₹140 arrived. It does not say a biscuit,
a milk packet and a soap were sold, and it does not say what they cost.

So Tracker splits at setup:

| | Billing tracked | Not tracked |
|---|---|---|
| Earnings, trends, averages | ✅ | ✅ |
| Why a week was bad | ✅ | ✅ |
| Credit score and timing | ✅ | ✅ |
| Your Share of the customer | ✅ | ✅ |
| **Profit per item** | ✅ | 🔒 locked |
| **What sells, and at what hour** | ✅ | 🔒 locked |
| **Reorder and dead stock** | ✅ | 🔒 locked |

The locked screens stay locked. They are **not** estimated from payments, because
they cannot be, and a confident wrong answer is worse than no answer.

---

## The nine screens

| Screen | What it does |
|---|---|
| **Today** | What is leaking money, ranked by rupees, each with an action that fires through a Paytm channel that already exists — Ads, Deals, Cashback, Business Loan |
| **Transactions** | Money received by day / week / month, and what was actually kept |
| **Trends** | Growth, weekday, hour, week × hour heatmap — everything against a reference |
| **Low Earnings** | Splits a drop into *how many people came* × *how much each spent*. Footfall problem or basket problem — different fixes |
| **Averages** | What counts as good, normal and slow for this shop, and whether the normal is drifting |
| **Products** | What sells and **when** — hour, day and month curve for every item |
| **Your Share** | What the merchant's own customers spend elsewhere. The one thing only Paytm could build |
| **Credit** | Pre-approved limit from payment history, and *when* the shortfall is coming |
| **Tracker** | Ask in your own words, by voice, in your own language |

---

## The twelve models

All validated against a baseline before shipping. Where a model lost to a simpler
method, the simpler method is what runs — and that is recorded too.

| Model | Job | Score | Beat |
|---|---|---|---|
| Holt-Winters (damped, weekly) | 30-day revenue forecast | **11.7% WAPE** | seasonal-naive 14.2% |
| HistGradientBoosting | per-SKU daily demand | **35.9% WAPE** | 7-day moving average 40.7% |
| Croston / TSB | intermittent demand | *rejected* | a robust mean won, so that ships |
| STL + robust z-score | anomaly detection | 18 days flagged | \|z\| ≥ 3.5 on MAD-scaled residual |
| FP-Growth | basket affinity | 22 rules | support ≥ 0.15%, lift ≥ 1.30 |
| Weighted log-log OLS | price elasticity | 35 SKUs | recovered within **0.52** of the true value |
| RFM | customer value and lapse | 517 segmented | top 20% hold 78% of revenue |
| HistGradientBoosting | credit risk | **AUC 0.825** | 16% base default rate |
| Newsvendor | safety stock | 95% service level | forecast over lead time + safety − on hand |
| Festival uplift | category lift | 10 categories | 28-day rolling median counterfactual |

Rolling-origin backtests or time-based holdouts throughout. Nothing is scored on
data it trained on.

---

## Quick start

```bash
git clone https://github.com/<you>/tracker-merchant-growth-ai
cd tracker-merchant-growth-ai
open index.html            # that's it — no build, no server
```

`index.html` is self-contained: all data, charts and the question engine are inside
it. Nothing is fetched.

### Rebuild everything from scratch

```bash
pip install -r requirements.txt
python pipeline/run_all.py      # ~60s
```

### Live AI (Sarvam)

The same `index.html` runs both ways. Without a key it answers from its built-in
engine; connect a key in the Tracker tab and it uses Sarvam for language and voice.

```bash
npm start                                  # browser holds the key
SARVAM_KEY=sk_... node proxy.js            # better — key stays on your machine
node proxy.js --mock                       # test the chain without spending credits
```

Then open http://localhost:8000, go to **Tracker**, and point the address box at
`http://localhost:8000`.

**No API key is committed to this repo, and none is baked into either HTML file.**

---

## How the chat works

The interesting part is what the model is *not* allowed to do.

```
question
   │
   ├─► deterministic engine ──► VERIFIED ANSWER   (arithmetic, in code)
   │
   └─► BM25 over 142 written-out facts ──► top 8 FACTS
                   │
                   ▼
            sarvam-105b  ── writes the sentence, in the user's language
                   │
                   ▼
   { value · what it means · what to do · measured|guess|simulated }
```

The model is handed the numbers. It is **never asked what a number is**. If it is
unreachable, the deterministic engine answers on its own and says so.

| Layer | What runs it |
|---|---|
| Arithmetic | code — always |
| Retrieval | BM25 over the fact base, in the browser |
| Language | `sarvam-105b` |
| Hearing you | `saaras` via `/speech-to-text-translate` — any Indian language |
| Speaking back | `bulbul:v3`, in the language you spoke |

Without a key it still works: the built-in engine answers, just only the questions
it was taught.

---

## Every claim is tagged

| | |
|---|---|
| 🟦 **Measured** | added up or fitted from the records — reproducible |
| 🟨 **Guess** | a reasonable explanation it cannot prove, always labelled |
| 🟪 **Simulated** | modelled for this demo — the whole of *Your Share* |

---

## Layout

```
index.html              the whole app, one self-contained file
proxy.js                local server + Sarvam proxy + mock mode

pipeline/
  run_all.py            rebuilds everything, in order
  generate_data.py      a year of synthetic bills and payments
  analytics.py          twelve models, billing merchant
  analytics_nonbilling.py   payments-only merchant
  enrich.py             per-product timing
  share.py              cross-merchant view (simulated)
  build.py              assembles the single-file app

src/                    the app, before bundling
  core.js               formatting, charts, languages
  setup.js              category → subcategory → billing
  views.js / views2.js  the nine screens
  rag.js                fact base + BM25 retrieval
  sarvam.js             Sarvam chat, speech-to-text, text-to-speech
  tracker.js            question parser and chat

app/                    computed intelligence (JSON)
data/                   source CSVs (30-day samples committed; see below)
qa/                     browser tests
```

### A note on the data

The full dataset is 61,293 bills over 364 days — 25 MB of CSV, too large to be
worth committing. The repo carries 30-day samples so you can see the exact input
format, and `python pipeline/run_all.py` regenerates the full set from seed in
about 25 seconds.

```
data/kirana_products.csv            129 SKUs: cost, MRP, pack size, category
data/kirana_stock.csv               current stock on hand
data/kirana_bills_sample.csv        30 days of itemised bills   (committed)
data/teastall_payments_sample.csv   5,000 UPI payments          (committed)
data/kirana_bills.csv               full 364 days               (generated)
data/teastall_payments.csv          full 364 days               (generated)
```

The data is synthetic because real merchant bills are not public. It is built to
be hard rather than flattering: real festival spikes, salary-cycle weeks, monsoon
dips, genuine basket affinity, and real price variation during promotions. The
models have to actually find the signal. `pipeline/generate_data.py` writes a
ground-truth elasticity file that `analytics.py` never reads — it exists only so
the elasticity estimates can be scored against the truth afterwards.

---

## Tests

```bash
pip install playwright && playwright install chromium
python qa/qa.py          # all screens, both merchants, 21 questions
node proxy.js --mock &
python qa/qa_live.py     # knowledge base, retrieval, live path, fallback
```

`qa.py` also checks every Tracker answer against the source CSV. They reconcile to
the rupee.

---

## Honesty

The merchant is synthetic — generated with weekday rhythm, salary-cycle bumps,
festival spikes, monsoon effects, real dead stock and customers who lapse. **No real
merchant's data was used.** The app says so on its own *About the data* screen rather
than hiding it.

*Your Share* is the one screen that is modelled rather than computed, because the
cross-merchant feed is not wired up here. It is labelled SIMULATED on every figure.

---

## Licence

MIT

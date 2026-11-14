import asyncio, os, json, re
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
URL = "file://" + os.path.join(ROOT, "index.html")
SHOT = os.path.join(HERE, "shots"); os.makedirs(SHOT, exist_ok=True)
TABS = ["today","txn","trends","low","avg","prod","share","credit","tracker","about"]
ERR = []

QUESTIONS = [
    "How much did I earn last month?",
    "How much did I earn today?",
    "What did I make this month?",
    "Which day is my worst?",
    "Which day is my best?",
    "What is my busiest hour?",
    "What is a normal day for me?",
    "Why was last week bad?",
    "What sells most?",
    "What is not selling?",
    "When does Amul Taaza Milk sell most?",
    "How much loan can I get?",
    "What is my share of my customers?",
    "How many customers do I have?",
    "What was my profit last month?",
    "How many bills last week?",
    "What sold most in October?",
    "pichle mahine kitna kamaya",
    "sabse zyada kya bika",
    "konsa din sabse kharab hai",
    "what is the colour of the sky",
]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome",
                                    args=["--no-sandbox","--disable-dev-shm-usage"])
        pg = await b.new_page(viewport={"width":1500,"height":1000}, device_scale_factor=1.5)
        pg.on("pageerror", lambda e: ERR.append(("pageerror", str(e))))
        pg.on("console", lambda m: ERR.append(("console", m.text)) if m.type=="error" else None)
        await pg.goto(URL, wait_until="load"); await pg.wait_for_timeout(400)

        # ---- setup walkthrough ----
        await pg.screenshot(path=f"{SHOT}/s0.png")
        await pg.click(".ct:has-text('Kirana')"); await pg.wait_for_timeout(150)
        await pg.click("#scard .btn-p"); await pg.wait_for_timeout(250)
        await pg.screenshot(path=f"{SHOT}/s1.png")
        await pg.click(".sub:has-text('General store')"); await pg.wait_for_timeout(200)
        await pg.click("#scard .btn-p"); await pg.wait_for_timeout(250)
        await pg.screenshot(path=f"{SHOT}/s2.png")
        await pg.click(".bopt:has-text('Yes')"); await pg.wait_for_timeout(250)
        await pg.screenshot(path=f"{SHOT}/s3.png")
        await pg.click("#scard .btn-p"); await pg.wait_for_timeout(700)
        print("  entered app:", await pg.evaluate("S.who"))

        # ---- all tabs, billing ----
        for t in TABS:
            await pg.evaluate(f"go('{t}')"); await pg.wait_for_timeout(420)
            bad = await pg.evaluate(
                "(document.getElementById('view').innerText.match(/undefined|NaN|Infinity|\\[object Object\\]/g)||[]).length")
            ln = await pg.evaluate("document.getElementById('view').innerHTML.length")
            print(f"  billing/{t:<9} len={ln:>7} bad={bad}")
            if bad: ERR.append(("content", f"billing/{t}: {bad}"))
            await pg.screenshot(path=f"{SHOT}/b_{t}.png", full_page=True)

        # ---- tracker questions ----
        print("\n  --- tracker (billing) ---")
        await pg.evaluate("go('tracker')"); await pg.wait_for_timeout(350)
        answers = {}
        for q in QUESTIONS:
            await pg.evaluate("S.chat=[{greet:true}];renderFeed()")
            await pg.evaluate(f"ask({json.dumps(q)})")
            await pg.wait_for_timeout(680)
            a = await pg.evaluate("S.chat[S.chat.length-1].a")
            if a is None:
                print(f"    [no match] {q}")
                answers[q] = None
                if q != "what is the colour of the sky":
                    ERR.append(("parse", f"no intent: {q}"))
            else:
                answers[q] = {"value": a["value"], "sub": a["sub"], "tag": a["tag"]}
                print(f"    {a['tag']}  {q[:42]:<42} -> {a['value']}  ({a['sub'][:40]})")
                txt = json.dumps(a)
                if re.search(r"undefined|NaN|Infinity", txt):
                    ERR.append(("answer", f"bad token in: {q} -> {txt[:160]}"))
        json.dump(answers, open(f"{HERE}/qa_answers.json","w"), indent=1)
        await pg.evaluate("S.chat=[{greet:true}];ask('How much did I earn last month?')")
        await pg.wait_for_timeout(800)
        await pg.screenshot(path=f"{SHOT}/tracker_answer.png")

        # ---- language switch ----
        for lg in ["hi","te","ta"]:
            await pg.evaluate(f"setLang('{lg}')"); await pg.wait_for_timeout(300)
            tabtext = await pg.evaluate("document.getElementById('tabs').innerText.replace(/\\n/g,' | ')")
            print(f"  lang {lg}: {tabtext[:78]}")
        await pg.evaluate("setLang('en')"); await pg.wait_for_timeout(200)

        # ---- non-billing ----
        print("\n  --- non-billing ---")
        await pg.evaluate("switchMerchant()"); await pg.wait_for_timeout(500)
        for t in TABS:
            await pg.evaluate(f"go('{t}')"); await pg.wait_for_timeout(380)
            bad = await pg.evaluate(
                "(document.getElementById('view').innerText.match(/undefined|NaN|Infinity|\\[object Object\\]/g)||[]).length")
            print(f"  nonbill/{t:<9} bad={bad}")
            if bad: ERR.append(("content", f"nonbilling/{t}: {bad}"))
            await pg.screenshot(path=f"{SHOT}/n_{t}.png", full_page=True)
        # product question must be refused, not invented
        await pg.evaluate("go('tracker')"); await pg.wait_for_timeout(300)
        await pg.evaluate("S.chat=[{greet:true}];ask('What sells most?')")
        await pg.wait_for_timeout(700)
        a = await pg.evaluate("S.chat[S.chat.length-1].a")
        print(f"  non-billing 'what sells most' -> {a['value']!r} locked={a.get('locked')}")
        if not a.get("locked"): ERR.append(("logic","non-billing answered a product question"))
        await pg.screenshot(path=f"{SHOT}/n_tracker_locked.png")

        await b.close()

asyncio.run(main())
print("\n" + "="*64)
if ERR:
    seen=set()
    for k,m in ERR:
        key=(k,m[:110])
        if key in seen: continue
        seen.add(key); print(f"  [{k}] {m[:240]}")
    print(f"\n  {len(seen)} unique issue(s)")
else:
    print("  CLEAN — no errors, no bad tokens, every question parsed")
print("="*64)

import asyncio, json, os
from playwright.async_api import async_playwright

URL = "http://localhost:8000/"
ERR = []

RETRIEVAL_TESTS = [
    ("how much did I earn last month", ["period", "month"]),
    ("which day is my worst", ["wd", "wdsum"]),
    ("what sells most", ["prodsum", "p"]),
    ("when does milk sell most", ["sku:"]),
    ("why was last week bad", ["worstweek", "week"]),
    ("how much loan can I get", ["credit"]),
    ("am I losing customers to blinkit", ["switch", "share"]),
    ("what is my busiest hour", ["hours", "hr"]),
    ("what is not selling", ["dead"]),
    ("how many customers do I have", ["cust"]),
    ("what are my fixed costs", ["exp"]),
    ("should I stock anything new", ["adj", "share"]),
]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome",
                                    args=["--no-sandbox", "--use-fake-ui-for-media-stream",
                                          "--use-fake-device-for-media-stream"])
        ctx = await b.new_context(permissions=["microphone"])
        pg = await ctx.new_page()
        pg.on("pageerror", lambda e: ERR.append(("pageerror", str(e))))
        await pg.route("**/favicon.ico", lambda r: r.fulfill(status=204))
        pg.on("console", lambda m: ERR.append(("console", m.text))
       if m.type == "error" and "favicon" not in m.text and "CONNECTION_REFUSED" not in m.text
       and "UNSAFE_PORT" not in m.text else None)
        await pg.goto(URL, wait_until="load"); await pg.wait_for_timeout(500)
        await pg.evaluate("skipDemo()"); await pg.wait_for_timeout(600)

        # ---------- knowledge base ----------
        n = await pg.evaluate("kb().length")
        topics = await pg.evaluate("[...new Set(kb().map(x=>x.topic))]")
        chars = await pg.evaluate("kb().reduce((a,x)=>a+x.text.length,0)")
        print(f"  knowledge base : {n} facts, {chars:,} chars, topics: {', '.join(topics)}")
        if n < 100: ERR.append(("kb", f"only {n} facts"))

        # ---------- retrieval quality ----------
        print("\n  --- retrieval ---")
        for q, want in RETRIEVAL_TESTS:
            ids = await pg.evaluate(f"retrieve({json.dumps(q)},5).map(x=>x.id)")
            hit = any(any(i.startswith(w) for w in want) for i in ids)
            print(f"    {'OK ' if hit else 'XX '} {q[:40]:<40} -> {', '.join(ids[:4])}")
            if not hit: ERR.append(("retrieval", f"{q} -> {ids}"))

        # ---------- connect to the mock ----------
        await pg.evaluate("go('tracker')"); await pg.wait_for_timeout(300)
        await pg.fill("#svKey", "sk_test_mock")
        await pg.fill("#svBase", "http://localhost:8000")
        await pg.click("button:has-text('Connect')")
        await pg.wait_for_timeout(600)
        on = await pg.evaluate("SV.on")
        print(f"\n  sarvam connected: {on}  base={await pg.evaluate('SV.base')}")

        # ---------- live answer path ----------
        print("\n  --- live answers (through mock) ---")
        for q in ["How much did I earn last month?", "Which day is my worst?",
                  "What sells most and when?", "Am I losing customers to quick commerce?"]:
            await pg.evaluate("S.chat=[{greet:true}]")
            await pg.evaluate(f"ask({json.dumps(q)})")
            await pg.wait_for_timeout(1400)
            a = await pg.evaluate("S.chat[S.chat.length-1].a")
            if not a:
                print(f"    XX {q} -> no answer"); ERR.append(("live", q)); continue
            print(f"    {'OK ' if a.get('live') else 'XX '} {q[:38]:<38} live={a.get('live')} "
                  f"verified={a.get('verified')} facts={len(a.get('used') or [])} -> {a['value']}")
            if not a.get("live"): ERR.append(("live", f"{q} fell back: {a.get('degraded')}"))

        # ---------- the prompt actually sent ----------
        prompt = await pg.evaluate("""(async()=>{
            const q='How much did I earn last month?';
            const det=answer(parse(q)); const ch=retrieve(q,8);
            return buildPrompt(q,det,ch);})()""")
        print(f"\n  --- prompt sent to the model ({len(prompt)} chars) ---")
        for line in prompt.split("\n")[:14]:
            print("    " + line[:120])
        print("    ...")
        assert "VERIFIED ANSWER" in prompt, "verified answer missing from prompt"
        assert "FACTS retrieved" in prompt, "facts missing from prompt"
        print(f"    contains verified computation: {'VERIFIED ANSWER' in prompt}")
        print(f"    retrieved facts in prompt    : {prompt.count('[') }")

        # ---------- TTS ----------
        played = await pg.evaluate("""(async()=>{ try{
            await svSpeak({value:'test',sub:'x',means:'y',act:null},'hi-IN'); return 'ok';
          }catch(e){ return 'ERR '+e.message; } })()""")
        print(f"\n  tts through mock: {played}")
        if played != "ok": ERR.append(("tts", played))

        # ---------- degraded path ----------
        await pg.evaluate("SV.base='http://127.0.0.1:9099'")   # nothing listening
        await pg.evaluate("S.chat=[];ask('How much did I earn last month?')")
        await pg.wait_for_timeout(1800)
        a = await pg.evaluate("S.chat[S.chat.length-1].a")
        print(f"  model unreachable -> answered anyway: {bool(a)}  value={a and a['value']}  "
              f"degraded={bool(a and a.get('degraded'))}")
        if not a: ERR.append(("fallback", "no answer when model unreachable"))
        await pg.evaluate("SV.base='http://localhost:8000'")

        await pg.evaluate("go('tracker')"); await pg.wait_for_timeout(300)
        await pg.evaluate("S.chat=[{greet:true}];ask('What sells most and when?')")
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path="shots/live_tracker.png", full_page=True)
        await b.close()

asyncio.run(main())
print("\n" + "=" * 64)
if ERR:
    seen = set()
    for k, m in ERR:
        key = (k, m[:100])
        if key in seen: continue
        seen.add(key); print(f"  [{k}] {m[:200]}")
    print(f"\n  {len(seen)} issue(s)")
else:
    print("  CLEAN — kb built, retrieval on target, live path works, fallback works")
print("=" * 64)

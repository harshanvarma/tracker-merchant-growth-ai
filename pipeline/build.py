"""Assemble the single-file Tracker app."""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.join(ROOT, "app")
SRC = os.path.join(ROOT, "src")
rd = lambda f: open(os.path.join(SRC, f), encoding="utf-8").read()
jd = lambda f: json.dumps(json.load(open(os.path.join(HERE, f), encoding="utf-8")),
                          separators=(",", ":"))

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tracker — Merchant Growth AI</title>
<meta name="description" content="An AI business partner for every Paytm merchant. Works with or
without billing data, tells you what to do, and cannot invent a number.">
<style>
{rd("styles.css")}
</style>
</head>
<body>
{rd("body.html")}
<script>
window.__B__={jd("intelligence.json")};
window.__N__={jd("intelligence_nonbilling.json")};
window.__SB__={jd("share_billing.json")};
window.__SN__={jd("share_nonbilling.json")};
</script>
<script>
{rd("core.js")}
</script>
<script>
{rd("setup.js")}
</script>
<script>
{rd("views.js")}
</script>
<script>
{rd("views2.js")}
</script>
<script>
{rd("rag.js")}
</script>
<script>
{rd("sarvam.js")}
</script>
<script>
{rd("tracker.js")}
</script>
<script>
svLoad();
svDetectProxy();
setupRender();
</script>
</body>
</html>
"""
out = os.path.join(ROOT, os.environ.get("OUT", "index.html"))
open(out, "w", encoding="utf-8").write(html)
print(f"built {out} — {len(html)/1e6:.2f} MB")

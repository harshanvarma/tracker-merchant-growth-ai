#!/usr/bin/env python3
"""
Rebuild everything from nothing.

    python pipeline/run_all.py

Runs, in order:
  1. generate_data      synthetic merchant data (a year of bills and payments)
  2. analytics          twelve models over the billing merchant
  3. analytics_nonbill  the payments-only merchant
  4. enrich             per-product timing: which hour, day and month each item sells
  5. share              the simulated cross-merchant view
  6. build              assemble the single-file index.html

Takes about a minute. Every number in the app comes out of these six steps.
"""
import subprocess, sys, os, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

STEPS = [
    ("generate_data.py", "synthetic merchant data", {}),
    ("analytics.py", "models — billing merchant", {}),
    ("analytics_nonbilling.py", "models — non-billing merchant", {}),
    ("enrich.py", "per-product timing", {}),
    ("share.py", "cross-merchant view (simulated)", {}),
    ("build.py", "build index.html", {}),
]

def main():
    t0 = time.time()
    for i, (script, label, env) in enumerate(STEPS, 1):
        print(f"\n[{i}/{len(STEPS)}] {label}")
        print("-" * 60)
        e = dict(os.environ, **env)
        r = subprocess.run([sys.executable, "-I", os.path.join(HERE, script)],
                           env=e, cwd=ROOT)
        if r.returncode != 0:
            print(f"\nFAILED at {script}")
            sys.exit(r.returncode)
    print("\n" + "=" * 60)
    print(f"done in {time.time() - t0:.0f}s")
    for f in ("index.html",):
        p = os.path.join(ROOT, f)
        if os.path.exists(p):
            print(f"  {f:<22} {os.path.getsize(p)/1e6:.2f} MB")
    print("=" * 60)
    print("\nOpen index.html in a browser, or:  node proxy.js")

if __name__ == "__main__":
    main()

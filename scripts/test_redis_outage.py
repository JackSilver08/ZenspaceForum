"""Verify the API remains responsive while optional Redis is stopped."""
from urllib.request import urlopen
import json
import time
base = "http://127.0.0.1:8081"
started=time.monotonic()
with urlopen(base + "/api/camxuc/thongke/1", timeout=4) as res:
    assert res.status==200
    counts=json.load(res)
    assert isinstance(counts,dict)
elapsed=time.monotonic()-started
assert elapsed<2.0, f"Redis outage stalled reaction API: {elapsed:.2f}s"
with urlopen(base + "/api/baiviet", timeout=4) as res:
    posts=json.load(res)
assert posts["success"] and isinstance(posts["data"][0]["reactions"],dict)
print(f"Redis-down fallback OK ({elapsed:.3f}s); MySQL and feed remain available")

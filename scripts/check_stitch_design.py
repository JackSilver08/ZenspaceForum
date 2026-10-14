"""Check primary design contracts derived from the user's Stitch handoff."""
from pathlib import Path
web = Path("apps/web")
tokens = (web / "src/styles/tokens.css").read_text(encoding="utf-8")
shell = (web / "src/components/layout/AppShell.jsx").read_text(encoding="utf-8")
feed = (web / "src/features/feed/FeedPage.jsx").read_text(encoding="utf-8")
files = [tokens, shell, feed, (web / "src/styles/global.css").read_text(encoding="utf-8")]
assert "#fbf9f6" in tokens.lower(), "Milk-white surface missing"
assert "#4b3a82" in tokens.lower(), "Deep violet accent missing"
assert "color-scheme: light" in tokens, "Browser color theme must be light"
assert "zs-hero-orbits" in feed, "Astronomy hero artwork missing"
assert "zs-post-card" in feed and "zs-composer" in feed
assert "api('/baiviet?limit=3')" in shell, "Use real recent posts instead of sample users"
assert "api(following ? '/v1/feed' : '/baiviet'" in feed, "Live feed API must remain"
assert "lh3.googleusercontent.com/aida-public" not in "\n".join(files), "Do not ship Stitch's demo image URLs"
assert "24.8k" not in "\n".join(files), "Do not ship invented user metrics"
print("Stitch Light design contract OK")

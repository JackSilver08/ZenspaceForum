"""Stitch Cosmic Atelier identity tests, updated for the UX review's feed-first layout."""
from pathlib import Path
web = Path("apps/web")
tokens = (web / "src/styles/tokens.css").read_text(encoding="utf-8")
shell = (web / "src/components/layout/AppShell.jsx").read_text(encoding="utf-8")
feed = (web / "src/features/feed/FeedPage.jsx").read_text(encoding="utf-8")
css = (web / "src/styles/ux-audit.css").read_text(encoding="utf-8")
files = [tokens, shell, feed, css, (web / "src/styles/global.css").read_text(encoding="utf-8")]
assert "#fbf9f6" in tokens.lower(), "Stitch ivory base token missing"
assert "#4b3a82" in tokens.lower(), "Stitch deep violet accent missing"
assert "color-scheme: light" in tokens, "Expected light theme"
assert "zs-feed-heading" in feed, "Compact editorial heading missing"
assert "zs-feed-emblem" in feed, "Subtle orbital branding missing"
assert "zs-post-card" in feed and "zs-composer" in feed, "Required social components missing"
assert "api('/timkiemnguoidung')" in shell, "Suggestions must come from real API"
assert "api(following ? '/v1/feed' : '/baiviet'" in feed, "Live feed data integration missing"
assert "lh3.googleusercontent.com/aida-public" not in "\n".join(files), "Remote Stitch demo image URL forbidden"
assert "24.8k" not in "\n".join(files), "Hard-coded fantasy product stats forbidden"
print("Stitch visual identity + live API contract OK")

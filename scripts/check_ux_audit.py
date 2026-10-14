"""Guard the structural P0/P1 goals of ZenSpace's user-supplied UX review.

These are source-level regression contracts, not a substitute for usability testing.
See docs/UX-AUDIT-REDESIGN-2026-10.md for manual acceptance tasks.
"""
from pathlib import Path

web = Path("apps/web/src")
app = (web / "components/layout/AppShell.jsx").read_text(encoding="utf-8")
feed = (web / "features/feed/FeedPage.jsx").read_text(encoding="utf-8")
main = (web / "main.jsx").read_text(encoding="utf-8")
css = (web / "styles/ux-audit.css").read_text(encoding="utf-8")

# Page IA – Following is a destination, not a duplicate tab of Explore.
assert 'to: \'/following\'' in app and 'to: \'/explore\'' in app
assert 'path="/following"' in main and 'feedMode="following"' in main
assert 'zs-feed-tabs' not in feed, "Remove ambiguous redundant feed tabs"

# Prioritize content over brand decoration and remove purely ornamental widgets.
assert 'zs-feed-intro' not in feed, "Large hero was reinstated"
for old_widget in ['zs-right-spotlight', 'zs-right-atlas', 'zs-right-recent', 'zs-sidebar-feature']:
    assert old_widget not in app, f"Ornamental or redundant widget returned: {old_widget}"
assert "api('/timkiemnguoidung')" in app, "Suggestions should use real people"

# One real composer (header action dispatches into the same form).
assert "useState(false)" in feed, "Composer should be collapsed initially"
assert "zenspace:compose" in app and "zenspace:compose" in feed
assert "beforeunload" in feed, "Guard user drafts on refresh/close"
assert "window.confirm" in feed, "Confirm when abandoning a draft"
assert 'form.append(' not in feed, "Keep the FormData integration contract updated"
assert "data.append('tieuDe'" in feed and "data.append('noiDung'" in feed

# Minimal feed hierarchy: no misleading privacy metadata, fake stats or duplicate title links.
assert "Công khai" not in feed, "Privacy status is not implemented by the API"
assert "Xem bài viết" not in feed, "Avoid redundant link to same post destination"
assert "count > 0 &&" in feed, "Don't render an empty engagement row"
assert "post.reactions || null" in feed, "Use batched reaction stats"

# Responsive behavior and accessible labels.
assert "grid-template-columns:minmax(0,700px) minmax(220px,250px)" in css
assert "@media (max-width:1250px)" in css
assert "@media (max-width:740px)" in css
assert "zs-mobile-nav" in app and "aria-label" in app
assert "--zs-primary: #096bdc" in css, "Primary button must meet 4.5:1 with white text"
print("ZenSpace UX audit source-level checks OK")

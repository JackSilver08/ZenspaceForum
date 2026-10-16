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

# Compact IA: primary sidebar, bottom Settings Hub and keyboard search.
settings = (web / "features/settings/SettingsHub.jsx").read_text(encoding="utf-8")
palette = (web / "features/search/SearchPalette.jsx").read_text(encoding="utf-8")
assert "to: '/'" in app and "to: '/messages'" in app
assert "to: '/explore'" not in app and "zs-sidebar-settings" in app
assert 'path="/settings"' in main and "SettingsHub" in main
assert 'path="/following"' in main and 'feedMode="following"' in main
assert "to: '/following'" in settings and "to: '/saved'" in settings and "to: '/archive'" in settings
assert "event.ctrlKey || event.metaKey" in app and "aria-modal" in palette
assert 'zs-feed-tabs' not in feed, "Remove ambiguous redundant feed tabs"

# Prioritize content over brand decoration and remove purely ornamental widgets.
assert 'zs-feed-intro' not in feed, "Large hero was reinstated"
for old_widget in ['zs-right-spotlight', 'zs-right-atlas', 'zs-right-recent', 'zs-sidebar-feature']:
    assert old_widget not in app, f"Ornamental or redundant widget returned: {old_widget}"
assert "api('/timkiemnguoidung')" in app, "Suggestions should use real people"

# One real composer (header action dispatches into the same form).
composer = (web / "features/feed/Composer.jsx").read_text(encoding="utf-8")
assert "useState(false)" in composer, "Composer should be collapsed initially"
assert "zenspace:compose" in app and "zenspace:compose" in composer
assert "beforeunload" in composer and "guardNavigation" in composer, "Guard user drafts on reload and in-app navigation"
assert "await confirm(" in composer and "navigate(destination.pathname" in composer, "Custom popup must guard in-app navigation"
assert 'form.append(' not in composer, "Keep the FormData integration contract updated"
assert "payload.append('noiDung'" in composer and "tieuDe" not in composer

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

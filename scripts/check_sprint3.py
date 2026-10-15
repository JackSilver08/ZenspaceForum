"""Sprint 3 source security gates (supplemented by HTTP/MySQL/Chromium tests)."""
from pathlib import Path
root=Path(".")
api=root/"apps/api/internal/httpapi"
src=root/"apps/web/src"
router=(api/"router.go").read_text()
policy=(api/"post_policy.go").read_text()
lifecycle=(api/"post_lifecycle.go").read_text()
migration=(root/"apps/api/internal/platform/lifecycle_migration.go").read_text()
posts=(api/"posts.go").read_text()
composer=(src/"features/feed/Composer.jsx").read_text()
web=(src/"main.jsx").read_text()
for endpoint in ("visibility","archive","restore","permanent","history","revisions","me/posts"):
 assert endpoint in router,endpoint
assert 'r.Static("/uploads"' not in router
assert 'r.GET("/uploads/*filepath", a.serveUpload)' in router
assert 'accessiblePostSQL' in policy and 'canViewPost' in policy and 'requireView' in policy
assert 'Bearer' in policy and 'c.File(file)' in policy
for f in ("posts.go","users.go","post_controls.go","follows.go"):
 assert 'accessiblePostSQL' in (api/f).read_text(),f
for f in ("comments.go","reactions.go","social_safety.go"):
 assert 'requireView' in (api/f).read_text(),f
assert "PurgeExpiredPosts" in lifecycle and "30 DAY" in lifecycle
assert "FOR UPDATE" in posts and "post_edit_history" in posts and "expectedRevision" in posts
assert 'GET_LOCK(' in migration and "post_edit_history" in migration
assert "MigratePostLifecycle(db)" in (root/"apps/api/internal/platform/platform.go").read_text()
assert "zs-new-post-dialog" in composer and "Bạn đang nghĩ gì?" in composer
assert "payload.append('visibility'" in composer
assert "ImagePlus" in composer and "Smile" in composer and "MoreHorizontal" in composer
assert "Không gian của bạn, câu chuyện của bạn." not in composer
assert 'className="zs-new-post-cancel"' not in composer
assert 'className="zs-new-post-close"' in composer
modal_style=(src/"styles/sprint3.css").read_text()
assert ".zs-new-post-body:is(:focus,:focus-visible,:hover)" in modal_style
assert "outline:none!important" in modal_style
assert ".zs-new-post-tools>button:hover" not in modal_style
assert "ManagedPostsPage" in web and "PostMedia" in web
print("Sprint 3 privacy, lifecycle and composer static contracts OK")

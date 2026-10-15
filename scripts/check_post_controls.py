"""Post Control Center source-level regression checks (does not replace Docker tests)."""
from pathlib import Path
api=Path("apps/api/internal/httpapi")
router=(api/"router.go").read_text()
platform=Path("apps/api/internal/platform")
migration=(platform/"post_controls_migration.go").read_text()
feed=Path("apps/web/src/features/feed/FeedPage.jsx").read_text()
menu=Path("apps/web/src/features/feed/PostActionsMenu.jsx").read_text()
main=Path("apps/web/src/main.jsx").read_text()
sql=Path("ZenSpaceDB_latest.sql").read_text()
for endpoint in ['my-state','bookmarks','bookmark','hide','pin','feed/public']:
    assert endpoint in router, "Missing protected API route: "+endpoint
for marker in ["post_bookmarks","post_hides","pinnedAt", "CREATE TABLE IF NOT EXISTS"]:
    assert marker in migration
assert "MigratePostControls" in (platform/"platform.go").read_text()
assert "`pinnedAt` datetime DEFAULT NULL" in sql
for action in ['Chỉnh sửa bài viết','Lưu bài viết','Ẩn khỏi bảng tin của tôi','Ghim trên trang cá nhân','Xóa bài viết']:
    assert action in menu, "Missing post action: "+action
assert "PostActionsMenu" in feed and "PostActionsMenu" in main
assert 'path="/saved"' in main
assert "onHidden={hiddenPost}" in feed and "Hoàn tác" in feed
assert "pinnedAt" in (api/"posts.go").read_text()
print("Post Control Center source contracts OK")

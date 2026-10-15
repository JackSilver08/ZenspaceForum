"""Static safety/migration contracts, complemented by real Docker and Chromium tests."""
from pathlib import Path
root=Path(".")
routes=(root/"apps/api/internal/httpapi/router.go").read_text()
migrate=(root/"apps/api/internal/platform/social_safety_migration.go").read_text()
platform=(root/"apps/api/internal/platform/platform.go").read_text()
safety=(root/"apps/api/internal/httpapi/social_safety.go").read_text()
comments=(root/"apps/api/internal/httpapi/comments.go").read_text()
menu=(root/"apps/web/src/features/feed/PostActionsMenu.jsx").read_text()
main=(root/"apps/web/src/main.jsx").read_text()
for name in ("block-status","/block","/report","/comments","/moderation/reports"):
    assert name in routes, "Missing API: "+name
assert "MigrateSocialSafety(db)" in platform
assert "user_blocks" in migrate and "post_reports" in migrate and "commentsEnabled" in migrate
assert "ON DELETE SET NULL" in migrate, "Reports must survive source deletion"
assert "isAdmin(c)" in safety and "reported_author_id" in safety
assert "commentsEnabled" in comments and "postOwner" in comments
assert "Báo cáo bài viết" in menu and "Chặn tác giả" in menu and "Tắt bình luận" in menu
assert "ModerationPage" in main and "BlockedUsersPage" in main
assert "commentsEnabled" in (root/"apps/api/internal/httpapi/posts.go").read_text()
print("Sprint 2 API, MySQL and UI safety contracts OK")

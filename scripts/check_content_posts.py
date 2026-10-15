"""Static contracts for title-free Facebook-style ZenSpace posting."""
from pathlib import Path

root=Path(".")
api=(root/"apps/api/internal/httpapi/posts.go").read_text(encoding="utf-8")
users=(root/"apps/api/internal/httpapi/users.go").read_text(encoding="utf-8")
follows=(root/"apps/api/internal/httpapi/follows.go").read_text(encoding="utf-8")
feed=(root/"apps/web/src/features/feed/FeedPage.jsx").read_text(encoding="utf-8")
main=(root/"apps/web/src/main.jsx").read_text(encoding="utf-8")
seed=(root/"ZenSpaceDB_latest.sql").read_text(encoding="utf-8")
migration=(root/"apps/api/internal/platform/posts_migration.go").read_text(encoding="utf-8")
for label,code in (("post API",api),("profile API",users),("following API",follows),("Feed",feed),("legacy detail/profile",main)):
    assert "tieuDe" not in code and "p.Title" not in code, label+" still depends on post titles"
assert "data.append('noiDung'" in feed
assert 'maxLength={10000}' in feed
assert "post.noiDung" in feed
assert "createPost" in api and "INSERT INTO BaiDang(noiDung" in api
assert "UPDATE BaiDang SET noiDung=?" in api
assert "`tieuDe` varchar" not in seed
assert "`noiDung` mediumtext NOT NULL" in seed
assert "INSERT INTO `BaiDang` (`id`,`noiDung`,`mediaUrl`,`idTaiKhoan`,`ngayTao`)" in seed
assert "schema_migrations" in migration and "DROP COLUMN tieuDe" in migration
assert "CONCAT(tieuDe, CHAR(10), CHAR(10), noiDung)" in migration
print("Content-only schema, APIs, frontend and migration: OK")

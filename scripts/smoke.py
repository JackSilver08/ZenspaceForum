"""End-to-end smoke against real Docker Compose services on a fresh CI MySQL volume."""
import base64
import json
import re
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = "http://127.0.0.1:8089"
API = ROOT + "/api"

def request(url, method="GET", data=None, token=None, expected=200, content_type=None):
    headers = {}
    if token:
        headers["Authorization"] = "Bearer " + token
    if isinstance(data, dict):
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    else:
        body = data
        if content_type:
            headers["Content-Type"] = content_type
    req = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(req, timeout=25) as res:
            status, result, mime = res.status, res.read(), res.headers.get("Content-Type", "")
    except HTTPError as exc:
        status, result, mime = exc.code, exc.read(), exc.headers.get("Content-Type", "")
    assert status == expected, f"{method} {url}: expected HTTP {expected}, got {status}: {result[:700]!r}"
    if "application/json" in mime:
        return json.loads(result)
    return result

def api(path, method="GET", data=None, token=None, expected=200, content_type=None):
    return request(API + path, method, data, token, expected, content_type)

# Check Gin readiness directly, then exercise the website and /api proxy via Nginx.
assert request("http://127.0.0.1:8081/healthz")["status"] == "ok"
assert request("http://127.0.0.1:8081/hello").startswith(b"Server")
html = request(ROOT).decode()
assert 'id="root"' in html, "React HTML did not load"
assets = re.findall(r'(?:src|href)="(/assets/[^"]+)"', html)
assert assets, "Vite bundle references missing from index.html"
for path in assets:
    assert len(request(ROOT + path)) > 0, f"Missing asset: {path}"
assert request(ROOT + "/IMG/ZenUser.png").startswith(b"\x89PNG"), "Legacy avatar static asset not served"

posts = api("/baiviet")
assert posts["success"] and len(posts["data"]) >= 1, "Legacy MySQL posts not loaded"

stamp = str(time.time_ns())
user = "smoke_" + stamp[-12:]
password = "TestOnly_" + stamp + "!"
account = api("/DangKy", "POST", {
    "username": user, "email": user + "@example.test",
    "password": password, "confirmPassword": password
}, expected=201)
token = account["token"]
uid = int(account["user"]["id"])
logged = api("/DangNhap", "POST", {"TenDangNhap": user, "MatKhau": password})
assert logged["success"] and logged["user"]["id"] == uid

# Legacy local demo account can still sign in; successful login upgrades its password.
old = api("/DangNhap", "POST", {"TenDangNhap": "admin", "MatKhau": "ZenSpaceDemo123!"})
assert old["success"]

created = api("/baiviet", "POST", {"noiDung": "Docker + MySQL integration"}, token, 201)
pid = int(created["id"])
post_from_api = api("/baiviet/" + str(pid))["data"]
assert post_from_api["noiDung"] == "Docker + MySQL integration"
assert "tieuDe" not in post_from_api
assert "tieuDe" not in posts["data"][0], "Public feed leaked removed title field"
assert "tieuDe" not in api("/nguoidung/trangcanhan/" + str(uid))["data"]["baiViets"][0]
api("/baiviet/" + str(pid), "PUT", {"noiDung": "Updated without any post title"}, token)
assert api("/baiviet/" + str(pid))["data"]["noiDung"] == "Updated without any post title"
api("/baiviet", "POST", {"noiDung": "  "}, token, 400)
api("/baiviet", "POST", {}, token, 400)
api("/baiviet", "POST", {"noiDung": "x" * 10001}, token, 400)
api("/baiviet/" + str(pid), "PUT", {"noiDung": " "}, token, 400)
comment = api("/binhluan", "POST", {"idBaiDang": pid, "noiDung": "Comment smoke"}, token, 201)
assert comment["success"]
assert len(api("/binhluan/" + str(pid))) == 1
api("/camxuc/" + str(pid), "POST", {"loaiCamXuc": "like"}, token)
assert api("/camxuc/thongke/" + str(pid))["like"] == 1

api("/v1/users/1/follow", "POST", token=token)
assert api("/v1/users/1/follow-status", token=token)["following"]
assert any(post["id"] == pid for post in api("/v1/feed", token=token)["data"])
api("/v1/users/1/follow", "DELETE", token=token)

api("/chat/gui", "POST", {"nguoiNhanID": 1, "noiDung": "Smoke message"}, token, 201)
assert len(api(f"/chat/lichsu/{uid}/1", token=token)["tinNhan"]) == 1
assert api(f"/nguoidung/trangcanhan/{uid}")["success"]

# A normal user must not be able to update another person's seeded post.
api("/baiviet/1", "PUT", {"noiDung": "No"}, token, 403)
api("/baiviet/1", "DELETE", token=token, expected=403)
api("/v1/feed", expected=401)

# Upload and serve an actual tiny GIF; catches bind-mount ownership / Nginx proxy errors.
gif = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")
boundary = "zenspace-ci-boundary"
parts = [
    f"--{boundary}\r\nContent-Disposition: form-data; name=\"noiDung\"\r\n\r\nImage upload test\r\n".encode(),
    f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"pixel.gif\"\r\nContent-Type: image/gif\r\n\r\n".encode() + gif + b"\r\n",
    f"--{boundary}--\r\n".encode(),
]
uploaded = api("/baiviet", "POST", b"".join(parts), token, 201, "multipart/form-data; boundary=" + boundary)
assert request(ROOT + uploaded["mediaUrl"]) == gif, "Uploaded media not available through web"


# Regression suite: real Gin + MySQL + Nginx with source-vetted API contracts.
# Authentication: support email and preserve literal password whitespace.
spaced = "  Literal Spaces " + stamp + "!  "
spaced_user = "space_" + stamp[-12:]
new_account = api("/DangKy", "POST", {
    "username": spaced_user, "email": spaced_user + "@example.test",
    "password": spaced, "confirmPassword": spaced
}, expected=201)
assert api("/DangNhap", "POST", {
    "TenDangNhap": spaced_user + "@example.test", "MatKhau": spaced
})["user"]["id"] == new_account["user"]["id"]
api("/DangNhap", "POST", {
    "TenDangNhap": spaced_user + "@example.test", "MatKhau": spaced.strip()
}, expected=401)

# CORS only for explicit development origins, never wildcards or arbitrary origins.
def preflight(origin, expected_status):
    req = Request("http://127.0.0.1:8081/api/baiviet",
        method="OPTIONS", headers={"Origin":origin,
        "Access-Control-Request-Method":"POST",
        "Access-Control-Request-Headers":"Authorization, Content-Type"})
    try:
        with urlopen(req, timeout=5) as resp:
            status, allow = resp.status, resp.headers.get("Access-Control-Allow-Origin")
    except HTTPError as exc:
        status, allow = exc.code, exc.headers.get("Access-Control-Allow-Origin")
    assert status == expected_status, (origin, status, expected_status)
    if expected_status == 204: assert allow == origin, allow
    else: assert not allow, allow

preflight("http://localhost:5173", 204)
preflight("https://unauthorized.example", 403)

# Reactions: missing posts return 404, repeat same kind toggles off, changing kind updates.
api("/camxuc/987654321", "POST", {"loaiCamXuc":"like"}, token, 404)
toggled = api("/camxuc/" + str(pid), "POST", {"loaiCamXuc":"like"}, token)
assert toggled["action"] == "deleted"
assert api("/camxuc/thongke/" + str(pid))["like"] == 0
api("/camxuc/" + str(pid), "POST", {"loaiCamXuc":"love"}, token)
assert api("/camxuc/thongke/" + str(pid))["love"] == 1
api("/camxuc/" + str(pid), "DELETE", token=token)
assert api("/camxuc/thongke/" + str(pid))["love"] == 0
api("/camxuc/" + str(pid), "POST", {"loaiCamXuc":"wow"}, token)

# Personal reaction state is private, persistent, and fetched in one batched request.
selected_path = "/camxuc/cua-toi?ids=" + str(pid)
api(selected_path, expected=401)
assert api(selected_path, token=token)["data"] == {str(pid): "wow"}
assert api(selected_path, token=new_account["token"])["data"] == {}, "Private reactions leaked"
api("/camxuc/cua-toi?ids=1,bad", token=token, expected=400)
api("/camxuc/cua-toi?ids=", token=token, expected=400)
api("/camxuc/cua-toi?ids=" + ",".join(str(n) for n in range(1, 102)), token=token, expected=400)
api("/camxuc/" + str(pid), "POST", {"loaiCamXuc":"love"}, token)
assert api(selected_path, token=token)["data"] == {str(pid): "love"}, "Switching reaction did not persist"
undo = api("/camxuc/" + str(pid), "POST", {"loaiCamXuc":"love"}, token)
assert undo["action"] == "deleted"
assert api(selected_path, token=token)["data"] == {}, "Toggling off did not persist"
api("/camxuc/" + str(pid), "POST", {"loaiCamXuc":"wow"}, token)
assert api(selected_path, token=token)["data"] == {str(pid): "wow"}

# IDs: both numeric and string positive integers, reject decimal or self.
assert api("/binhluan", "POST", {"idBaiDang":str(pid),"noiDung":"String ID"}, token, 201)["success"]
api("/binhluan", "POST", {"idBaiDang":pid+0.5,"noiDung":"Decimal ID"}, token, 400)
api("/binhluan", "POST", {"idBaiDang":"15.5","noiDung":"Decimal string ID"}, token, 400)
api("/binhluan", "POST", {"idBaiDang":987654321,"noiDung":"Missing"}, token, 404)
api("/chat/gui", "POST", {"nguoiNhanID":"1","noiDung":"String peer ID"}, token, 201)
api("/chat/gui", "POST", {"nguoiNhanID":1.5,"noiDung":"Fractional peer"}, token, 400)
api("/chat/gui", "POST", {"nguoiNhanID":str(uid),"noiDung":"Self chat"}, token, 400)

# Feed N+1 regression: all reaction counts supplied directly by ONE feed API call.
bundled = api("/baiviet")["data"]
assert all(isinstance(p.get("reactions"),dict) for p in bundled), "Missing bundled reaction stats"
assert all(isinstance(p.get("avatar"),str) for p in bundled), "Missing author avatar contract"
selected = next(p for p in bundled if p["id"] == pid)
assert selected["reactions"]["wow"] == 1, selected["reactions"]
assert api("/baiviet/" + str(pid))["data"]["reactions"]["wow"] == 1
following_feed = api("/v1/feed", token=token)["data"]
assert all("reactions" in p and "avatar" in p for p in following_feed)

# Public profiles expose genuine counts. Explore shows user suggestions immediately.
before_follow = api("/nguoidung/trangcanhan/1")["data"]["user"]["followers"]
api("/v1/users/1/follow", "POST", token=token)
assert api("/nguoidung/trangcanhan/1")["data"]["user"]["followers"] == before_follow + 1
api("/v1/users/1/follow", "DELETE", token=token)
assert api("/nguoidung/trangcanhan/1")["data"]["user"]["followers"] == before_follow
suggested = api("/timkiemnguoidung")["data"]
assert len(suggested) > 0, "Explore suggestions missing"

# Private inbox is tied to JWT identity; sender name and avatar are in history.
inbox = api("/chat/inbox", token=token)
assert inbox["success"], inbox
peer = next((x for x in inbox["data"] if x["user"]["id"] == 1), None)
assert peer is not None, inbox
assert peer["user"]["tenDangNhap"] == "admin"
history = api(f"/chat/lichsu/{uid}/1", token=token)["tinNhan"]
assert len(history) >= 2 and "nguoiGuiTen" in history[-1] and "nguoiGuiAvatar" in history[-1]
api("/chat/inbox", expected=401)
api(f"/chat/lichsu/{uid}/1", token=new_account["token"], expected=403)

print("Backend regressions OK: CORS, strict IDs, email/whitespace auth, reactions, batch feed, public profiles, explore, inbox and access control")


# Post Control Center: authenticated, per-user state, privacy and permissions.
control_path = f"/v1/posts/my-state?ids={pid},1"
api(control_path, expected=401)
assert api(control_path, token=token)["data"] == {"bookmarked": [], "hidden": []}
api("/v1/posts/my-state?ids=abc", token=token, expected=400)
api("/v1/posts/my-state?ids=" + ",".join(str(n) for n in range(1,102)), token=token, expected=400)

# Saved posts are private, stable under duplicate requests, and fully reversible.
api(f"/v1/posts/{pid}/bookmark", "PUT", token=token)
api(f"/v1/posts/{pid}/bookmark", "PUT", token=token)
assert pid in api(control_path, token=token)["data"]["bookmarked"]
assert pid not in api(control_path, token=new_account["token"])["data"]["bookmarked"]
saved = api("/v1/bookmarks", token=token)["data"]
assert any(p["id"] == pid and p["noiDung"] for p in saved), saved
assert not api("/v1/bookmarks", token=new_account["token"])["data"]
api("/v1/bookmarks", expected=401)
api(f"/v1/posts/{pid}/bookmark", "DELETE", token=token)
assert pid not in api(control_path, token=token)["data"]["bookmarked"]

# Hide only affects this user's feeds. Other users, public posts and direct URLs stay visible.
api(f"/v1/posts/{1}/hide", "PUT", token=token)
api(f"/v1/posts/{1}/hide", "PUT", token=token)
assert 1 in api(control_path, token=token)["data"]["hidden"]
assert 1 not in [p["id"] for p in api("/v1/feed/public", token=token)["data"]]
assert 1 in [p["id"] for p in api("/baiviet")["data"]]
assert api("/baiviet/1")["data"]["id"] == 1
assert 1 in [p["id"] for p in api("/v1/feed/public", token=new_account["token"])["data"]]
api("/v1/users/1/follow", "POST", token=token)
assert 1 not in [p["id"] for p in api("/v1/feed", token=token)["data"]]
api(f"/v1/posts/1/hide", "DELETE", token=token)
assert 1 in [p["id"] for p in api("/v1/feed", token=token)["data"]]
api("/v1/users/1/follow", "DELETE", token=token)

# Only the author may pin; pinning a second post replaces the first atomically.
api(f"/v1/posts/{pid}/pin", "PUT", token=new_account["token"], expected=403)
api(f"/v1/posts/{pid}/pin", "PUT", token=token)
assert api("/baiviet/"+str(pid))["data"]["isPinned"] is True
assert api("/nguoidung/trangcanhan/"+str(uid))["data"]["baiViets"][0]["id"] == pid
another = api("/baiviet","POST",{"noiDung":"Second pin integration post"},token,201)["id"]
api(f"/v1/posts/{another}/pin","PUT",token=token)
assert api("/baiviet/"+str(pid))["data"]["isPinned"] is False
assert api("/baiviet/"+str(another))["data"]["isPinned"] is True
assert api("/nguoidung/trangcanhan/"+str(uid))["data"]["baiViets"][0]["id"] == another
api(f"/v1/posts/{another}/pin", "DELETE", token=token)
assert api("/baiviet/"+str(another))["data"]["isPinned"] is False
api(f"/baiviet/{another}", "DELETE", token=token)

# Missing posts return a safe 404, not a foreign-key 500.
api("/v1/posts/987654321/bookmark","PUT",token=token,expected=404)
api("/v1/posts/987654321/hide","PUT",token=token,expected=404)
api("/v1/posts/987654321/pin","PUT",token=token,expected=404)

print("Post Control Center regression OK: bookmark, hide, pin, access control, privacy and undo")


# Sprint 2: comments belong to their author and post owner; closed comments reject new ones.
comment_author=new_account["token"]
api(f"/v1/posts/{pid}/comments","PUT",{"enabled":False},comment_author,403)
api(f"/v1/posts/{pid}/comments","PUT",{"enabled":False},old["token"],403)
api("/v1/posts/999999/comments","PUT",{"enabled":False},token,404)
api(f"/v1/posts/{pid}/comments","PUT",{"enabled":False},token)
assert api("/baiviet/"+str(pid))["data"]["commentsEnabled"] is False
api("/binhluan","POST",{"idBaiDang":pid,"noiDung":"Cannot enter closed thread"},comment_author,403)
api("/binhluan","POST",{"idBaiDang":pid,"noiDung":"Author also closed"},token,403)
api(f"/v1/posts/{pid}/comments","PUT",{"enabled":True},token)
assert api("/baiviet/"+str(pid))["data"]["commentsEnabled"] is True
api("/binhluan","POST",{"idBaiDang":pid,"noiDung":"Visitor comment to moderate"},comment_author,201)
foreign_comment=next(c for c in api("/binhluan/"+str(pid)) if c["noiDung"]=="Visitor comment to moderate")
api("/binhluan/"+str(foreign_comment["id"]),"DELETE",token=token)
assert all(c["id"]!=foreign_comment["id"] for c in api("/binhluan/"+str(pid)))

# Two-way interaction restriction and private block list.
other_id=int(new_account["user"]["id"])
api(f"/v1/users/{other_id}/block","PUT",token=token)
api(f"/v1/users/{other_id}/block","PUT",token=token)
assert api(f"/v1/users/{other_id}/block-status",token=token)["blocked"] is True
assert api(f"/v1/users/{uid}/block-status",token=comment_author)["blockedBy"] is True
assert any(p["id"]==other_id for p in api("/v1/users/blocks",token=token)["data"])
api(f"/v1/users/{uid}/follow","POST",token=comment_author,expected=403)
api("/chat/gui","POST",{"nguoiNhanID":uid,"noiDung":"Blocked DM"},comment_author,403)
api("/binhluan","POST",{"idBaiDang":pid,"noiDung":"Blocked comment"},comment_author,404)
api(f"/camxuc/{pid}","POST",{"loaiCamXuc":"love"},comment_author,404)
assert pid not in [p["id"] for p in api("/v1/feed/public",token=comment_author)["data"]]
api(f"/v1/users/{other_id}/block","DELETE",token=token)
assert api(f"/v1/users/{other_id}/block-status",token=token)["blocked"] is False
assert api("/v1/users/blocks",token=token)["data"]==[]
assert pid in [p["id"] for p in api("/v1/feed/public",token=comment_author)["data"]]

# Reports are non-self, validated, private and permanently reviewable by admin.
api(f"/v1/posts/{pid}/report","POST",{"reason":"spam"},token,400)
api(f"/v1/posts/{pid}/report","POST",{"reason":"invalid"},comment_author,400)
api("/v1/posts/999999/report","POST",{"reason":"spam"},comment_author,404)
api("/v1/moderation/reports",expected=401)
api("/v1/moderation/reports",token=token,expected=403)
api("/v1/moderation/reports/1","PUT",{"status":"dismissed"},token,403)
report_target=api("/baiviet","POST",{"noiDung":"Evidence survives deleting a post"},token,201)["id"]
api(f"/v1/posts/{report_target}/report","POST",{"reason":"harassment","details":"Integration review"},comment_author,201)
api(f"/v1/posts/{report_target}/report","POST",{"reason":"harassment"},comment_author,409)
reports=api("/v1/moderation/reports",token=old["token"])["data"]
record=next(r for r in reports if r["postId"]==report_target)
assert record["reason"]=="harassment" and record["snapshot"]=="Evidence survives deleting a post"
api(f"/v1/moderation/reports/{record['id']}","PUT",{"status":"unexpected"},old["token"],400)
api(f"/v1/moderation/reports/{record['id']}","PUT",{"status":"actioned"},old["token"])
api(f"/v1/moderation/reports/{record['id']}","PUT",{"status":"dismissed"},old["token"],409)
api(f"/baiviet/{report_target}","DELETE",token=token)
stored=next(r for r in api("/v1/moderation/reports?status=all",token=old["token"])["data"] if r["id"]==record["id"])
assert stored["postId"]==report_target and stored["snapshot"]=="Evidence survives deleting a post"
api(f"/v1/posts/{report_target}/permanent","DELETE",token=token)
stored=next(r for r in api("/v1/moderation/reports?status=all",token=old["token"])["data"] if r["id"]==record["id"])
assert stored["postId"] is None and stored["snapshot"]=="Evidence survives deleting a post"
print("Sprint 2 safety regressions OK: report/admin moderation, block, closed comments, comment owner moderation")

print("Smoke OK: Nginx + React + Gin + MySQL + auth + posts + comments + reactions + follows + chat + media")


# Sprint 3 full-system privacy/security/lifecycle regression (existing Sprint 1 & 2
# suites above continue to run without replacing their checks).
owner_token = token
stranger_token = new_account["token"]
viewer_id = int(new_account["user"]["id"])
status_v1 = "ZenSpace Sprint3 private status " + stamp
private = api("/baiviet", "POST", {
    "noiDung": status_v1, "visibility": "private", "commentsEnabled": False
}, owner_token, 201)
private_id = int(private["id"])
path_private = "/baiviet/" + str(private_id)
assert api(path_private, token=owner_token)["data"]["visibility"] == "private"
assert api(path_private, token=owner_token)["data"]["commentsEnabled"] is False
api(path_private, expected=404)
api(path_private, token=stranger_token, expected=404)
assert all(p["id"] != private_id for p in api("/baiviet")["data"])
assert all(p["id"] != private_id for p in api("/v1/feed/public", token=stranger_token)["data"])
assert all(p["id"] != private_id for p in api(f"/nguoidung/trangcanhan/{uid}")["data"]["baiViets"])
assert any(p["id"] == private_id for p in api(f"/nguoidung/trangcanhan/{uid}", token=owner_token)["data"]["baiViets"])
api(f"/binhluan/{private_id}", expected=404)
api(f"/camxuc/thongke/{private_id}", expected=404)
api("/binhluan", "POST", {"idBaiDang":private_id,"noiDung":"Must stay private"},stranger_token,404)
api(f"/camxuc/{private_id}", "POST", {"loaiCamXuc":"love"},stranger_token,404)
api(f"/v1/posts/{private_id}/bookmark", "PUT", token=stranger_token, expected=404)
api(f"/v1/posts/{private_id}/history", token=stranger_token, expected=403)
api(f"/v1/posts/{private_id}/archive", "PUT", token=stranger_token, expected=403)
api(f"/v1/posts/{private_id}/visibility", "PATCH", {"visibility":"bogus"},owner_token,400)

# Followers-only is dynamically authorized by Follow, not by a client-side flag.
api(f"/v1/posts/{private_id}/visibility","PATCH",{"visibility":"followers"},owner_token)
api(path_private, token=stranger_token, expected=404)
api(f"/v1/users/{uid}/follow","POST",token=stranger_token)
assert api(path_private, token=stranger_token)["data"]["visibility"] == "followers"
api(path_private, expected=404)
api(f"/v1/users/{uid}/follow","DELETE",token=stranger_token)
api(path_private, token=stranger_token, expected=404)
api(f"/v1/posts/{private_id}/visibility","PATCH",{"visibility":"public"},owner_token)
assert api(path_private)["data"]["visibility"] == "public"

# Transactional history, optimistic revisions, visibility control and restore.
assert api(path_private)["data"]["revision"] == 1
api(path_private,"PUT",{"noiDung":status_v1+" v2","expectedRevision":1},owner_token)
assert api(path_private)["data"]["revision"] == 2
api(path_private,"PUT",{"noiDung":"Stale edit","expectedRevision":1},owner_token,409)
versions = api(f"/v1/posts/{private_id}/history",token=owner_token)["data"]
assert versions and versions[0]["content"] == status_v1
api(f"/v1/posts/{private_id}/revisions/1/restore","POST",token=owner_token)
assert api(path_private)["data"]["noiDung"] == status_v1
assert api(path_private)["data"]["revision"] == 3
api(f"/v1/posts/{private_id}/history",expected=401)

# Archive removes the post from all ordinary reads but preserves its history.
api(f"/v1/posts/{private_id}/archive","PUT",token=owner_token)
api(path_private,token=owner_token,expected=404)
assert any(p["id"] == private_id for p in api("/v1/me/posts/archived",token=owner_token)["data"])
assert not api("/v1/me/posts/archived",token=stranger_token)["data"]
api("/v1/me/posts/archived",expected=401)
api(f"/v1/posts/{private_id}/archive","DELETE",token=owner_token)
assert api(path_private)["data"]["id"]==private_id

# Soft-delete 30-day retention, comments and edits survive restoration.
api(path_private,"DELETE",token=owner_token)
api(path_private,expected=404)
api(f"/v1/posts/{private_id}/restore","POST",token=stranger_token,expected=403)
trashed=api("/v1/me/posts/trashed",token=owner_token)["data"]
assert any(p["id"] == private_id and p["purgeAfter"] for p in trashed)
api(f"/v1/posts/{private_id}/restore","POST",token=owner_token)
assert api(path_private)["data"]["id"]==private_id
assert api(f"/v1/posts/{private_id}/history",token=owner_token)["data"]
api(path_private,"DELETE",token=owner_token)
api(f"/v1/posts/{private_id}/permanent","DELETE",token=stranger_token,expected=403)
api(f"/v1/posts/{private_id}/permanent","DELETE",token=owner_token)
api(path_private,expected=404)
api(f"/v1/posts/{private_id}/restore","POST",token=owner_token,expected=404)

# Security regression for public legacy media URLs and private uploads:
# the original /uploads/posts/<name> must not bypass privacy policy.
private_parts = [
 f'--{boundary}\r\nContent-Disposition: form-data; name="noiDung"\r\n\r\nPrivate attachment\r\n'.encode(),
 f'--{boundary}\r\nContent-Disposition: form-data; name="visibility"\r\n\r\nprivate\r\n'.encode(),
 f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="private.gif"\r\nContent-Type: image/gif\r\n\r\n'.encode()+gif+b'\r\n',
 f'--{boundary}--\r\n'.encode()
]
media_post=api("/baiviet","POST",b"".join(private_parts),owner_token,201,"multipart/form-data; boundary="+boundary)
media_id=int(media_post["id"])
media_url=ROOT+media_post["mediaUrl"]
request(media_url,expected=404)
request(media_url,token=stranger_token,expected=404)
assert request(media_url,token=owner_token)==gif
api(f"/v1/posts/{media_id}/visibility","PATCH",{"visibility":"public"},owner_token)
assert request(media_url)==gif
api(f"/v1/posts/{media_id}/archive","PUT",token=owner_token)
request(media_url,expected=404)
api(f"/v1/posts/{media_id}/archive","DELETE",token=owner_token)
api(f"/baiviet/{media_id}","DELETE",token=owner_token)
request(media_url,expected=404)
api(f"/v1/posts/{media_id}/permanent","DELETE",token=owner_token)
request(media_url,expected=404)
print("Sprint 3 full privacy/lifecycle/media regression OK")

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

created = api("/baiviet", "POST", {"tieuDe": "Smoke test", "noiDung": "Docker + MySQL integration"}, token, 201)
pid = int(created["id"])
assert api("/baiviet/" + str(pid))["data"]["tieuDe"] == "Smoke test"
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
api("/baiviet/1", "PUT", {"tieuDe": "No", "noiDung": "No"}, token, 403)
api("/baiviet/1", "DELETE", token=token, expected=403)
api("/v1/feed", expected=401)

# Upload and serve an actual tiny GIF; catches bind-mount ownership / Nginx proxy errors.
gif = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")
boundary = "zenspace-ci-boundary"
parts = [
    f"--{boundary}\r\nContent-Disposition: form-data; name=\"tieuDe\"\r\n\r\nImage smoke\r\n".encode(),
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

print("Smoke OK: Nginx + React + Gin + MySQL + auth + posts + comments + reactions + follows + chat + media")

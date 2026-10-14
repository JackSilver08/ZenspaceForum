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

print("Smoke OK: Nginx + React + Gin + MySQL + auth + posts + comments + reactions + follows + chat + media")

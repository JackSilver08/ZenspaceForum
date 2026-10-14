"""Fail CI if Compose accidentally reverts to the legacy backend or unmounted Nginx."""
import json
import subprocess
from pathlib import Path

config = json.loads(subprocess.check_output(["docker", "compose", "config", "--format", "json"], text=True))
services = config["services"]
assert {"db", "redis", "backend", "web"}.issubset(services), "Missing required services"
for service, expected in (("backend", "apps/api"), ("web", "apps/web")):
    context = services[service].get("build", {}).get("context", "")
    assert Path(context).as_posix().endswith("/" + expected), (
        f"{service} must build from {expected}, got {context!r}"
    )
backend = services["backend"]
health = " ".join(backend["healthcheck"]["test"])
assert "/healthz" in health, "Gin healthcheck must use /healthz"
assert backend["environment"]["UPLOAD_DIR"] == "/app/uploads"
assert any(volume.get("target") == "/app/uploads" for volume in backend["volumes"]), (
    "Persistent uploads mount is missing"
)
assert any(volume.get("target") == "/var/lib/mysql" for volume in services["db"]["volumes"]), (
    "MySQL data volume is missing"
)
print("OK: Compose uses Gin/React, matching healthchecks, and persistent data mounts")

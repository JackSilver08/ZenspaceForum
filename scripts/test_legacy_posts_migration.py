"""Docker-only integration test simulating an already existing legacy MySQL volume.

Runs AFTER HTTP/Playwright tests: temporarily adds a title column to a disposable
CI MySQL database, restarts Gin and verifies automatic, idempotent migration.
Never run this against personal/production data.
"""
import os
import subprocess
import time
from urllib.request import urlopen
from urllib.error import URLError
import json

def mysql(query):
    cmd=["docker","compose","exec","-T","db","mysql","-N","-s",
         "-uroot","--password="+os.environ["MYSQL_ROOT_PASSWORD"],
         "ZenSpaceDB","-e",query]
    return subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL).strip()

def get_post(post_id):
    with urlopen("http://127.0.0.1:8089/api/baiviet/"+str(post_id),timeout=12) as response:
        return json.load(response)["data"]

# New seed migrated to content-only; id 21 is seeded and unaffected by this test.
assert mysql("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='ZenSpaceDB' AND TABLE_NAME='BaiDang' AND COLUMN_NAME='tieuDe'")=="0"
before = get_post(21)["noiDung"]
mysql("ALTER TABLE BaiDang ADD COLUMN tieuDe VARCHAR(255) NOT NULL DEFAULT ''")
mysql("UPDATE BaiDang SET tieuDe='Legacy astronomy title' WHERE id=21")

def restart_and_wait():
    subprocess.check_call(["docker","compose","restart","backend"],stdout=subprocess.DEVNULL)
    for _ in range(50):
        try:
            with urlopen("http://127.0.0.1:8081/healthz",timeout=2) as resp:
                if resp.status==200: return
        except (OSError, TimeoutError):
            pass
        time.sleep(2)
    raise RuntimeError("Gin API never became healthy after legacy migration")

restart_and_wait()
after=get_post(21)["noiDung"]
assert after=="Legacy astronomy title\n\n"+before, repr(after)
assert mysql("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='ZenSpaceDB' AND TABLE_NAME='BaiDang' AND COLUMN_NAME='tieuDe'")=="0"
assert mysql("SELECT COUNT(*) FROM schema_migrations WHERE version='20261015_content_only_posts'")=="1"
restart_and_wait()
assert get_post(21)["noiDung"]==after, "A second boot duplicated the historical title"
print("Legacy MySQL schema migrated without losing content and was idempotent on restart")

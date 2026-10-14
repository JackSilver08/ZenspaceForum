# Windows line endings and Docker startup

Git on Windows may set core.autocrlf=true and check out .sh files with CRLF line endings.
Linux then interprets #!/bin/sh\r as the path to an interpreter, which does not exist.
Docker reports "exec /usr/local/bin/zenspace-entrypoint: no such file or directory".

Prevention:
- .gitattributes forces LF for every *.sh checkout, regardless of core.autocrlf.
- The API Dockerfile additionally normalizes CRLF and performs a shell syntax check.
- The Docker smoke CI **intentionally rewrites** the entrypoint with CRLF before building and verifies the whole system starts.
- Windows CI checks that shell scripts are checked out using LF.

Safe recovery on Windows (preserve your MySQL volume and .env):
1. git status
2. git pull --ff-only origin main
3. docker compose build --no-cache backend
4. docker compose up -d --wait
5. docker compose ps
Do not use docker compose down -v; it deletes database volumes.

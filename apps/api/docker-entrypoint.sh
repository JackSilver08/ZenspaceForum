#!/bin/sh
set -eu
# Bind-mounted ./data/uploads may be owned by root on Linux Docker hosts.
# Fix only directories, preserving uploaded media contents and database volumes.
mkdir -p /app/uploads/posts
chown app:app /app/uploads /app/uploads/posts
exec su-exec app /app/server

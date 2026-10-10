#!/bin/sh
host="db"
port="${DB_PORT:-3306}"

echo "⏳ Đợi MySQL tại $host:$port..."

until nc -z "$host" "$port"; do
  echo "🚫 MySQL chưa sẵn sàng, đợi 1s..."
  sleep 1
done

echo "✅ MySQL sẵn sàng! Bắt đầu backend..."
exec "$@"

#!/bin/sh
set -e

# Применяем миграции (идемпотентно; на уже накатанной вручную БД — не падаем).
if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] goose up..."
  goose -dir /app/db/migrations postgres "$DATABASE_URL" up || \
    echo "[entrypoint] migrations skipped/failed — продолжаем (возможно, уже применены)"
fi

exec /app/api

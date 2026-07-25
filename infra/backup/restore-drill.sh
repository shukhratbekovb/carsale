#!/usr/bin/env bash
# Carsale — restore-drill (BE-10.3, NFR-11: квартальная проверка восстановления).
# Восстанавливает дамп в ОТДЕЛЬНУЮ scratch-БД, сверяет, что данные читаются, и
# удаляет scratch. Никогда не трогает боевую БД. Бэкап без успешного restore —
# это не бэкап, поэтому дрилл нужен регулярно (NFR-11).
#
# Использование: infra/backup/restore-drill.sh [path/to.dump]
#   без аргумента — берёт самый свежий дамп из BACKUP_DIR.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PG_CONTAINER="${PG_CONTAINER:-carsale-infra-postgres-1}"
PG_USER="${PG_USER:-carsale}"
PG_DB="${PG_DB:-carsale}"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/dumps}"
SCRATCH_DB="${SCRATCH_DB:-${PG_DB}_restore_drill}"

dump="${1:-}"
if [ -z "$dump" ]; then
  dump="$(ls -1t "$BACKUP_DIR"/*.dump 2>/dev/null | head -1 || true)"
fi
if [ -z "$dump" ] || [ ! -s "$dump" ]; then
  echo "[drill] ERROR: no dump found (BACKUP_DIR=$BACKUP_DIR)" >&2
  exit 1
fi
echo "[drill] restoring $dump → scratch db '$SCRATCH_DB'"

psql_exec() { docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -v ON_ERROR_STOP=1 "$@"; }

# Свежая scratch-БД (роняем прежнюю на случай оборванного дрилла)
psql_exec -d postgres -c "DROP DATABASE IF EXISTS \"$SCRATCH_DB\";"
psql_exec -d postgres -c "CREATE DATABASE \"$SCRATCH_DB\";"

cleanup() {
  docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS \"$SCRATCH_DB\";" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Восстанавливаем (--no-owner: роли scratch-окружения могут отличаться)
docker exec -i "$PG_CONTAINER" pg_restore -U "$PG_USER" -d "$SCRATCH_DB" --no-owner < "$dump"

# Санити: таблицы существуют и читаются
tables="$(psql_exec -d "$SCRATCH_DB" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
listings="$(psql_exec -d "$SCRATCH_DB" -tAc "SELECT count(*) FROM listings;")"
users="$(psql_exec -d "$SCRATCH_DB" -tAc "SELECT count(*) FROM users;")"

echo "[drill] restored ok — tables=$tables listings=$listings users=$users"
if [ "$tables" -lt 1 ]; then
  echo "[drill] ERROR: no tables after restore" >&2
  exit 1
fi
echo "[drill] PASS — backup is restorable; dropping scratch db"

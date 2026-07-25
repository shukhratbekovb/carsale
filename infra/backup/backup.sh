#!/usr/bin/env bash
# Carsale — резервное копирование PostgreSQL (BE-10.3, NFR-11: бэкапы hourly).
# Снимает сжатый custom-format дамп (pg_dump -Fc) и ротирует старые по счётчику.
# По умолчанию работает через docker exec в compose-контейнер (dev); для прод —
# см. переменные PG_* / USE_DOCKER ниже (прямой pg_dump по DATABASE_URL/PG*).
#
# Расписание (NFR-11 «hourly»): cron `0 * * * * /path/infra/backup/backup.sh`.
# Прод-заметки — infra/backup/README.md (offsite/UZ-хостинг, шифрование, алерт
# на «свежего дампа нет» через метрики BE-10.4).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PG_CONTAINER="${PG_CONTAINER:-carsale-infra-postgres-1}"
PG_USER="${PG_USER:-carsale}"
PG_DB="${PG_DB:-carsale}"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/dumps}"
# hourly × 48 = двое суток истории по умолчанию
RETENTION="${RETENTION:-48}"
# USE_DOCKER=0 + доступный клиент pg_dump → прямой дамп по PG*/DATABASE_URL (прод)
USE_DOCKER="${USE_DOCKER:-1}"

mkdir -p "$BACKUP_DIR"
ts="$(date +%Y%m%d_%H%M%S)"
outfile="$BACKUP_DIR/${PG_DB}_${ts}.dump"

echo "[backup] dumping $PG_DB → $outfile"
if [ "$USE_DOCKER" = "1" ]; then
  # Стримим custom-format дамп из контейнера в файл на хосте
  docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -Fc "$PG_DB" > "$outfile"
else
  pg_dump -Fc "$PG_DB" > "$outfile"
fi

# Дамп обязан быть непустым — иначе это «зелёный» бэкап без данных (хуже, чем явный сбой)
if [ ! -s "$outfile" ]; then
  echo "[backup] ERROR: dump is empty, removing" >&2
  rm -f "$outfile"
  exit 1
fi
size="$(wc -c < "$outfile" | tr -d ' ')"
echo "[backup] ok: ${size} bytes"

# Ротация: оставляем RETENTION самых свежих .dump, остальные удаляем
mapfile -t dumps < <(ls -1t "$BACKUP_DIR"/*.dump 2>/dev/null || true)
if [ "${#dumps[@]}" -gt "$RETENTION" ]; then
  for old in "${dumps[@]:$RETENTION}"; do
    echo "[backup] pruning $old"
    rm -f "$old"
  done
fi

echo "[backup] done — ${#dumps[@]} dump(s) retained (max $RETENTION)"

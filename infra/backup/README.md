# Резервное копирование БД (BE-10.3, NFR-11)

Скрипты бэкапа PostgreSQL и проверки восстановления. Требование NFR-11 —
**hourly-бэкапы + квартальный restore-drill**.

## Скрипты

| Скрипт | Назначение |
|--------|-----------|
| `backup.sh` | Снимает сжатый дамп (`pg_dump -Fc`) в `dumps/`, ротирует старые |
| `restore-drill.sh` | Восстанавливает дамп в отдельную scratch-БД, сверяет и удаляет её |

Дампы (`dumps/`) в git не коммитятся (`.gitignore`).

## Использование (dev)

```bash
# Разовый бэкап (нужен запущенный infra/docker-compose)
bash infra/backup/backup.sh

# Дрилл восстановления самого свежего дампа (в scratch-БД, боевую не трогает)
bash infra/backup/restore-drill.sh
# ...или конкретного файла:
bash infra/backup/restore-drill.sh infra/backup/dumps/carsale_20260725_120000.dump
```

## Конфигурация (env)

| Переменная | Дефолт | Описание |
|-----------|--------|----------|
| `PG_CONTAINER` | `carsale-infra-postgres-1` | compose-контейнер Postgres |
| `PG_USER` / `PG_DB` | `carsale` | пользователь / БД |
| `BACKUP_DIR` | `infra/backup/dumps` | куда складывать дампы |
| `RETENTION` | `48` | сколько последних дампов хранить (hourly × 48 = 2 суток) |
| `USE_DOCKER` | `1` | `0` + доступный `pg_dump` → прямой дамп (прод, без docker) |
| `SCRATCH_DB` | `<PG_DB>_restore_drill` | имя временной БД дрилла |

## Расписание

**Бэкап (hourly, NFR-11)** — cron:

```cron
0 * * * * /path/to/carsale/infra/backup/backup.sh >> /var/log/carsale-backup.log 2>&1
```

**Restore-drill (квартально, NFR-11)** — cron (1-е число раз в квартал):

```cron
0 3 1 1,4,7,10 * /path/to/carsale/infra/backup/restore-drill.sh >> /var/log/carsale-drill.log 2>&1
```

## Прод-заметки (вне скоупа скриптов)

- **Хранилище**: дампы — на UZ-хостинге (ADR-004, NFR-18 PII не покидает UZ);
  копия offsite в другой UZ-локации/дата-центре против потери одного узла.
- **Шифрование**: дамп содержит PII (хеши телефонов, email) — шифровать at-rest
  (напр. `age`/`gpg` поверх `.dump`) и передавать по TLS.
- **Мониторинг**: алерт «нет свежего дампа за >90 мин» — завести поверх метрик
  (BE-10.4): экспортировать `carsale_last_backup_timestamp` из `backup.sh` в
  Pushgateway, алертить по возрасту. Иначе бэкап может молча ломаться.
- **PITR**: для RPO < 1ч рассмотреть WAL-archiving/`pg_basebackup` вместо только
  логических дампов (Фаза 2, если понадобится).

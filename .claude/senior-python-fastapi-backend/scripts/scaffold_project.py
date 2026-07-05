#!/usr/bin/env python3
"""
Генерирует каркас FastAPI-проекта с слоистой архитектурой
(routers -> services -> repositories -> models/schemas).

Использование:
    python3 scaffold_project.py <path-to-project-root> [--app-name app] [--force]

По умолчанию НИЧЕГО не перезаписывает, если файл/папка уже существуют,
кроме случая, когда передан --force. Всегда безопасно запускать в уже
существующем репозитории — он просто дополнит недостающие части структуры.
"""
import argparse
import os
import sys

DIRS = [
    "{app}",
    "{app}/core",
    "{app}/api",
    "{app}/api/v1",
    "{app}/api/v1/routers",
    "{app}/models",
    "{app}/schemas",
    "{app}/services",
    "{app}/repositories",
    "{app}/db",
    "tests",
    "tests/unit",
    "tests/integration",
]

FILES = {
    "{app}/__init__.py": "",
    "{app}/main.py": '''"""Точка входа FastAPI-приложения."""
from fastapi import FastAPI

from {app}.api.v1.routers import api_router
from {app}.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    return {{"status": "ok"}}
''',
    "{app}/core/__init__.py": "",
    "{app}/core/config.py": '''"""Настройки приложения (pydantic-settings)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "backend"
    ENVIRONMENT: str = "local"
    DATABASE_URL: str = "sqlite+aiosqlite:///./app.db"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
''',
    "{app}/core/security.py": '''"""Хелперы аутентификации/авторизации (JWT, хэширование паролей и т.п.).

Наполняется по мере согласования конкретной задачи из плана разработки —
не додумывай схему auth здесь заранее без согласования с пользователем.
"""
''',
    "{app}/api/__init__.py": "",
    "{app}/api/v1/__init__.py": "",
    "{app}/api/v1/deps.py": '''"""Общие FastAPI-зависимости (get_db, get_current_user и т.п.)."""
''',
    "{app}/api/v1/routers/__init__.py": '''"""Сборка всех роутеров v1 в один APIRouter.

Роутеры должны быть "тонкими": валидация входа через schemas,
делегирование бизнес-логики в services, без прямого доступа к БД.
"""
from fastapi import APIRouter

api_router = APIRouter()

# Пример подключения роутера конкретного домена:
# from {app}.api.v1.routers.users import router as users_router
# api_router.include_router(users_router, prefix="/users", tags=["users"])
''',
    "{app}/models/__init__.py": "",
    "{app}/schemas/__init__.py": "",
    "{app}/services/__init__.py": '''"""Слой бизнес-логики.

Сервисы вызываются из роутеров, оркеструют работу repositories,
не знают о FastAPI/HTTP и не должны импортировать что-либо из api/.
"""
''',
    "{app}/repositories/__init__.py": '''"""Слой доступа к данным.

Repositories инкапсулируют работу с ORM/БД. Сервисы обращаются
только к repositories, никогда напрямую к сессии БД в обход этого слоя.
"""
''',
    "{app}/db/__init__.py": "",
    "{app}/db/session.py": '''"""Асинхронная сессия/движок БД (SQLAlchemy)."""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from {app}.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with async_session_factory() as session:
        yield session
''',
    "{app}/db/base.py": '''"""Базовый класс декларативных моделей SQLAlchemy."""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
''',
    "tests/__init__.py": "",
    "tests/unit/__init__.py": "",
    "tests/integration/__init__.py": "",
    "tests/conftest.py": '''"""Общие pytest-фикстуры (тестовая БД, тестовый клиент FastAPI и т.п.)."""
''',
    ".env.example": '''PROJECT_NAME=backend
ENVIRONMENT=local
DATABASE_URL=sqlite+aiosqlite:///./app.db
''',
}


def render(path_template: str, app: str) -> str:
    return path_template.format(app=app)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", help="Корень репозитория, где создавать структуру")
    parser.add_argument("--app-name", default="app", help="Имя python-пакета приложения (по умолчанию 'app')")
    parser.add_argument("--force", action="store_true", help="Перезаписывать существующие файлы")
    args = parser.parse_args()

    root = os.path.abspath(args.root)
    app = args.app_name
    os.makedirs(root, exist_ok=True)

    created_dirs = []
    for d in DIRS:
        full = os.path.join(root, render(d, app))
        if not os.path.exists(full):
            os.makedirs(full, exist_ok=True)
            created_dirs.append(full)

    created_files = []
    skipped_files = []
    for rel_path, content in FILES.items():
        rel = render(rel_path, app)
        full = os.path.join(root, rel)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        if os.path.exists(full) and not args.force:
            skipped_files.append(rel)
            continue
        with open(full, "w", encoding="utf-8") as f:
            f.write(render(content, app))
        created_files.append(rel)

    print(f"✅ Структура создана в: {root}")
    print(f"\nСозданные директории: {len(created_dirs)}")
    print(f"Созданные файлы: {len(created_files)}")
    for f in created_files:
        print(f"  + {f}")
    if skipped_files:
        print(f"\nПропущено (уже существуют, используй --force для перезаписи): {len(skipped_files)}")
        for f in skipped_files:
            print(f"  - {f}")

    return 0


if __name__ == "__main__":
    sys.exit(main())

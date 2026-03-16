from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from jose import jwt
from passlib.context import CryptContext


# `passlib[bcrypt]` 在部分 Python 3.12 + bcrypt 新版本组合下存在兼容问题。
# 这里改用 passlib 内置支持稳定的 pbkdf2_sha256，避免启动阶段因 bcrypt backend 报错。
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
ALGORITHM = "HS256"


def _load_dotenv_value(key: str) -> str | None:
    if not ENV_PATH.exists():
        return None

    for raw_line in ENV_PATH.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        env_key, env_value = line.split("=", 1)
        if env_key.strip() == key:
            return env_value.strip().strip('"').strip("'")

    return None


def _get_setting(key: str, default: str | None = None) -> str | None:
    value = os.getenv(key)
    if value is not None and value.strip():
        return value.strip().strip('"').strip("'")

    dotenv_value = _load_dotenv_value(key)
    if dotenv_value is not None and dotenv_value.strip():
        return dotenv_value.strip().strip('"').strip("'")

    return default


SECRET_KEY = _get_setting("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is not configured. Please set it in .env or your environment.")

ACCESS_TOKEN_EXPIRE_MINUTES = int(_get_setting("ACCESS_TOKEN_EXPIRE_MINUTES", "480") or "480")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode = {
        "sub": subject,
        "exp": expire,
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

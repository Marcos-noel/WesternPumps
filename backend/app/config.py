from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            Path(__file__).resolve().parents[2] / ".env",
            Path(__file__).resolve().parents[1] / ".env",
        ),
        env_ignore_empty=True,
        extra="ignore",
    )

    database_url: str = "mysql+pymysql://westernpumps:westernpumps@localhost:3306/westernpumps"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
    auto_create_tables: bool = True
    disable_auth: bool = True
    approval_threshold_manager: float = 5000
    approval_threshold_admin: float = 20000


settings = Settings()

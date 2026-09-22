from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "AgentiChain API"
    app_version: str = "0.4.0"
    api_prefix: str = "/api"
    database_url: str = "sqlite+aiosqlite:///./data/agentichain.db"
    cors_origins: str = "*"
    host: str = "0.0.0.0"
    port: int = 8000
    foundry_timeout_seconds: int = 300
    foundry_output_limit_bytes: int = 2_000_000
    tool_cache_dir: str = "./data/tool_cache"
    foundry_jobs_dir: str = "./data/foundry_jobs"

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4.1-mini"
    etherscan_api_key: str = ""
    redis_url: str = ""
    walletconnect_project_id: str = ""
    public_rpc_url: str = ""
    deployer_private_key: str = ""
    allow_public_broadcast: bool = False
    allow_mainnet: bool = False
    oracle_cloud_host: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def tool_cache_path(self) -> Path:
        return Path(self.tool_cache_dir).resolve()

    @property
    def foundry_jobs_path(self) -> Path:
        return Path(self.foundry_jobs_dir).resolve()

    def has(self, value: str) -> bool:
        return bool((value or "").strip())


settings = Settings()

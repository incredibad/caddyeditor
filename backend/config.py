from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    secret_key: str = "changeme-please-set-a-secure-secret-key"
    caddyfile_path: str = "/data/Caddyfile"
    caddy_admin_url: str = "http://host.docker.internal:2019"
    username: str = "admin"
    password: str = ""

    class Config:
        env_file = ".env"


settings = Settings()

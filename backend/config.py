from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    secret_key: str = "changeme-please-set-a-secure-secret-key"
    caddyfile_path: str = "/data/Caddyfile"
    caddy_admin_url: str = "http://host.docker.internal:2019"
    caddy_version: str = "latest"
    totp_data_path: str = "/data/app/totp.json"
    caddy_container: str = "caddy"
    caddy_log_file: str = ""  # if set, read logs from this file instead of Docker socket
    username: str = "admin"
    password: str = ""

    class Config:
        env_file = ".env"


settings = Settings()

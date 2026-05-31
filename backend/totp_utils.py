import json
import os

import pyotp

from config import settings


def get_secret() -> str | None:
    path = settings.totp_data_path
    if not os.path.exists(path):
        return None
    try:
        with open(path) as f:
            return json.load(f).get("secret")
    except Exception:
        return None


def is_enabled() -> bool:
    return get_secret() is not None


def generate_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(secret: str, username: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=username, issuer_name="Caddy Editor")


def verify(code: str, secret: str | None = None) -> bool:
    s = secret or get_secret()
    if not s:
        return True
    return pyotp.TOTP(s).verify(code, valid_window=1)


def save(secret: str):
    path = settings.totp_data_path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump({"secret": secret}, f)


def disable():
    path = settings.totp_data_path
    if os.path.exists(path):
        os.remove(path)

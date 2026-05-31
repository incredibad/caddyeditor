import asyncio
import io
import os
import platform
import stat
import struct
import subprocess
import tarfile
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from auth import create_access_token, get_current_user
from config import settings
import totp_utils

STATIC_DIR = "/app/static"
CADDY_BIN = "/usr/local/bin/caddy"
ARCH_MAP = {"x86_64": "amd64", "aarch64": "arm64", "armv7l": "armv7"}


async def download_caddy():
    version = settings.caddy_version
    arch = ARCH_MAP.get(platform.machine(), "amd64")

    # For a pinned version, skip download if the right version is already present
    if os.path.exists(CADDY_BIN) and version != "latest":
        result = subprocess.run([CADDY_BIN, "version"], capture_output=True, text=True)
        if f"v{version}" in result.stdout:
            return

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        if version == "latest":
            resp = await client.get(
                "https://api.github.com/repos/caddyserver/caddy/releases/latest",
                headers={"Accept": "application/vnd.github+json"},
            )
            resp.raise_for_status()
            version = resp.json()["tag_name"].lstrip("v")

        url = (
            f"https://github.com/caddyserver/caddy/releases/download/"
            f"v{version}/caddy_{version}_linux_{arch}.tar.gz"
        )
        print(f"Downloading caddy v{version} ({arch})...")
        resp = await client.get(url)
        resp.raise_for_status()

    with tarfile.open(fileobj=io.BytesIO(resp.content)) as tar:
        member = tar.getmember("caddy")
        with open(CADDY_BIN, "wb") as f:
            f.write(tar.extractfile(member).read())

    os.chmod(CADDY_BIN, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
    print(f"caddy v{version} ready at {CADDY_BIN}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(download_caddy())
    yield


app = FastAPI(title="Caddy Editor", docs_url=None, redoc_url=None, lifespan=lifespan)


class LoginRequest(BaseModel):
    username: str
    password: str
    totp_code: str | None = None


class TotpEnableRequest(BaseModel):
    secret: str
    code: str


class TotpDisableRequest(BaseModel):
    code: str


class CaddyfileContent(BaseModel):
    content: str


class FormatRequest(BaseModel):
    content: str


@app.post("/auth/login")
async def login(request: LoginRequest):
    if not settings.password:
        token = create_access_token({"sub": "admin"})
        return {"access_token": token, "token_type": "bearer"}

    if request.username != settings.username or request.password != settings.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if totp_utils.is_enabled():
        if not request.totp_code:
            return {"totp_required": True}
        if not totp_utils.verify(request.totp_code):
            raise HTTPException(status_code=401, detail="Invalid TOTP code")

    token = create_access_token({"sub": request.username})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/totp/status")
async def totp_status(user=Depends(get_current_user)):
    return {"enabled": totp_utils.is_enabled()}


@app.post("/api/totp/setup")
async def totp_setup(user=Depends(get_current_user)):
    secret = totp_utils.generate_secret()
    uri = totp_utils.provisioning_uri(secret, user["username"])
    return {"secret": secret, "uri": uri}


@app.post("/api/totp/enable")
async def totp_enable(body: TotpEnableRequest, user=Depends(get_current_user)):
    if not totp_utils.verify(body.code, secret=body.secret):
        raise HTTPException(status_code=400, detail="Invalid TOTP code — check your authenticator and try again")
    totp_utils.save(body.secret)
    return {"message": "TOTP enabled"}


@app.get("/api/logs")
async def get_logs(tail: int = 500, user=Depends(get_current_user)):
    if settings.caddy_log_file:
        return _logs_from_file(settings.caddy_log_file, tail)
    return await _logs_from_docker(settings.caddy_container, tail)


def _logs_from_file(path: str, tail: int) -> dict:
    try:
        with open(path, "r") as f:
            all_lines = [l.rstrip("\n") for l in f if l.strip()]
        return {"lines": all_lines[-tail:], "source": path}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Log file not found: {path}")
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied reading {path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def _logs_from_docker(container: str, tail: int) -> dict:
    try:
        transport = httpx.AsyncHTTPTransport(uds="/var/run/docker.sock")
        async with httpx.AsyncClient(transport=transport, base_url="http://docker", timeout=10.0) as docker:
            resp = await docker.get(
                f"/containers/{container}/logs",
                params={"stdout": "1", "stderr": "1", "tail": str(tail), "follow": "0"},
            )
        if resp.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Container '{container}' not found")
        resp.raise_for_status()
        return {"lines": _parse_docker_logs(resp.content), "source": f"container:{container}"}
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail="Docker socket not available — mount /var/run/docker.sock or set CADDY_LOG_FILE",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _parse_docker_logs(data: bytes) -> list[str]:
    """Strip Docker's 8-byte frame headers and split into log lines."""
    lines = []
    offset = 0
    while offset + 8 <= len(data):
        size = struct.unpack(">I", data[offset + 4: offset + 8])[0]
        offset += 8
        chunk = data[offset: offset + size].decode("utf-8", errors="replace")
        for line in chunk.splitlines():
            if line.strip():
                lines.append(line)
        offset += size
    return lines


@app.post("/api/totp/disable")
async def totp_disable(body: TotpDisableRequest, user=Depends(get_current_user)):
    if not totp_utils.verify(body.code):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")
    totp_utils.disable()
    return {"message": "TOTP disabled"}


@app.get("/api/caddyfile")
async def get_caddyfile(user=Depends(get_current_user)):
    try:
        with open(settings.caddyfile_path, "r") as f:
            return {"content": f.read(), "path": settings.caddyfile_path}
    except FileNotFoundError:
        return JSONResponse(
            status_code=404,
            content={"detail": f"Caddyfile not found at {settings.caddyfile_path}", "path": settings.caddyfile_path},
        )
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied reading {settings.caddyfile_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/caddyfile")
async def save_caddyfile(body: CaddyfileContent, user=Depends(get_current_user)):
    try:
        os.makedirs(os.path.dirname(settings.caddyfile_path), exist_ok=True)
        with open(settings.caddyfile_path, "w") as f:
            f.write(body.content)
        return {"message": "Saved successfully"}
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied writing {settings.caddyfile_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/format")
async def format_caddyfile(body: FormatRequest, user=Depends(get_current_user)):
    if not os.path.exists(CADDY_BIN):
        raise HTTPException(status_code=503, detail="caddy binary not ready yet — try again in a moment")
    try:
        result = subprocess.run(
            [CADDY_BIN, "fmt", "-"],
            input=body.content,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=400, detail=result.stderr.strip() or "Format failed")
        return {"content": result.stdout}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Format timed out")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/reload")
async def reload_caddy(user=Depends(get_current_user)):
    try:
        with open(settings.caddyfile_path, "r") as f:
            content = f.read()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.caddy_admin_url}/load",
                content=content.encode(),
                headers={"Content-Type": "text/caddyfile"},
                timeout=10.0,
            )

        if response.status_code == 200:
            return {"message": "Caddy reloaded successfully"}

        raise HTTPException(
            status_code=500,
            detail=f"Caddy admin API returned {response.status_code}: {response.text}",
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Caddyfile not found — save it first")
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=f"Cannot connect to Caddy admin API at {settings.caddy_admin_url}",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# SPA catch-all — must be last
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if not os.path.exists(STATIC_DIR):
        raise HTTPException(status_code=404, detail="Frontend not built")

    candidate = os.path.normpath(os.path.join(STATIC_DIR, full_path))
    if not candidate.startswith(os.path.abspath(STATIC_DIR)):
        raise HTTPException(status_code=403, detail="Forbidden")

    if os.path.isfile(candidate):
        return FileResponse(candidate)

    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

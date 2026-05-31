import os
import subprocess

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from auth import create_access_token, get_current_user
from config import settings

app = FastAPI(title="Caddy Editor", docs_url=None, redoc_url=None)

STATIC_DIR = "/app/static"


class LoginRequest(BaseModel):
    username: str
    password: str


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

    token = create_access_token({"sub": request.username})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


@app.get("/api/health")
async def health():
    return {"status": "ok"}


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
    try:
        result = subprocess.run(
            ["caddy", "fmt", "-"],
            input=body.content,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=400, detail=result.stderr.strip() or "Format failed")
        return {"content": result.stdout}
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="caddy binary not found in container")
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

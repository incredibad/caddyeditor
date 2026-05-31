> [!WARNING]
> This project was built with AI assistance. Code may not meet production safety standards — review carefully before deploying in sensitive environments.
>
> **Note from the author:** This is a personal sysadmin tool. Keep it on your local network or behind auth. If you expose it publicly, set a strong `PASSWORD` and enable TOTP.

A self-hosted web UI for editing your Caddyfile and reloading Caddy — with a Monaco-based editor, Caddy syntax highlighting, log viewer, and optional TOTP two-factor auth.

---

## Features

- **Monaco editor** — Full code editor with Caddyfile syntax highlighting, bracket matching, folding, and `Ctrl+S` to save
- **Save & Reload** — Write the Caddyfile to disk and trigger a live reload via Caddy's admin API in one click
- **Format** — Runs `caddy fmt` on the current content and replaces the editor contents with the result
- **Log viewer** — Fetch and display Caddy logs with two tabs:
  - **Pretty** — Parses JSON log lines into human-readable entries with coloured level badges, timestamps, inline HTTP fields, and expandable full JSON
  - **Raw** — Plain monospace log dump
- **TOTP two-factor auth** — Optional TOTP 2FA via any authenticator app (Google Authenticator, Authy, etc.)
- **Responsive** — Works on mobile; action buttons move to a second row on small screens
- **Dark theme** — Consistent dark UI throughout

---

## Installation

### Docker Compose (recommended)

```yaml
services:
  caddyeditor:
    image: incredibad/caddyeditor:latest
    container_name: caddyeditor
    ports:
      - "7285:7285"
    volumes:
      - /etc/caddy/Caddyfile:/data/Caddyfile   # path to your Caddyfile on the host
      - caddyeditor_data:/data/app              # persists TOTP secret etc.
      - /var/run/docker.sock:/var/run/docker.sock:ro  # for log fetching (Docker Caddy only)
    environment:
      - CADDYFILE_PATH=/data/Caddyfile
      - CADDY_ADMIN_URL=http://caddy:2019       # or http://localhost:2019 with network_mode: host
      - SECRET_KEY=change-this-to-a-random-secret   # openssl rand -hex 32
      - USERNAME=admin
      - PASSWORD=                               # leave blank to disable login
      - CADDY_CONTAINER=caddy                   # Docker: name of Caddy container
      - CADDY_LOG_FILE=                         # native: path to Caddy log file (overrides Docker socket)
    networks:
      - proxy   # must be the same network as your Caddy container
    restart: unless-stopped

networks:
  proxy:
    external: true

volumes:
  caddyeditor_data:
```

Then run:

```bash
docker compose up -d
```

Open **http://your-server:7285**.

### Updating

```bash
docker compose pull && docker compose up -d
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CADDYFILE_PATH` | `/data/Caddyfile` | Path to the Caddyfile inside the container — must match the volume mount |
| `CADDY_ADMIN_URL` | `http://host.docker.internal:2019` | URL of Caddy's admin API, reachable from inside the container |
| `CADDY_VERSION` | `latest` | Caddy version to use for `caddy fmt` — set to match your running Caddy (`docker exec caddy caddy version`) |
| `SECRET_KEY` | *(insecure default)* | Random secret for signing auth tokens — **always change this** |
| `USERNAME` | `admin` | Login username (only used when `PASSWORD` is set) |
| `PASSWORD` | *(empty)* | Login password — leave blank to disable authentication entirely |
| `CADDY_CONTAINER` | `caddy` | Name of the Caddy Docker container used for log fetching |
| `CADDY_LOG_FILE` | *(empty)* | Path to a Caddy log file — if set, used instead of the Docker socket for logs |
| `TOTP_DATA_PATH` | `/data/app/totp.json` | Where the TOTP secret is stored — persisted via the `caddyeditor_data` volume |

---

## Networking

### Caddy runs in Docker

Join both containers to the same Docker network (e.g. `proxy`) and set:

```yaml
CADDY_ADMIN_URL=http://caddy:2019
```

Caddy must have `admin 0.0.0.0:2019` in its global options block so containers on the same network can reach the admin API:

```caddyfile
{
    admin 0.0.0.0:2019
}
```

### Caddy runs natively

Use `network_mode: host` and set:

```yaml
CADDY_ADMIN_URL=http://localhost:2019
```

Remove the `proxy` network section and the `extra_hosts` entry.

---

## Logs

### Docker Caddy (default)

Mount the Docker socket (`:ro`) and set `CADDY_CONTAINER` to your Caddy container name. Leave `CADDY_LOG_FILE` blank.

### Native Caddy

Configure Caddy to write JSON logs to a file:

```caddyfile
{
    log {
        output file /var/log/caddy/caddy.log {
            roll_size 10mb
        }
    }
}
```

Then mount the file and set `CADDY_LOG_FILE`:

```yaml
volumes:
  - /var/log/caddy/caddy.log:/var/log/caddy/caddy.log:ro
environment:
  - CADDY_LOG_FILE=/var/log/caddy/caddy.log
```

---

## Two-Factor Authentication

TOTP is off by default. To enable it:

1. Make sure `PASSWORD` is set (TOTP has no effect without a password)
2. Open the hamburger menu → **Two-factor auth**
3. Scan the QR code with your authenticator app and enter the verification code

The TOTP secret is stored in the `caddyeditor_data` volume and survives container restarts and updates.

---

## Tech Stack

- **Backend**: Python, FastAPI, uvicorn, httpx, pyotp
- **Frontend**: React 18, Vite, Tailwind CSS, Monaco Editor, Lucide icons
- **Auth**: JWT + optional TOTP

## License

MIT

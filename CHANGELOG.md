# Changelog

## [1.1.0] - 2026-05-31

### Added
- **Log viewer** — new Logs page (hamburger menu → Logs) with two tabs:
  - Pretty: parses JSON log lines into human-readable entries with coloured level badges, timestamps, inline HTTP fields (method / URI / status / duration), and expandable full JSON on click
  - Raw: plain monospace dump
  - Configurable tail (100–2000 lines), manual refresh
  - Supports Docker Caddy (via Docker socket) and native Caddy (via `CADDY_LOG_FILE`)
- **Format button** — runs `caddy fmt` on the current editor content; caddy binary is downloaded at startup based on `CADDY_VERSION` env var
- **TOTP two-factor authentication** — optional TOTP 2FA via any authenticator app; setup/disable modal with QR code, manual key copy, and verification step; secret persisted in Docker-managed volume
- **Hamburger menu** — replaces the logout button; contains Logs, Two-factor auth, and Log out
- **Responsive mobile layout** — action buttons move to a full-width second row below the header on small screens
- **Favicon** — SVG favicon using the server icon in primary violet
- **Persistent reload toast** — reload result stays on screen with an X to dismiss; green on success, red on failure

### Changed
- `CADDY_VERSION` env var controls which caddy binary version is fetched for `caddy fmt` (defaults to `latest`)
- docker-compose.yml now has detailed inline comments explaining every option
- docker-compose.yml includes a `caddyeditor_data` named volume for app state persistence
- Container name set to `caddyeditor` in docker-compose

### Fixed
- `package-lock.json` added so `npm ci` works in Docker build
- `.gitignore` added to prevent `node_modules` from being committed

---

## [1.0.0] - 2026-05-31

Initial release.

### Features
- Monaco editor with custom Caddyfile syntax highlighting (keywords, placeholders, matchers, comments)
- Save Caddyfile to disk
- Reload Caddy via admin API (`POST /load` with `Content-Type: text/caddyfile`)
- Optional username/password login with JWT auth
- Multi-stage Docker build; GitHub Actions CI/CD to Docker Hub
- `network_mode: host` or shared Docker network support for reaching Caddy's admin API

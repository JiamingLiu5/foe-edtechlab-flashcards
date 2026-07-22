# Deploying to your Linux server

This assumes Ubuntu LTS (or similar) with Docker Engine + the Compose plugin installed
(`docker --version` and `docker compose version` should both work).

## 1. Get the code onto the server

```bash
sudo mkdir -p /opt/flashcards
sudo chown $USER /opt/flashcards
git clone <your-repo-url> /opt/flashcards
cd /opt/flashcards/infra
```

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

- `APP_DOMAIN` / `APP_ORIGIN` — your server's DNS name. Caddy needs a real domain
  pointing at the server to obtain a Let's Encrypt certificate. For a quick local
  test without DNS, see "Testing without a domain" below.
- `POSTGRES_PASSWORD`, `SESSION_SECRET` — generate with `openssl rand -hex 32`.
- `ANTHROPIC_API_KEY` — used for card generation and self-check grading.
- `GEMINI_API_KEY` — used for the PDF OCR/transcription step (Gemini 2.5 Flash
  Lite), ahead of the Claude generation call. Get one from Google AI Studio.
- `SMTP_HOST` etc. — optional. If left blank, magic sign-in links are written
  to the backend container's logs (`docker compose logs -f backend`) instead
  of emailed. Fine for a first deploy/demo; configure real SMTP before real
  users rely on it.

## 3. Bring the stack up

```bash
docker compose up -d --build
```

This builds and starts `proxy` (Caddy, TLS), `backend` (API — runs
`prisma migrate deploy` on boot, see `backend/Dockerfile`), `worker`
(PDF generation jobs), `db` (Postgres), `redis`. First boot will take a
few minutes while images build and Caddy obtains its certificate.

Check it's healthy:

```bash
curl https://$APP_DOMAIN/api/health   # -> {"ok":true}
docker compose logs -f backend worker
```

## 4. Survive a reboot

```bash
sudo cp flashcards.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now flashcards
```

## Updating after a code change

```bash
cd /opt/flashcards
git pull
cd infra
docker compose up -d --build
```

`prisma migrate deploy` runs automatically as part of the backend container's
startup command, so new migrations apply on the next `up -d --build`.

## Testing without a domain

If you're trying this out before DNS is pointed at the box, edit
`infra/Caddyfile` and replace the `{$APP_DOMAIN}` line with:

```
:80 {
	...
}
```

(drop the HTTPS/ACME bits) and set `APP_ORIGIN=http://<server-ip>` in `.env`.
Switch back to the real domain block before exposing this beyond your own
testing — magic-link cookies are set `secure` in production and won't work
over plain HTTP from a browser's perspective once `NODE_ENV=production`
either way, so this mode is for `curl`/local testing, not real logins.

## Backups

Nightly `pg_dump`, shipped off-box, isn't wired up yet (design.md §8) — for
now, back up manually:

```bash
docker compose exec db pg_dump -U flashcards flashcards | gzip > backup-$(date +%F).sql.gz
```

## What's intentionally out of scope for this prototype

- Real Microsoft Entra ID SSO — this build uses the email magic-link fallback
  from design.md §7. Swapping in Entra ID later means adding an OAuth module
  under `backend/src/modules/auth/` and pointing the frontend's login screen
  at it; the session-cookie plumbing underneath doesn't change.
- A real Anki `.apkg` export — `/api/decks/:id/export/anki` currently returns
  a tab-separated `.txt` file, which Anki's *File > Import* handles natively.
  A binary `.apkg` (SQLite-based) exporter is a reasonable later upgrade.
- Automated nightly backups / off-box shipping.
- The GitHub Actions SSH deploy step (`.github/workflows/ci.yml` builds and
  publishes images to GHCR; wiring that into an automatic deploy to this
  server is left as a manual `git pull && docker compose up -d --build` for
  now).

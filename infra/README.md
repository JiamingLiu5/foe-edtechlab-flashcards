# Deploying Flashcards with Docker Compose

This guide targets an Ubuntu LTS server (or similar) with Docker Engine and the Compose plugin installed:

```sh
docker --version
docker compose version
```

The production-like stack contains Caddy, the frontend, Fastify backend, generation worker, PostgreSQL, and Redis. Caddy serves the built frontend and proxies `/api/*` to the backend.

## 1. Get the code onto the server

```sh
sudo mkdir -p /opt/flashcards
sudo chown "$USER" /opt/flashcards
git clone <your-repo-url> /opt/flashcards
cd /opt/flashcards/infra
```

## 2. Configure the environment

```sh
cp .env.example .env
```

Edit `infra/.env` and set at least:

- `APP_DOMAIN` and `APP_ORIGIN` to the server's public DNS name. Caddy needs a real DNS record to obtain a Let's Encrypt certificate.
- `POSTGRES_PASSWORD` and `SESSION_SECRET` to random values. Generate a session secret with `openssl rand -hex 32`.
- `DATABASE_URL` to use the same database name, user, password, and service host as the Postgres settings.
- `GEMINI_API_KEY`, which is required for PDF OCR and is also the fallback AI provider.
- `ANTHROPIC_API_KEY` if Claude should be used for the configured generation/grading tasks; it is optional.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optionally `ADMIN_NAME` if an initial admin account should be bootstrapped automatically.

The environment file also controls upload limits, AI model names, and daily quotas. Keep it outside version control; the repository's `.gitignore` is expected to exclude populated local environment files.

## 3. Start the stack

From the repository root:

```sh
docker compose -f infra/docker-compose.yml up -d --build
```

The backend container runs `prisma migrate deploy` during startup. The first build may take several minutes because native dependencies are compiled for the backend and worker images, and Caddy may need to obtain its certificate.

Check the application and logs:

```sh
curl https://$APP_DOMAIN/api/health
docker compose -f infra/docker-compose.yml logs -f backend worker
```

The health endpoint should return `{"ok":true}`.

## 4. Survive a reboot

The repository includes a systemd unit. Install it after verifying the Compose deployment:

```sh
sudo cp infra/flashcards.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now flashcards
sudo systemctl status flashcards
```

## 5. Update the deployment

The current deployment process is manual:

```sh
cd /opt/flashcards
git pull
docker compose -f infra/docker-compose.yml up -d --build
```

The backend applies any pending Prisma migrations on startup. Check `/api/health` and the backend/worker logs after the update.

## 6. Testing without a public domain

For private HTTP testing, replace the `{$APP_DOMAIN}` block in `infra/Caddyfile` with a `:80` block and set:

```dotenv
APP_DOMAIN=:80
APP_ORIGIN=http://<server-ip>
```

Do not expose this configuration publicly. Production cookies use secure settings, and a real HTTPS origin is required for a normal login deployment.

## 7. Backups

Automated off-box backups are not wired into this repository. Take a manual compressed dump while the stack is running:

```sh
docker compose -f infra/docker-compose.yml exec db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "backup-$(date +%F).sql.gz"
```

Store the dump outside the server and periodically test restoring it. Protect it as sensitive application data.

## 8. Operational limits and current exclusions

- Microsoft Entra SSO is not implemented; use the approved email/password flow.
- AI imports require external model credentials and a running worker.
- Uploaded PDFs are retained as deck sources for later AI review; confirm the pilot's retention and copyright policy before production use.
- The Anki endpoint now generates a native `.apkg` package containing a SQLite collection; import compatibility with the pilot's exact Anki Desktop release still needs verification.
- Automated CI/CD and automatic deploys are not included. Updates remain a reviewed manual `git pull` and Compose rebuild.

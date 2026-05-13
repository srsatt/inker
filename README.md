[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/yellow_img.png)](https://buymeacoffee.com/wojo_o)

# Inker v0.3.3

Self-hosted e-ink device management server built for the homelab community. Works with [TRMNL](https://usetrmnl.com/) devices (supports firmware 1.7.8) and any BYOD e-ink display. Design screens, create custom widgets with live data from your local network, and manage your displays from a modern web interface.

Inker is heading in its own direction — focusing on homelab integrations like server monitoring, smart home dashboards, network stats, and self-hosted service displays. TRMNL device compatibility is maintained, but the plugin ecosystem will be Inker-native.

![Dashboard](https://github.com/user-attachments/assets/fd9affac-5c57-4448-9338-ea8f83add08a)

## Features

- **Screen Designer** — Drag & drop widget placement, snap guides, freehand drawing, auto-fit zoom for any resolution
- **Built-in Widgets** — Clock, date, text, weather, countdown, days until, QR code, image, GitHub stars, battery, WiFi, device info
- **Custom Widgets** — Connect to any JSON API or RSS feed (including local network sources), JavaScript transformations, grid layouts
- **Plugins** — Coming soon — homelab-native integrations for server monitoring, smart home, network stats
- **Playlists** — Rotate multiple screens on devices automatically
- **Device Management** — Auto-provisioning, firmware 1.7.8 support, real-time status, logs
- **BYOD Support** — Register any e-ink device manually with custom screen resolution
- **No external infra** — Runs locally with Bun and SQLite, no database or cache service required

## Screenshots

| Screen Designer | Devices | Screens |
|:-:|:-:|:-:|
|  ![Devices](https://github.com/user-attachments/assets/e6ba89e7-7bac-419e-bb2e-54a1c0350e07) | ![Screens](https://github.com/user-attachments/assets/510c7d5c-730a-457d-af7d-50ee04b2dc43) | ![Screen Designer](https://github.com/user-attachments/assets/0e4fb32a-bde5-475f-8800-49b06cfce2e9) |

| List of sources | Custom Data Sources | Custom Widgets |
|:-:|:-:|:-:|
| ![Extensions](https://github.com/user-attachments/assets/534b5104-8f1c-4a42-8c58-f2cef74dbc92) | ![Custom data sources](https://github.com/user-attachments/assets/03ed0dc8-7ae0-44fa-ace7-890b5ec8f385) | ![Custom widgets](https://github.com/user-attachments/assets/0eb10812-568a-46db-b58e-7e82c19ea403) |

## Quick start

### Local Bun

```bash
bun run install:all
bun run dev
```

Open **http://localhost:3337** and log in with PIN `1111`.

The dev launcher creates the SQLite database at `backend/data/inker.db`, syncs the Prisma schema, seeds built-in models/templates, then starts:

- public app: `http://localhost:3337`
- internal backend: `http://localhost:3338`

In dev, Vite owns port `3337` and proxies `/api` plus `/uploads` to the backend. TRMNL devices should use the same public URL as the browser, for example `http://de-unit-2506.local:3337`.

For single-port mode without Vite HMR:

```bash
bun run dev:single
```

Open **http://localhost:3337**. This builds the frontend and serves it from the Nest backend.

### MCP server

Inker includes a local stdio MCP server for agent-driven CRUD over screen designs, widgets, data sources, custom widgets, and playlists:

```bash
bun run mcp
```

Example Codex/Claude-style command:

```json
{
  "command": "bun",
  "args": ["run", "mcp"],
  "cwd": "/path/to/inker"
}
```

The server uses the same SQLite default as the app (`backend/data/inker.db`) unless `DATABASE_URL` is set.

If your Mac cannot expose port `3337` to the LAN, but a Raspberry Pi can, bring up the temporary SSH proxy:

```bash
bun run proxy:rpi
```

By default it exposes `http://birdnet-pi.local:3337` and forwards traffic back to the local app on `127.0.0.1:3337`. Stop it with:

```bash
bun run proxy:rpi:down
```

### Docker Compose

```yaml
# docker-compose.yml
services:
  inker:
    image: wojooo/inker:latest
    container_name: inker
    restart: unless-stopped
    ports:
      - "80:3337"
    volumes:
      - sqlite_data:/app/data
      - uploads_data:/app/uploads
    environment:
      TZ: UTC
      ADMIN_PIN: "1111"  # Quotes required — YAML strips leading zeros without them
      DATABASE_URL: "file:../data/inker.db"

volumes:
  sqlite_data:
  uploads_data:
```

```bash
docker compose up -d
```

Open **http://your-server-ip** and log in with PIN `1111`.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_PIN` | Login PIN | `1111` |
| `TZ` | Timezone for widgets | `UTC` |
| `HOST` | Backend listen host | `127.0.0.1` |
| `PORT` | Backend port | `3337` |
| `VITE_HOST` | Frontend dev listen host | `127.0.0.1` |
| `VITE_PORT` | Frontend dev port | `3337` |
| `VITE_BACKEND_PORT` | Frontend dev server backend target | `3338` |
| `DATABASE_URL` | SQLite database URL | `file:../data/inker.db` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated, or `*` for all) | same-origin |

Pass with `-e`:
```bash
docker run -d \
  --name inker \
  --restart unless-stopped \
  -p 80:3337 \
  -e ADMIN_PIN="1111" \
  -e TZ=Europe/Warsaw \
  -e DATABASE_URL="file:../data/inker.db" \
  -v inker_data:/app/data \
  -v inker_uploads:/app/uploads \
  inker:latest
```

### Build from source

```bash
git clone https://github.com/wojo-o/inker.git
cd inker
bun run install:all
bun run dev
```

## Updating

```bash
bun run install:all
bun run db:init
```

All data (screens, devices, playlists, settings) is preserved in `backend/data/inker.db`. Uploads are stored under `backend/uploads/`.

## Troubleshooting

If something isn't working after an update or on first run, reset local runtime state and start fresh:

```bash
rm -rf backend/data backend/uploads
bun run dev
```

> **Note:** This removes all data (database, uploads). Only use on a fresh install or when you don't mind losing data.

## Testing

```bash
cd backend && bun test      # 395 tests
cd frontend && bun run test  # 19 tests
```

## License

Source Available — see [LICENSE](LICENSE) for details.

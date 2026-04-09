---
title: Reverse proxy (nginx)
icon: lucide/network
---

# Reverse proxy (nginx)

Fluiddified talks to Moonraker in **two** ways:

1. **HTTP** — REST calls (printer state, files, login, and so on).
2. **WebSocket** — JSON-RPC on **`/websocket`**, after Moonraker issues a short-lived token via **`/access/oneshot_token`**.

A reverse proxy can forward HTTP correctly while **breaking WebSockets** if `Upgrade` and `Connection` headers are not passed through. The UI may then show API or camera behaviour that looks fine while the **main Moonraker socket** fails (for example “WebSocket is closed before the connection is established” in the browser console).

Camera streams often use **other URLs** (MJPEG, go2rtc, and so on). Treat **Moonraker’s `/websocket` path** as a separate check from “camera works.”

## What must reach Moonraker

From the browser’s perspective, the **printer URL** you configure in Fluiddified (same origin used for `apiUrl`) must allow:

| Path                     | Purpose                                         |
| ------------------------ | ----------------------------------------------- |
| `/access/oneshot_token`  | HTTP; returns a token used to open the socket   |
| `/websocket?token=…`     | WebSocket; JSON-RPC used by the UI              |
| Other Moonraker routes   | `/server/info`, file API, and so on             |

Fluiddified builds the WebSocket URL from the same base as the API (see application code: `getApiUrls` uses `ws://` or `wss://` and appends `/websocket`).

## nginx configuration

### 1. WebSocket upgrade map (recommended)

Define a `map` once in `http { ... }` (not inside `server`):

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

### 2. Proxy Moonraker with HTTP/1.1 and Upgrade headers

If **everything** under your vhost goes to Moonraker (typical when the UI is static files and API is the same host, or when you only expose Moonraker):

```nginx
server {
    listen 80;
    server_name printer.example.com;

    location / {
        proxy_pass http://127.0.0.1:7125;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 86400;
        proxy_buffering off;
    }
}
```

- **`proxy_http_version 1.1`** — required for WebSocket upgrades.
- **`Upgrade` / `Connection`** — required so `/websocket` can upgrade.
- **`proxy_read_timeout`** — long-lived socket; avoid short defaults closing idle connections.
- **`proxy_buffering off`** — avoids nginx buffering WebSocket traffic in problematic ways on some setups.

Adjust `proxy_pass` if Moonraker listens elsewhere.

### 3. Split UI static files and Moonraker

If **static Fluiddified** is served from disk and only **some paths** go to Moonraker, ensure **`/websocket`** and **`/access/`** (and the rest of Moonraker you use) are included in the **same** upstream block that has the WebSocket headers. A common mistake is proxying `/access/` to Moonraker but leaving `/websocket` to hit the static site or another upstream.

There is no single pattern for every layout; verify with the [Verification](#verification) steps after any change.

### 4. HTTPS in front of HTTP Moonraker

If the browser loads the UI over **`https://`**, the WebSocket URL must use **`wss://`** to the same policy-safe origin. Fluiddified derives `wss://` when the configured API base uses `https://`. Terminate TLS on nginx and either proxy to Moonraker over HTTP on localhost or run Moonraker behind TLS per Moonraker docs.

## Verification

Work through these on the **same hostname and port** you enter as the printer URL in Fluiddified (not only an IP:port that bypasses nginx).

### 1. Moonraker HTTP responds

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://YOUR_HOST/server/info
```

You should see **`200`** (or Moonraker’s expected response if you use auth). If this fails, fix HTTP routing before WebSockets.

### 2. Browser DevTools — WebSocket

1. Open Fluiddified and select the printer that uses the nginx URL.
2. Open **Developer Tools** → **Network**.
3. Filter by **WS** (WebSockets).
4. Reload or reconnect.

You should see a request to **`…/websocket?token=…`** with status **101 Switching Protocols**. If it fails with **403**, **502**, or closes immediately, the proxy is not upgrading the connection correctly.

### 3. Compare with direct Moonraker (optional, on the Pi)

When you are on the LAN, temporarily point Fluiddified at **`http://PI_LOCAL_IP:7125`**. If the socket works direct but fails through nginx, the problem is proxy configuration, not Fluiddified.

## Remote UI, printer only on the LAN

If you host **only** the Fluiddified static build on a public server but the Raspberry Pi is **not** exposed, the browser cannot reach Moonraker unless you provide a **reachable URL** for the Pi (VPN, tunnel, or nginx on a host that can reach the Pi). The printer URL in Fluiddified must be that **reachable** API base; nginx must forward both HTTP and **`/websocket`** to Moonraker on the Pi.

## Troubleshooting

- **API works, WebSocket fails** — Confirm `Upgrade`, `Connection`, and `proxy_http_version 1.1` on the `location` that serves `/websocket`.
- **Works on LAN IP, fails on hostname** — Compare `server` / `location` blocks; check TLS and DNS only on the public name.
- **Intermittent disconnects** — Raise `proxy_read_timeout`; check upstream idle timeouts and Moonraker restarts.
- **HTTPS page but `ws://` in the console** — Use an **`https://`** API base so the app opens **`wss://`**, or serve the UI over HTTP on a trusted network only.

## See also

- [Configuration](configuration.md) — Moonraker `[authorization]` and CORS
- [Multiple printers](features/multiple-printers.md) — instance URLs

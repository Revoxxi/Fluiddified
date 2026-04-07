# IMP-04: Built-in Proxy & Internet Exposure Security

## Status: PLANNED

## Problem Statement

Exposing a Klipper printer to the internet requires:

1. **Single entry point** — one public port, no direct Moonraker/camera exposure
2. **Server-side auth enforcement** — unauthenticated users get nothing but the login page
3. **Camera proxying** — streams accessible only to authenticated users through Fluiddified
4. **WebSocket proxying** — Moonraker WS must work through the proxy, with read-only access for guests
5. **No external dependencies** — everything runs inside Fluiddified, no nginx/Caddy required

Currently Fluidd connects to Moonraker and cameras via **separate origins** (different ports). The UI discovers Moonraker's URL dynamically and talks to it directly. This means exposing Fluidd requires also exposing Moonraker and camera ports — which have no RBAC.

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Built-in Fastify proxy (no nginx/Caddy) | Single process, no external deps, stays in Node.js |
| Single-printer proxy only | Multi-printer routing adds complexity; each printer gets its own Fluiddified instance |
| Guests get read-only WebSocket | Without WS, guest dashboards have no live data (temps, progress). Client-side RBAC prevents sending commands; proxy filters outbound WS messages as defense-in-depth |
| TLS handled by Cloudflare (not the proxy) | Proxy runs HTTP behind Cloudflare Tunnel; no cert management needed |
| Dev mode = no proxy | `npm run dev` connects directly to Moonraker as before; proxy only for production |
| Moonraker `trusted_clients` must be locked down | Proxy is meaningless if Moonraker accepts direct connections; startup validation warns if misconfigured |

## Auth Model (strict)

```
Unauthenticated  → Login page only. Nothing else. No camera, no API, no WebSocket.
Guest (logged in) → Camera stream, dashboard monitoring (read-only WS), no control commands.
User (logged in)  → Full Moonraker API + WS access. Print, control, upload.
Owner (logged in) → Full access + settings, user management, config editing.
```

**There is no anonymous/public access.** Every request except `/access/login`, `/access/refresh_jwt`, and static assets requires a valid JWT.

## Current Architecture

### API URL Discovery (`src/init.ts`)

1. Load `config.json` from the UI's own origin
2. Check localStorage `appInstances` for saved endpoints
3. Fallback: probe `protocol://hostname:7125` (or `:7130` for HTTPS)
4. First endpoint that accepts a WebSocket probe wins
5. `httpClientActions.defaults.baseURL` = that absolute Moonraker URL
6. WebSocket connects to `ws(s)://host/websocket?token=...`

### Camera URLs (`src/mixins/camera.ts`)

- `buildAbsoluteUrl(url)` resolves relative URLs against `document.URL` origin
- Default legacy paths: `/webcam/?action=stream` (same-origin relative)
- Moonraker stores `stream_url` and `snapshot_url` per webcam — can be relative or absolute
- MJPEG worker fetches with `mode: 'cors'`

### Key Insight

**Relative webcam URLs already resolve to the UI's origin.** When Fluiddified's built-in proxy serves everything from one origin, URL resolution works with zero client-side changes.

### Service Worker

`src/sw.ts` already excludes `/websocket`, `/printer`, `/api`, `/access`, `/webcam*` from SPA navigation handling — the proxy pattern is anticipated.

---

## Proposed Architecture

```
Cloudflare Tunnel (HTTPS termination)
    │
    ▼
┌───────────────────────────────────────────────────────────────┐
│              Fluiddified Server (Node.js, HTTP)                │
│              Single process, single port, single printer       │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  POST /access/login      → Moonraker login proxy          🔓  │
│  POST /access/refresh_jwt → Moonraker token refresh       🔓  │
│  GET  *.js|*.css|*.svg   → Static assets                  🔓  │
│                                                                │
│  ─── Everything below requires valid JWT ──────────────────── │
│                                                                │
│  GET  /                  → Fluiddified SPA                 🔒  │
│  GET  /api/*             → Moonraker HTTP API              🔒  │  minRole: user
│  GET  /printer/*         → Moonraker                       🔒  │  minRole: user
│  GET  /server/*          → Moonraker                       🔒  │  minRole: user
│  GET  /machine/*         → Moonraker                       🔒  │  minRole: user
│  POST /access/*          → Moonraker auth API              🔒  │  minRole: user
│  WS   /websocket         → Moonraker WS (read-only)       🔒  │  minRole: guest ⚠
│  WS   /websocket         → Moonraker WS (full)            🔒  │  minRole: user
│  GET  /webcam/*          → Camera stream                   🔒  │  minRole: guest
│                                                                │
│  🔓 = no auth required                                        │
│  🔒 = valid JWT required, role checked                        │
│  ⚠  = guest WS: receive only, outbound commands filtered     │
│                                                                │
└───────────────────────────────────────────────────────────────┘
    │           │           │
    ▼           ▼           ▼
 dist/       Moonraker   Camera
 (static)    (127.0.0.1  (127.0.0.1
             :7125)      :8080)
```

Moonraker and camera bind to `127.0.0.1` only — no direct internet access.

---

## Guest WebSocket: Read-Only Proxy

The critical design challenge: guests need live data (temperatures, print progress, printer state) which comes via Moonraker's WebSocket. But they must not be able to send control commands.

### Solution: WebSocket message filtering

The proxy establishes a WebSocket connection to Moonraker on behalf of the guest, but **filters outbound messages**:

```typescript
// server/wsFilter.ts

const GUEST_ALLOWED_METHODS = new Set([
  'server.info',
  'server.config',
  'server.temperature_store',
  'server.gcode_store',
  'server.history.list',
  'server.history.totals',
  'server.files.list',
  'server.files.metadata',
  'server.database.get_item',
  'server.announcements.list',
  'printer.info',
  'printer.objects.list',
  'printer.objects.query',
  'printer.objects.subscribe',
  'machine.system_info',
])

export function isGuestAllowedMessage (message: string): boolean {
  try {
    const parsed = JSON.parse(message)
    if (parsed.method && GUEST_ALLOWED_METHODS.has(parsed.method)) {
      return true
    }
    // Allow subscription responses and notifications (no method field)
    if (parsed.id != null && !parsed.method) return true
    return false
  } catch {
    return false
  }
}
```

**For `user` and `owner` roles:** WebSocket is proxied bidirectionally with no filtering — full Moonraker access.

**For `guest` role:** 
- **Server → Client (downstream):** All messages pass through (temps, state updates, notifications)
- **Client → Server (upstream):** Only whitelisted read-only methods allowed; control commands (`printer.gcode.script`, `printer.print.start`, etc.) are silently dropped

This gives guests a fully live dashboard while making it impossible to send commands even via devtools.

### WebSocket proxy implementation

```typescript
// server/proxy.ts — WebSocket handling

app.register(async function (app) {
  app.get('/websocket', { websocket: true, preHandler: roleGuard('guest') },
    (connection, req) => {
      const role = req.userRole
      const moonrakerWs = new WebSocket(
        `ws://127.0.0.1:${config.moonrakerPort}/websocket`
      )

      // Downstream: Moonraker → Client (always pass through)
      moonrakerWs.on('message', (data) => {
        connection.send(data.toString())
      })

      // Upstream: Client → Moonraker
      connection.on('message', (data) => {
        const message = data.toString()

        if (role === 'guest') {
          if (!isGuestAllowedMessage(message)) return // silently drop
        }

        moonrakerWs.send(message)
      })

      moonrakerWs.on('close', () => connection.close())
      connection.on('close', () => moonrakerWs.close())
    }
  )
})
```

---

## Moonraker `trusted_clients` Validation

If Moonraker is configured with permissive `trusted_clients` (e.g., `0.0.0.0/0`), any process on the machine can bypass auth. The proxy validates this on startup:

```typescript
// server/index.ts — startup check

async function validateMoonrakerConfig (config: ServerConfig) {
  try {
    const res = await fetch(
      `http://127.0.0.1:${config.moonrakerPort}/server/config`
    )
    const data = await res.json()
    const authConfig = data.result?.config?.authorization

    if (!authConfig) {
      console.warn('[WARN] Moonraker authorization section not found')
      return
    }

    const trusted = authConfig.trusted_clients ?? []
    const dangerous = trusted.some((cidr: string) =>
      cidr === '0.0.0.0/0' || cidr === '::/0'
    )

    if (dangerous) {
      console.error(
        '[SECURITY] Moonraker trusted_clients includes 0.0.0.0/0 — ' +
        'this bypasses all proxy auth! Set trusted_clients to only ' +
        '127.0.0.1 in moonraker.conf [authorization] section.'
      )
    }

    if (!authConfig.force_logins) {
      console.warn(
        '[WARN] Moonraker force_logins is not enabled. Recommended ' +
        'for internet exposure: set force_logins: True in moonraker.conf'
      )
    }
  } catch {
    console.warn('[WARN] Could not validate Moonraker config — is Moonraker running?')
  }
}
```

---

## Implementation

### Technology Choice

**Fastify** with `@fastify/static` and `@fastify/websocket`:

- Lightweight, fast, well-suited for proxying
- Native WebSocket support for message filtering
- Already in the Node.js ecosystem — no new runtime
- Ships as `npm run serve:prod`

Note: Using native WebSocket proxying (not `@fastify/http-proxy` for WS) to enable per-message filtering for guest role. HTTP proxy routes still use `@fastify/http-proxy`.

### Server Structure

```
server/
├── index.ts              # Entry point — start Fastify, startup validation
├── proxy.ts              # HTTP proxy routes (Moonraker, camera)
├── wsProxy.ts            # WebSocket proxy with message filtering
├── wsFilter.ts           # Guest-allowed method whitelist
├── auth.ts               # JWT validation, role extraction, auth middleware
├── roles.ts              # Role types + hierarchy (shared with client)
├── config.ts             # Server config (ports, upstream URLs)
└── config.json           # Runtime config (existing, extended)
```

### Server Config

```typescript
// server/config.ts

export interface ServerConfig {
  port: number              // Fluiddified public port (default: 4000)
  moonrakerPort: number     // Moonraker port (default: 7125)
  cameraPort: number        // Camera port (default: 8080)
  cameraEnabled: boolean    // Whether to proxy camera
  rateLimitPerMinute: number // API rate limit (default: 300)
}
```

Loaded from `server/config.json` (extended) or environment variables:

```json
{
  "port": 4000,
  "moonrakerPort": 7125,
  "cameraPort": 8080,
  "cameraEnabled": true,
  "rateLimitPerMinute": 300,
  "endpoints": [""],
  "themes": [...]
}
```

### Role Lookup

The server needs to know user roles. Two approaches:

**A. Read from Moonraker DB on startup + cache (initial):**
- On start, fetch `fluidd.auth.roles` from Moonraker DB via its API
- Cache in memory, refresh periodically or on WebSocket notification
- Same source of truth as IMP-02's client-side role store

**B. Encode role in JWT (long-term):**
- Fluiddified wraps Moonraker's JWT with additional role claim
- Server extracts role from token — no DB lookup per request
- Requires custom token issuance

Start with **A**, migrate to **B** later.

### Auth Middleware

```typescript
// server/auth.ts

import { jwtDecode } from 'jwt-decode'

const PUBLIC_PATHS = ['/access/login', '/access/refresh_jwt']

export function authMiddleware (config: ServerConfig) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (PUBLIC_PATHS.some(p => req.url.startsWith(p))) return
    if (isStaticAsset(req.url)) return

    const token = extractToken(req)
    if (!token) {
      if (req.headers.accept?.includes('text/html')) {
        return reply.redirect('/login')
      }
      return reply.status(401).send({ error: 'Authentication required' })
    }

    try {
      const decoded = jwtDecode(token)
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        return reply.status(401).send({ error: 'Token expired' })
      }
      req.user = decoded
      req.userRole = getRoleFromDb(decoded.username)
    } catch {
      return reply.status(401).send({ error: 'Invalid token' })
    }
  }
}

function extractToken (req: FastifyRequest): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  const url = new URL(req.url, 'http://localhost')
  return url.searchParams.get('token')
}

function isStaticAsset (url: string): boolean {
  return /\.(js|css|png|jpg|svg|ico|woff2?|ttf|map|webmanifest)(\?|$)/.test(url)
}
```

### Login Flow

The proxy exposes `/access/login` and `/access/refresh_jwt` as public paths (no JWT required), matching Moonraker's own API paths. This means **zero client-side login changes** — the existing Fluidd code already calls these paths.

---

## Client-Side Changes

### `config.json` for proxied mode

```json
{
  "endpoints": [""],
  "themes": [...]
}
```

Empty endpoint → same-origin → all API calls go through the proxy.

### `src/init.ts` changes

Prefer same-origin probe. When running behind the built-in proxy, the first probe succeeds immediately because the proxy forwards to Moonraker.

### Dev mode

`npm run dev` — Vite dev server, direct Moonraker connection (existing behavior unchanged). No proxy, no server-side auth. The dev server connects to Moonraker on its configured port as it does today.

---

## npm Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "serve:prod": "node server/index.js",
    "start": "npm run build && npm run serve:prod"
  }
}
```

---

## Request Flow Examples

### Unauthenticated user hits `/`

```
Browser → GET / → Fluiddified Server
  → authMiddleware: no JWT, requesting HTML
  → redirect to /login
  → serve login page (static asset, no auth needed)
```

### Unauthenticated user hits `/webcam/stream`

```
Browser → GET /webcam/stream → Fluiddified Server
  → authMiddleware: no JWT
  → 401 Authentication required
```

### Guest connects WebSocket

```
Browser → WS /websocket?token=<jwt>
  → authMiddleware: valid JWT, role=guest
  → roleGuard('guest'): guest >= guest ✓
  → wsProxy: open connection to Moonraker
  → downstream (Moonraker→Client): all messages pass through (temps, state, notifications)
  → upstream (Client→Moonraker): only whitelisted methods (query, subscribe, info, history)
  → guest sends printer.gcode.script → DROPPED silently
  → guest receives temperature updates → ✓ passed through
```

### Guest user hits `/api/printer/info`

```
Browser → GET /api/printer/info (Authorization: Bearer <jwt>)
  → authMiddleware: valid JWT, role=guest
  → roleGuard('user'): guest < user ✗
  → 403 Insufficient permissions
```

### User connects WebSocket

```
Browser → WS /websocket?token=<jwt>
  → authMiddleware: valid JWT, role=user
  → roleGuard('guest'): user >= guest ✓
  → wsProxy: open connection to Moonraker, NO filtering
  → full bidirectional WS established
```

---

## Deployment

### Prerequisites

1. Moonraker `moonraker.conf` `[authorization]` section:
   - `trusted_clients: 127.0.0.1` (only localhost)
   - `force_logins: True`
   - `cors_domains:` (can be empty — same-origin proxy eliminates CORS)

2. Camera service binds to `127.0.0.1` only

3. Cloudflare Tunnel (or similar) points to `http://localhost:4000`

### Startup

```bash
npm run build
npm run serve:prod
# Server starts on port 4000
# Validates Moonraker config on startup
# Warns if trusted_clients is too permissive
```

---

## Implementation Plan

### Phase 1: Basic Proxy (3-4 days)

- [ ] Add `fastify`, `@fastify/static`, `@fastify/http-proxy`, `@fastify/websocket`, `@fastify/rate-limit` dependencies
- [ ] Create `server/index.ts` — Fastify entry point
- [ ] Create `server/config.ts` — config loading (ports, upstreams, env vars)
- [ ] Create `server/proxy.ts` — HTTP proxy routes (Moonraker API, camera)
- [ ] Create `server/auth.ts` — JWT middleware + public login/refresh paths
- [ ] Make `/access/login` and `/access/refresh_jwt` public (no JWT)
- [ ] Make static assets public (JS, CSS, images, fonts)
- [ ] Redirect unauthenticated HTML requests to `/login`
- [ ] Return 401 for unauthenticated API/WS/camera requests
- [ ] Serve `dist/` with SPA fallback
- [ ] Basic WebSocket proxying (bidirectional, no filtering yet)
- [ ] Add `serve:prod` npm script
- [ ] Create `tsconfig.server.json` for server build

### Phase 2: Role Enforcement + WS Filtering (3-4 days)

- [ ] Create `server/roles.ts` — role types shared with client
- [ ] Implement role lookup from Moonraker DB (fetch + cache)
- [ ] Create `roleGuard` middleware
- [ ] Apply `roleGuard('user')` to Moonraker HTTP API routes
- [ ] Apply `roleGuard('guest')` to camera routes
- [ ] Apply `roleGuard('owner')` to user management routes
- [ ] Create `server/wsProxy.ts` — WebSocket proxy with role-aware routing
- [ ] Create `server/wsFilter.ts` — guest-allowed method whitelist
- [ ] Guest WS: filter outbound, pass through inbound
- [ ] User/Owner WS: full bidirectional, no filtering
- [ ] Rate limiting (per-IP)
- [ ] Moonraker config validation on startup (trusted_clients, force_logins)
- [ ] Test: unauthenticated → login redirect / 401 for everything
- [ ] Test: guest → camera + read-only WS (live temps/progress), API blocked, commands dropped
- [ ] Test: user → full Moonraker API + WS
- [ ] Test: owner → full access

### Phase 3: Production Hardening (2-3 days)

- [ ] Request logging (access log)
- [ ] Error handling (proxy failures, Moonraker down, camera down)
- [ ] Graceful shutdown
- [ ] Health check endpoint (`/health`)
- [ ] Security headers (X-Frame-Options, CSP, X-Content-Type-Options)
- [ ] Role cache invalidation on WebSocket notification from Moonraker
- [ ] Docker support (Dockerfile for Fluiddified + server)
- [ ] Environment variable overrides for all config
- [ ] Update `src/init.ts` — prefer same-origin probe

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `server/index.ts` | CREATE | Fastify server entry point + startup validation |
| `server/proxy.ts` | CREATE | HTTP proxy routes (Moonraker, camera) |
| `server/wsProxy.ts` | CREATE | WebSocket proxy with role-based message filtering |
| `server/wsFilter.ts` | CREATE | Guest-allowed Moonraker method whitelist |
| `server/auth.ts` | CREATE | JWT middleware + public path handling |
| `server/roles.ts` | CREATE | Role types (shared with client) |
| `server/config.ts` | CREATE | Server config loading |
| `server/config.json` | MODIFY | Add port, moonrakerPort, cameraPort fields |
| `package.json` | MODIFY | Add server dependencies + `serve:prod` script |
| `tsconfig.server.json` | CREATE | TypeScript config for server build |
| `src/init.ts` | MODIFY | Prefer same-origin probe |

## Dependencies (new packages)

| Package | Purpose |
|---------|---------|
| `fastify` | HTTP server |
| `@fastify/static` | Serve dist/ static files |
| `@fastify/http-proxy` | Proxy HTTP requests to Moonraker/camera |
| `@fastify/websocket` | WebSocket support for message filtering |
| `@fastify/rate-limit` | Per-IP rate limiting |
| `ws` | WebSocket client for upstream Moonraker connection |
| `jwt-decode` | JWT validation (already in client deps) |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| WS message filtering has gaps | High | Whitelist approach (default deny); only explicitly listed methods pass for guests |
| WebSocket upgrade fails through proxy | High | Native `@fastify/websocket` handles upgrade; tested |
| Camera CORS issues | None | Same-origin proxy eliminates CORS entirely |
| JWT validation latency | Low | jwt-decode is stateless and fast; no network call |
| Role cache stale | Medium | Periodic refresh + WS notification invalidation |
| Moonraker down → proxy errors | Medium | Graceful error responses; retry with backoff |
| Node.js memory under camera stream load | Medium | Proxy streams without buffering; set timeouts |
| Moonraker trusted_clients too permissive | High | Startup validation with clear error message |
| Guest discovers un-whitelisted read method | Low | Method whitelist is conservative; expand as needed |

## Estimated Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Basic proxy | 3-4 days | P0 |
| Phase 2: Role enforcement + WS filtering | 3-4 days | P0 |
| Phase 3: Production hardening | 2-3 days | P1 |

**Total: ~8-11 days**

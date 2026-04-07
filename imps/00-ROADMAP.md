# Fluiddified — Implementation Roadmap

## Overview

Fluiddified is a fork of Fluidd (full credit preserved) with five implementation tracks:

1. **IMP-01: Plugin Framework** — modular, drop-in dashboard widgets
2. **IMP-02: Auth/RBAC** — role-based access control (owner / user / guest)
3. **IMP-03: Achievements** — 73 achievements across 8 categories with progression, notifications, and dashboard widget
4. **IMP-04: Built-in Proxy & Security** — Node.js proxy server for safe internet exposure, server-side auth enforcement
5. **IMP-05: Rebrand** — Fluidd → Fluiddified with full attribution

None of these features exist in upstream Fluidd (confirmed by codebase audit 2026-04-06).

**Fork status (2026-04):** Sprints 0–4 implemented in this repo (`imps/` design
notes). Sprint 5 items delivered so far: external plugin index
(`public/fluidd-plugins.json` + bootstrap), PWA/favicon assets, achievement toast
UI, Playwright smoke E2E (`npm run test:e2e`), and a **Fluiddified** feature page
in `docs/docs/features/fluiddified.md` (linked from the docs Features index).

---

## Codebase Audit Findings

### What exists

| Area | Status | Details |
|------|--------|---------|
| Dashboard layout system | Good | Drag-and-drop, 4-column, per-user/breakpoint, Moonraker DB persistence |
| Widget shell (`CollapsableCard`) | Good | Collapse/enable/drag, layout-path binding |
| JWT authentication | Good | Login, token refresh, oneshot WS tokens, Moonraker integration |
| Vuex store (28 modules) | Good | Typed, namespaced, pattern-consistent |
| Route protection | Basic | Binary authenticated/not guard, no roles |
| Print history & totals | Good | Moonraker history API with job_totals — foundation for achievements |
| Flash messages | Good | `EventBus` + `FlashMessage` type with success/error/warning types |
| API URL discovery | Good | Dynamic probe of Moonraker endpoints; relative URL support already works |
| Camera URL resolution | Good | `buildAbsoluteUrl` resolves relative to page origin — proxy-ready |
| Service worker | Good | Already excludes `/websocket`, `/api/*`, `/webcam*` from SPA handling |

### What's missing

| Area | Gap | Impact |
|------|-----|--------|
| Widget registration | 100% static — touch 5+ files per widget | Blocks community plugins |
| Plugin discovery | None — no manifest, no glob, no registry | No extensibility |
| User roles | Not in schema — `AppUser` has no `role` field | No access control |
| Auth getters | Empty file — no permission helpers | No authorization infrastructure |
| Per-route authorization | Single binary guard for all routes | All-or-nothing access |
| UI element gating | No directives/mixins for permission checks | Everything visible to everyone |
| Guest/read-only mode | Doesn't exist | Can't safely expose online |
| Action-level protection | SocketActions has no permission checks | Any user can do anything |
| Gamification | Nothing | No engagement or milestone tracking |
| Server-side auth enforcement | None (client-only) | Can't secure Moonraker API for internet exposure |
| Branding | All "Fluidd" | Fork needs distinct identity |

---

## Role Model

```
owner  → Full control. Manage users, roles, all settings, config files, system.
user   → Print control. Start/stop/pause, run macros, modify temps, upload files.
guest  → Read-only monitoring. View dashboard, thermals, camera. No control actions.
```

---

## Implementation Order

### Sprint 0: Rebrand (Day 1)

```
IMP-05          │ Core branding: package.json, index.html, globals, footer, config.json
                │ Logo asset creation
                │ README rewrite with Fluidd attribution
```

**Goal:** Fork has its own identity from day one.

### Sprint 1: Foundation (Week 1-2)

```
IMP-01 Phase 1  │ Plugin manifest type + registry + auto-discover
IMP-01 Phase 2  │ Dashboard.vue uses registry, dynamic components
IMP-02 Phase 1  │ Role types (owner/user/guest), auth store extension, role persistence
IMP-02 Phase 2  │ Route-level authorization (meta.minRole)
IMP-04 Phase 1  │ Built-in Fastify proxy (Moonraker + camera + WS + auth)
```

**Goal:** Infrastructure works end-to-end. One widget migrated as proof. Routes gated by role. Proxy-ready config.

### Sprint 2: Migration & UI Gating (Week 2-3)

```
IMP-01 Phase 3  │ Migrate all 19 existing widgets to manifest pattern
IMP-02 Phase 3  │ v-can directive + AuthMixin + per-widget guest gating (27 files)
IMP-02 Phase 4  │ Guest mode (named guest account)
```

**Goal:** All widgets use manifests. Guest users see monitoring-only dashboard.

### Sprint 3: Management UIs + Achievements Core (Week 3-4)

```
IMP-01 Phase 4  │ Plugin Manager in settings
IMP-02 Phase 5  │ User/role management UI in settings
IMP-02 Phase 6  │ SocketActions permission gating
IMP-04 Phase 2  │ Role enforcement in proxy (guest→camera only, user→API)
IMP-03 Phase 1  │ Achievement types, store module, 73 definitions
IMP-03 Phase 2  │ Event hooks (history, console, printer, config, UI)
```

**Goal:** Owner can manage plugins and users. Proxy enforces roles server-side. Achievement engine tracking all events.

### Sprint 4: Achievement Widget & Hardening (Week 4-5)

```
IMP-03 Phase 3  │ Achievement dashboard widget (card, list, progress bars, rarity)
IMP-03 Phase 4  │ Achievement settings, retroactive unlocking, polish
IMP-04 Phase 3  │ Production hardening (logging, security headers, Docker)
```

**Goal:** Full achievement system live. Production-ready proxy with security headers.

### Sprint 5: Future (Week 5+)

```
IMP-01 Phase 5  │ Third-party plugin loading (index + runtime registration — done)
IMP-05 Phase 2  │ PWA icon set, custom favicon (done)
                │ Custom achievement notification component (toasts — done)
                │ E2E testing (Playwright smoke — done)
                │ Documentation site (Fluiddified feature page — done; expand as needed)
```

Optional next steps: richer plugin registry UX, CI job for `test:e2e`, more
fork-specific docs (proxy tuning, role matrix).

---

## TODO Checklist

### IMP-01: Plugin Framework

- [ ] Define `PluginManifest` type in `src/types/plugin.ts`
- [ ] Create `PluginRegistry` class in `src/plugins/pluginRegistry.ts`
- [ ] Create auto-discover via `import.meta.glob` in `src/plugins/pluginAutoDiscover.ts`
- [ ] Create `plugins` Vuex store module (6 files)
- [ ] Wire `plugins` module into `src/store/index.ts` and `types.ts`
- [ ] Add `plugins` DB root to `src/globals.ts`
- [ ] Modify `Dashboard.vue` — use registry instead of static imports
- [ ] Modify `Dashboard.vue` — replace `filtered()` with registry-based checks
- [ ] Modify `src/store/layout/state.ts` — defaults from registry
- [ ] Create `manifest.ts` for all 19 existing widget cards
- [ ] Create `PluginSettings.vue` in settings
- [ ] Add Plugin settings section to `Settings.vue`
- [ ] Test layout migration (existing user configs don't break)
- [ ] Test all 19 widgets render correctly via registry

### IMP-02: Auth/RBAC

- [ ] Create `src/types/auth.ts` (Role, Permission, Permissions — owner/user/guest)
- [ ] Extend `AppUser` with `role` field
- [ ] Add `roles: UserRoleMap` to `AuthState`
- [ ] Implement auth getters: `getCurrentRole`, `hasPermission`, `hasMinRole`, `isOwner`, `isGuest`
- [ ] Add `auth` root to `Globals.MOONRAKER_DB`
- [ ] Implement `initRoles`, `setUserRole`, first-user bootstrap (owner)
- [ ] Add `minRole` to `RouteMeta`, set on all routes
- [ ] Enhanced `beforeEnter` guard with role check
- [ ] Filter `AppNavDrawer` items by user role
- [ ] Create `v-can` directive + `AuthMixin`
- [ ] Gate all 27 widget component files for guest read-only
- [ ] Hide `ToolheadCard` + `MacrosCard` entirely for guests
- [ ] Implement guest login (named guest account with credentials)
- [ ] Build role management UI in AuthSettings
- [ ] Add permission checks to SocketActions
- [ ] Full role test matrix (guest/user/owner)

### IMP-03: Achievements

- [ ] Create `src/types/achievement.ts` with rarity + points
- [ ] Create `src/store/achievements/` Vuex module (6 files)
- [ ] Define all 73 achievements in `definitions.ts`
- [ ] Wire module into store + globals
- [ ] Hook into history, console, printer, config, webcams, layout, router stores
- [ ] Implement streak/consistency tracking
- [ ] Implement periodic timers (uptime, temp stability, easter eggs)
- [ ] Implement Konami code + patience watcher + page refresh counter
- [ ] Create `AchievementsCard.vue` with category tabs, sort, rarity badges
- [ ] Create detail dialog, progress bars, rarity badge components
- [ ] Create `AchievementSettings.vue`
- [ ] Implement retroactive unlocking from existing history
- [ ] Scroll-to-bottom hidden achievement trigger

### IMP-04: Built-in Proxy & Security (single-printer, TLS via Cloudflare)

- [ ] Add Fastify + proxy dependencies
- [ ] Create `server/index.ts` — entry point + Moonraker config validation on startup
- [ ] Create `server/config.ts` — config loading (ports, upstreams, env vars)
- [ ] Create `server/proxy.ts` — HTTP proxy routes (Moonraker API, camera)
- [ ] Create `server/auth.ts` — JWT middleware + public login/refresh paths
- [ ] Create `server/roles.ts` — role types shared with client
- [ ] Create `server/wsProxy.ts` — WebSocket proxy with role-based message filtering
- [ ] Create `server/wsFilter.ts` — guest-allowed Moonraker method whitelist
- [ ] Create `tsconfig.server.json`
- [ ] Serve `dist/` with SPA fallback, `serve:prod` npm script
- [ ] Implement role lookup from Moonraker DB (fetch + cache)
- [ ] Guest WS: downstream pass-through, upstream command filtering (whitelist)
- [ ] User/Owner WS: full bidirectional, no filtering
- [ ] HTTP role guards: user for API, guest for camera, owner for user mgmt
- [ ] Moonraker `trusted_clients` + `force_logins` validation on startup
- [ ] Rate limiting, security headers, request logging
- [ ] Graceful shutdown, health check, error handling
- [ ] Update `src/init.ts` — prefer same-origin probe
- [ ] Test: unauthenticated → login only, everything else 401
- [ ] Test: guest → camera + read-only WS (live temps), API blocked, commands dropped
- [ ] Test: user → full Moonraker API + WS
- [ ] Test: owner → full access

### IMP-05: Rebrand

- [ ] Update `package.json` — name, description
- [ ] Update `index.html` — title, meta, apple-mobile
- [ ] Update `vite.config.ts` — PWA manifest
- [ ] Update `src/globals.ts` — APP_NAME, GITHUB_REPO, DOCS
- [ ] Update `AppFooter.vue` — version line with attribution
- [ ] Update `server/config.json` + `public/config.json` — theme, logo, blacklist
- [ ] Update `src/store/socket/actions.ts` — client_name
- [ ] Design and create Fluiddified logo SVG
- [ ] Generate PWA icon set
- [ ] Rewrite `README.md` with attribution
- [ ] Update `en.yaml` locale strings

---

## Key Files Reference

| Purpose | Path |
|---------|------|
| Dashboard view | `src/views/Dashboard.vue` |
| Layout store | `src/store/layout/` |
| Auth store | `src/store/auth/` |
| Auth getters (empty) | `src/store/auth/getters.ts` |
| History store | `src/store/history/` |
| Router | `src/router/index.ts` |
| Store registration | `src/store/index.ts` |
| Store root types | `src/store/types.ts` |
| Globals | `src/globals.ts` |
| Widget card shell | `src/components/common/CollapsableCard.vue` |
| Nav drawer | `src/components/layout/AppNavDrawer.vue` |
| App bar | `src/components/layout/AppBar.vue` |
| App footer | `src/components/layout/AppFooter.vue` |
| Settings view | `src/views/Settings.vue` |
| Dynamic imports | `src/dynamicImports.ts` |
| Socket actions | `src/api/socketActions.ts` |
| Event bus | `src/eventBus.ts` |
| Flash message types | `src/types/flashmessage.ts` |
| HTTP client | `src/plugins/httpClient.ts` |
| Socket client | `src/plugins/socketClient.ts` |
| Init / API discovery | `src/init.ts` |
| Camera mixin | `src/mixins/camera.ts` |
| Host config | `server/config.json`, `public/config.json` |

---

## Design Decisions Log

| Decision | Rationale |
|----------|-----------|
| `import.meta.glob` for plugin discovery | Already used for cameras + locales; Vite-native |
| Roles in Fluidd DB namespace (not Moonraker auth) | Moonraker has no RBAC; can't modify its schema |
| 3-tier roles: guest/user/owner | Intuitive for personal printer; covers 95% of use cases |
| `v-can` directive for UI gating | Declarative, low boilerplate, Vue-idiomatic |
| 73 achievements across 8 categories | OctoPrint has 36 (mostly hidden); we differentiate with depth and Klipper-specificity |
| Rarity + points system for achievements | Adds engagement depth; total score gives long-term goal |
| Klipper-specific achievement category | Unique to Fluiddified; impossible in OctoPrint (no input shaper, bed mesh, PA, etc.) |
| Built-in Fastify proxy (no nginx/Caddy) | Single process, no external deps; stays inside Node.js ecosystem |
| Single-printer proxy only | Multi-printer routing adds complexity; each printer gets its own Fluiddified instance |
| Guest gets read-only WebSocket | Without WS, guest dashboards have no live data; proxy filters outbound commands |
| Unauthenticated gets nothing (not even camera) | Security-first; guests must log in to see anything |
| TLS via Cloudflare, not the proxy | No cert management; proxy runs HTTP behind tunnel |
| Dev mode has no proxy | `npm run dev` connects directly to Moonraker; proxy is production-only |
| Moonraker trusted_clients validated on startup | Proxy is meaningless if Moonraker accepts everything; warn loudly |
| Keep Moonraker DB namespace as `fluidd` | Avoids breaking existing printer configs; purely internal |
| Rebrand with attribution in footer | Ethical forking; clear credit to upstream |
| Retroactive achievement unlocking | Users shouldn't lose credit for past printing history |

---

## Upstream Considerations

### Files modified from upstream (conflict risk during rebase)

- `src/views/Dashboard.vue` (IMP-01)
- `src/store/layout/state.ts` (IMP-01)
- `src/store/index.ts` (IMP-01 + 02 + 03)
- `src/store/types.ts` (IMP-01 + 02 + 03)
- `src/store/auth/*` (IMP-02)
- `src/router/index.ts` (IMP-02)
- `src/globals.ts` (IMP-01 + 02 + 03 + 05)
- `src/components/layout/AppNavDrawer.vue` (IMP-02)
- `src/components/layout/AppBar.vue` (IMP-02)
- `src/components/layout/AppFooter.vue` (IMP-05)
- `src/api/socketActions.ts` (IMP-02)
- `src/views/Settings.vue` (IMP-01 + 02 + 03)
- `src/store/history/actions.ts` (IMP-03)
- `src/store/console/actions.ts` (IMP-03)
- `src/init.ts` (IMP-04)
- `server/config.json`, `public/config.json` (IMP-04 + 05)
- `package.json` (IMP-04 + 05)
- ~27 widget component files (IMP-02)
- `package.json`, `index.html`, `vite.config.ts` (IMP-05)

### Entirely new files (no conflict risk)

- `src/types/plugin.ts`, `src/types/auth.ts`, `src/types/achievement.ts`
- `src/plugins/pluginRegistry.ts`, `src/plugins/pluginAutoDiscover.ts`
- `src/store/plugins/`, `src/store/achievements/`
- `src/directives/permission.ts`, `src/mixins/auth.ts`
- `src/components/widgets/*/manifest.ts` (19+ files)
- `src/components/widgets/achievements/` (8 files)
- `src/components/settings/PluginSettings.vue`, `AchievementSettings.vue`
- `server/index.ts`, `server/proxy.ts`, `server/auth.ts`, `server/roles.ts`, `server/config.ts`
- `tsconfig.server.json`
- `public/logo_fluiddified.svg`
- `imps/` (this documentation)

## Estimated Total Effort

| IMP | MVP | Full | Priority |
|-----|-----|------|----------|
| IMP-01: Plugin Framework | 6-8 days | 11-16 days | P0 |
| IMP-02: Auth/RBAC | 8-9 days | 14-17 days | P0 |
| IMP-03: Achievements | 9-11 days | 10-13 days | P1 |
| IMP-04: Built-in Proxy | 5-7 days | 7-10 days | P0 |
| IMP-05: Rebrand | 3-4 days | 3-4 days | P0 |
| **Total** | **~31-39 days** | **~48-63 days** | |

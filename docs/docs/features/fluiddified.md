---
title: Fluiddified
---

# Fluiddified

Fluiddified is a fork of Fluidd with
extra features for plugin extensibility, role-based access control (RBAC),
gamification, and an optional built-in reverse proxy. Everything in the rest of
this documentation that describes Fluidd applies to Fluiddified unless this page
says otherwise.

## Plugin framework

Widgets are registered through a **plugin manifest** instead of static imports.
Built-in dashboard cards ship as manifests; the layout store and dashboard load
components from a central registry. Owners manage visibility from **Settings →
Plugin manager**: optional built-ins can be disabled; core built-ins always stay
on; user ZIP and catalog widgets can be installed or removed (see
[Plugin development](plugin-development.md)).

### External plugins

Optional third-party widgets can be listed in `fluidd-plugins.json` at the web
root. Each entry points at a JSON manifest that describes the widget and a URL
for its Vue component bundle. The app fetches manifests at startup and
registers them with the same registry as built-in plugins.

### User ZIP packs

Owners can install pre-built packs (manifest + JavaScript module) from the
Plugin manager. Packs are stored in the browser only. Layout entries are updated
automatically.

## Roles and permissions

Fluiddified extends Moonraker’s [authorization](./authorization.md) model with
three **roles** stored in Fluidd’s browser database namespace:

| Role   | Typical use                                      |
|--------|--------------------------------------------------|
| Owner  | Full access, user management, all settings       |
| User   | Normal printing and control                      |
| Guest  | Read-only monitoring; control actions suppressed |

Routes, navigation, UI controls, and WebSocket commands respect `minRole` on
plugins and routes. **Guests** must sign in with a named guest account (not
anonymous browsing).

**Login:** The dashboard and settings always require a **Moonraker JWT** (sign-in
or first-account registration). A **trusted** client (per Moonraker’s
`/access/info` flag) is the only one that can run **first-user registration**
when no accounts exist yet; other clients see a “not set up / cannot sign in from
here” message instead of the login form.

## Achievements

An achievement system tracks milestones (printing, configuration, console use,
streaks, and more). Progress appears on the dashboard and in **Settings**;
unlocking can be evaluated retroactively from existing history where applicable.

## Built-in proxy

For single-printer deployments exposed to the internet, Fluiddified can run a
small **Node.js** proxy (Fastify) in front of Moonraker. It terminates HTTP and
WebSocket traffic, enforces JWT authentication, and applies **role-based**
rules (for example, guests get camera and read-only streams without full API
access). TLS is expected to be handled by a reverse proxy or tunnel (for
example Cloudflare), not necessarily by this service.

Production-style startup is described in the project `README` (`serve:prod` and
related scripts).

## Branding and PWA

The fork uses Fluiddified naming, logos, and PWA icons while **retaining
attribution** to upstream Fluidd in the UI. Favicon and install icons are
custom assets for this project.

## See also

- [Authorization](./authorization.md) — Moonraker users, API keys, and JWT
- [Configuration](../configuration.md) — Moonraker and Fluidd/Fluiddified settings
- [Multiple printers](./multiple-printers.md) — Fluidd’s multi-printer UI (unchanged in the fork)

---
title: Plugin development
icon: lucide/puzzle
---

# Dashboard widget plugins (Fluiddified)

Fluiddified registers **dashboard cards** from **plugin manifests**. Built-in
cards live under `src/components/widgets/` with a `manifest.ts` file. Two ways
to add widgets **without** rebuilding the main app are supported:

1. **Catalog** — list manifests in `fluidd-plugins.json` at the web root (see
   [Fluiddified](fluiddified.md)).
2. **User ZIP** — install a pack from **Settings → Plugin manager** (owner
   only). The pack is stored in the browser and reapplied on load.

Only the **owner** role may install ZIP packs or remove non-built-in widgets.

## Security

Remote scripts and ZIP bundles run in your browser with full access to the page
(same as the Fluiddified UI). Install packs only from sources you trust.

## Manifest (`manifest.json`)

The JSON schema matches the catalog manifest (same fields as
`ExternalPluginManifestJson` in the repo). Required fields:

| Field           | Description |
|-----------------|-------------|
| `id`            | Unique id, kebab-case, must end with `-card`. Cannot match a built-in id. |
| `name`          | Title in the Plugin manager. |
| `version`       | Semantic version string. |
| `componentUrl`  | Path **relative to the manifest file** inside the ZIP to the built JS module. |

Optional: `description`, `icon` (MDI path), `defaultEnabled`, `defaultCollapsed`,
`defaultContainer` (1–4), `defaultPosition`, `minRole` (`guest` | `user` | `owner`), `tags`.

## ZIP layout

```text
my-widget.zip
├── manifest.json
└── dist
    └── widget.js
```

Example `manifest.json`:

```json
{
  "id": "my-demo-card",
  "name": "My demo",
  "version": "1.0.0",
  "description": "Example widget",
  "componentUrl": "dist/widget.js",
  "defaultContainer": 2,
  "defaultPosition": 99
}
```

You may also place both files in a **single root folder** inside the archive;
the installer finds the only `manifest.json` and resolves `componentUrl`
relative to that folder.

Maximum bundle size is **4 MiB**.

## Component bundle

The file at `componentUrl` must be an **ES module** whose **default export** is
a Vue component (for example a single-file component compiled to ES module, or a
`.vue` build target your toolchain emits).

The host loads it via dynamic `import()` against a blob URL. Your build should:

- Target **Vue 2.7**-compatible runtime and **no dependency on Vite `import.meta.glob`**
  inside the plugin (ship dependencies in the bundle or use external URLs you
  control).
- Export `default` as the component.

If you develop inside the Fluiddified repo, copying the patterns used by
built-in manifests (for example `component: () => import('./MyCard.vue')`) is
the reference; published packs use a **pre-built** file instead.

## Built-in policy (plugin manager)

Built-in widgets **cannot be removed**. **Core** dashboard cards (printer status,
temperatures, toolhead, console, jobs, and similar essentials) stay enabled and
are **not listed** in the plugin manager so the panel stays focused.

Only **optional** built-ins appear there so you can turn them off when you do
not use that hardware or feature—examples include Spoolman, runout sensors,
extra sensors, MMU, AFC, Beacon, job queue, outputs, and achievements. Everything
shipped in `src/components/widgets/` remains installed; hiding a card only
toggles visibility for that optional subset (and for user or catalog widgets).

User ZIP and catalog widgets **can be removed** (except built-ins). Removing a
catalog entry hides it for this browser until stored site data is cleared.

## `fluidd-plugins.json`

At the web root, optional index:

```json
{
  "plugins": [
    { "manifestUrl": "https://example.com/plugins/demo/manifest.json" }
  ]
}
```

Each manifest uses the same JSON shape; `componentUrl` may be absolute or
relative to the manifest URL. Entries removed via the Plugin manager are skipped
on the next load (stored locally).

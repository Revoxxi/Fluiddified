# IMP-05: Rebrand to Fluiddified

## Status: PLANNED

## Principle

Rebrand the fork as **Fluiddified** while preserving full credit to the original Fluidd project. Every user-facing mention of "Fluidd" becomes "Fluiddified", but:

- **Moonraker DB namespace stays `fluidd`** — avoids breaking existing printer configs
- **Moonraker client identification stays compatible** — no breaking changes to Moonraker integration
- **Attribution** — "Fluiddified — a fork of Fluidd" in footer, about, docs
- **Original logos preserved** — ship both Fluidd's logo (for attribution) and new Fluiddified logo

---

## Changes by Category

### A. Safe Display String Changes (no compatibility risk)

| File | What | From | To |
|------|------|------|----|
| `package.json` | `name` | `fluidd` | `fluiddified` |
| `package.json` | `description` | `fluidd, a klipper web client.` | `Fluiddified — a Klipper web interface, forked from Fluidd` |
| `index.html` | `<title>` | `fluidd` | `Fluiddified` |
| `index.html` | `meta description` | `The Klipper web interface` | `Fluiddified — enhanced Klipper web interface` |
| `index.html` | `apple-mobile-web-app-title` | `fluidd` | `Fluiddified` |
| `index.html` | noscript text | mentions `fluidd` | mentions `Fluiddified` |
| `vite.config.ts` | PWA `manifest.name` | `fluidd` | `Fluiddified` |
| `vite.config.ts` | PWA `manifest.short_name` | `fluidd` | `Fluiddified` |
| `vite.config.ts` | PWA `manifest.description` | Klipper wording | Updated description |
| `src/globals.ts` | `APP_NAME` | `'fluidd'` | `'fluiddified'` |
| `src/globals.ts` | `DOCS_*` URLs | `docs.fluidd.xyz` | TBD (own docs site or keep linking upstream + fork-specific docs) |
| `src/globals.ts` | `GITHUB_REPO` | `https://github.com/fluidd-core/fluidd` | Your fork URL |
| `src/components/layout/AppFooter.vue` | Version line | `fluidd: v...` | `fluiddified: v... (based on fluidd)` |
| `server/config.json` | Theme preset name | `"Fluidd"` | `"Fluiddified"` |
| `server/config.json` | Theme logo | `logo_fluidd.svg` | `logo_fluiddified.svg` |
| `server/config.json` | Blacklist | `fluidd.xyz, fluidd.net` | Remove or update |
| `public/config.json` | Same as server/config.json | Same | Same |
| `README.md` | Full rewrite | Fluidd readme | Fluiddified readme with attribution |
| `.devcontainer/devcontainer.json` | `name` | `Fluidd Dev` | `Fluiddified Dev` |
| `src/locales/en.yaml` | User-facing "Fluidd" strings | `Fluidd` | `Fluiddified` |
| `src/App.vue` | Embedded favicon SVG | Fluidd mark | Fluiddified mark |

### B. Internal Identifiers (keep for compatibility)

| Item | Value | Why keep |
|------|-------|----------|
| `MOONRAKER_DB.fluidd.NAMESPACE` | `'fluidd'` | Existing printers have settings under this namespace. Changing breaks all user configs. |
| `FILE_DATA_TRANSFER_TYPES` | `x-fluidd-files`, `x-fluidd-jobs` | Internal MIME types for drag-and-drop. Harmless to keep, breaking to change. |
| `version/onUpdatedFluidd` | RPC method name | Moonraker may reference this internally. Keep for compatibility. |
| Moonraker `client_name` in `server.connection.identify` | Change to `fluiddified` | This is safe to change — it's just identification metadata. Moonraker uses it for logging, not routing. |

### C. Assets to Create

| Asset | Description |
|-------|-------------|
| `public/logo_fluiddified.svg` | New Fluiddified logo (can be Fluidd logo with subtle modification or entirely new) |
| `public/img/icons/` | Full PWA icon set in Fluiddified branding (favicon, android-chrome, apple-touch, safari-pinned) |
| `src/App.vue` favicon SVG | Inline SVG data URL for dynamic favicon |

### D. Attribution

Add to footer component (`AppFooter.vue`):

```
Fluiddified v1.0.0 — a fork of Fluidd by fluidd-core
```

Add to Settings → About section (or General settings):

```
Fluiddified is an enhanced fork of Fluidd (https://github.com/fluidd-core/fluidd).
Original work by the Fluidd team. Licensed under GPL-3.0.
```

### E. Non-English Locales

Per CLAUDE.md, non-English locales are managed via Weblate upstream. For the fork:

- Update `en.yaml` with all "Fluidd" → "Fluiddified" changes
- Other locales: leave as-is initially, or do a bulk find-replace for the product name only
- Long term: set up own Weblate instance or accept locale divergence

---

## Implementation Plan

### Phase 1: Core Branding (1 day)

- [ ] Update `package.json` — name, description
- [ ] Update `index.html` — title, meta, apple-mobile, noscript
- [ ] Update `vite.config.ts` — PWA manifest fields
- [ ] Update `src/globals.ts` — `APP_NAME`, `GITHUB_REPO`, `DOCS_*`
- [ ] Update `src/components/layout/AppFooter.vue` — version line with attribution
- [ ] Update `server/config.json` and `public/config.json` — theme name, logo, blacklist
- [ ] Update `.devcontainer/devcontainer.json` — name
- [ ] Update `src/store/socket/actions.ts` — `client_name` to `fluiddified`

### Phase 2: Assets (1-2 days)

- [ ] Design Fluiddified logo SVG
- [ ] Generate PWA icon set from logo (favicon-16, 32, android-chrome-192, 512, apple-touch-180, safari-pinned-tab)
- [ ] Replace `src/App.vue` inline SVG favicon
- [ ] Place `logo_fluiddified.svg` in `public/`

### Phase 3: Documentation (1 day)

- [ ] Rewrite `README.md` — Fluiddified branding with clear Fluidd attribution section
- [ ] Update `CONTRIBUTING.md` if forking contribution guidelines
- [ ] Update or remove `.github/ISSUE_TEMPLATE/` and `pull_request_template.md`
- [ ] Update `en.yaml` locale strings

### Phase 4: Repository Setup (0.5 day)

- [ ] Set up git remote pointing to your fork
- [ ] Update CI/CD references if any (GitHub Actions workflows reference `fluidd-core`)
- [ ] Create `FORKED_FROM.md` or attribution section in README
- [ ] License file: keep GPL-3.0, add fork notice

---

## File Changes Summary

| File | Action | Risk |
|------|--------|------|
| `package.json` | MODIFY | None |
| `index.html` | MODIFY | None |
| `vite.config.ts` | MODIFY | None (PWA fields only) |
| `src/globals.ts` | MODIFY | Low (keep DB namespace) |
| `src/components/layout/AppFooter.vue` | MODIFY | None |
| `server/config.json` | MODIFY | None |
| `public/config.json` | MODIFY | None |
| `.devcontainer/devcontainer.json` | MODIFY | None |
| `src/store/socket/actions.ts` | MODIFY | None |
| `src/App.vue` | MODIFY | Low (favicon SVG) |
| `src/locales/en.yaml` | MODIFY | Low |
| `public/logo_fluiddified.svg` | CREATE | None |
| `public/img/icons/*` | REPLACE | None |
| `README.md` | REWRITE | None |

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Core branding | 1 day |
| Phase 2: Assets | 1-2 days |
| Phase 3: Documentation | 1 day |
| Phase 4: Repository | 0.5 day |

**Total: ~3-4 days**

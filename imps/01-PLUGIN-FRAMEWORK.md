# IMP-01: Modular Plugin Framework for Dashboard Widgets

## Status: PLANNED

## Problem Statement

Fluidd's dashboard is hardcoded. Adding a new widget requires touching **5+ files**:

1. Create the widget component (`src/components/widgets/<name>/`)
2. Import it in `Dashboard.vue` (static import, ~20 lines of imports)
3. Register it in `@Component({ components: { ... } })` in `Dashboard.vue`
4. Add default layout entry in `src/store/layout/state.ts`
5. Add filter logic in `Dashboard.vue`'s `filtered()` method
6. Optionally add a new Vuex store module in `src/store/` + wire in `index.ts` + `types.ts`
7. Optionally add entries to `globals.ts` (`Waits`, `Icons`, `MOONRAKER_COMPONENTS`)

This makes it impractical for community contributions, forks, or drop-in features.

## Current Architecture (Audit Summary)

### Dashboard rendering pipeline

```
layout store → getSpecificLayoutName (per-user, per-breakpoint)
  → getLayout(name) → LayoutContainer { container1..4: LayoutConfig[] }
    → v-for container → v-for LayoutConfig
      → <component :is="c.id" /> (kebab-case must match registered name)
```

### Widget registration: STATIC ONLY

- `Dashboard.vue` imports 19 card components and registers them in `@Component`
- `c.id` (e.g., `printer-status-card`) is resolved by Vue to the registered `PrinterStatusCard`
- No dynamic registration, no `import.meta.glob` for widgets, no registry

### Layout persistence

- Stored in Moonraker DB under `fluidd.layout.layouts`
- Per-user, per-breakpoint keys: `dashboard-{breakpoint}-{username}`
- Migration merges new default cards into existing user layouts

### Widget shell

- All dashboard cards wrap content in `CollapsableCard` with `layout-path="dashboard.<id>"`
- `CollapsableCard` handles enable/disable, collapse, drag handle, menu

## Proposed Solution

### Design Principles

1. **Zero-config for simple widgets** — drop a folder, it appears
2. **Backward compatible** — existing widgets keep working unchanged
3. **Typed** — full TypeScript support, no `any` escapes
4. **Lazy** — plugins load on demand, not at startup
5. **Scoped** — plugins get a controlled API surface, not raw store access

### Architecture Overview

```
src/
├── plugins/
│   └── pluginRegistry.ts          # NEW — central plugin system
├── types/
│   └── plugin.ts                  # NEW — plugin manifest type
├── components/
│   └── widgets/
│       └── <widget>/
│           ├── <Widget>Card.vue   # existing pattern
│           └── manifest.ts        # NEW — plugin manifest (optional for existing)
├── store/
│   └── plugins/                   # NEW — plugin state module
│       ├── index.ts
│       ├── state.ts
│       ├── getters.ts
│       ├── mutations.ts
│       ├── actions.ts
│       └── types.ts
└── views/
    └── Dashboard.vue              # MODIFIED — uses registry instead of static imports
```

---

## Implementation Plan

### Phase 1: Plugin Manifest & Registry (Core Infrastructure)

#### 1.1 Define the plugin manifest type

```typescript
// src/types/plugin.ts

export interface PluginManifest {
  /** Unique kebab-case id, matches the <component :is=""> tag */
  id: string

  /** Human-readable name for settings UI */
  name: string

  /** Brief description */
  description?: string

  /** Semantic version */
  version: string

  /** Icon key from globals.Icons or raw MDI path */
  icon?: string

  /**
   * Dynamic component loader.
   * Must return a Vue component (default export of a .vue file).
   */
  component: () => Promise<{ default: any }>

  /** Default enabled state */
  defaultEnabled?: boolean

  /** Default collapsed state */
  defaultCollapsed?: boolean

  /** Default container placement (1-4) */
  defaultContainer?: 1 | 2 | 3 | 4

  /** Default position in the container (0-based) */
  defaultPosition?: number

  /**
   * Visibility check — called reactively.
   * Return `true` to show, `false` to hide (when hardware/feature not present).
   * Receives the Vuex store for state checks.
   */
  isAvailable?: (store: any) => boolean

  /**
   * Optional Vuex store module to register dynamically.
   * Registered as `store.registerModule(storeModule.name, storeModule.module)`
   */
  storeModule?: {
    name: string
    module: any
  }

  /**
   * Minimum required auth role to see this widget.
   * Ties into IMP-02 (auth/RBAC).
   */
  minRole?: 'guest' | 'user' | 'owner'

  /** Optional settings component for the Settings page */
  settingsComponent?: () => Promise<{ default: any }>

  /** Tags for categorization in plugin manager UI */
  tags?: string[]
}
```

#### 1.2 Create the plugin registry

```typescript
// src/plugins/pluginRegistry.ts

class PluginRegistry {
  private plugins: Map<string, PluginManifest> = new Map()
  private loadedComponents: Map<string, any> = new Map()

  register(manifest: PluginManifest): void
  unregister(id: string): void
  getAll(): PluginManifest[]
  getById(id: string): PluginManifest | undefined
  async loadComponent(id: string): Promise<any>
  getDefaultLayout(): LayoutConfig[]
  isAvailable(id: string, store: any): boolean
}

export const pluginRegistry = new PluginRegistry()
```

#### 1.3 Auto-discovery via `import.meta.glob`

```typescript
// src/plugins/pluginAutoDiscover.ts

// Glob all manifest files from widget dirs
const manifests = import.meta.glob<{ default: PluginManifest }>(
  '@/components/widgets/*/manifest.ts',
  { eager: true }
)

export function autoDiscoverPlugins(): PluginManifest[] {
  return Object.values(manifests).map(m => m.default)
}
```

This mirrors the existing `dynamicImports.ts` pattern used for camera components and locales.

#### 1.4 Create the `plugins` Vuex store module

```typescript
// src/store/plugins/types.ts
export interface PluginsState {
  registered: string[]        // ids of registered plugins
  disabled: string[]          // user-disabled plugin ids (persisted)
  loadErrors: Record<string, string>
}
```

- Persisted to Moonraker DB under `fluidd.plugins`
- Actions: `initPlugins`, `enablePlugin`, `disablePlugin`
- Wired into `src/store/index.ts` and `src/store/types.ts`

### Phase 2: Dashboard Integration

#### 2.1 Modify `Dashboard.vue` to use registry

**Before** (current):
```typescript
import PrinterStatusCard from '@/components/widgets/status/PrinterStatusCard.vue'
// ... 18 more static imports ...

@Component({
  components: { PrinterStatusCard, /* ... 18 more ... */ }
})
```

**After** (proposed):
```typescript
import { pluginRegistry } from '@/plugins/pluginRegistry'

@Component({
  components: pluginRegistry.getLoadedComponents() // dynamic
})
```

The `<component :is="c.id" />` pattern stays unchanged — it already supports dynamic component names.

#### 2.2 Replace the hardcoded `filtered()` method

**Before:**
```typescript
filtered (item: LayoutConfig) {
  if (item.id === 'camera-card' && !this.hasCameras) return true
  if (item.id === 'macros-card' && !this.hasMacros) return true
  // ... 12 more hardcoded checks ...
}
```

**After:**
```typescript
filtered (item: LayoutConfig) {
  if (this.inLayout) return false
  return !pluginRegistry.isAvailable(item.id, this.$store)
}
```

Each plugin's `isAvailable()` callback handles its own visibility logic.

#### 2.3 Layout defaults from manifests

`src/store/layout/state.ts` will pull defaults from the registry instead of a hardcoded array:

```typescript
import { pluginRegistry } from '@/plugins/pluginRegistry'

export const defaultState = (): LayoutState => ({
  layouts: {
    dashboard: pluginRegistry.getDefaultLayout(),
    diagnostics: { /* ... unchanged ... */ }
  }
})
```

### Phase 3: Migrate Existing Widgets

Each existing widget gets a `manifest.ts` in its directory. Example:

```typescript
// src/components/widgets/thermals/manifest.ts
import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'temperature-card',
  name: 'Thermals',
  version: '1.0.0',
  icon: 'fire',
  component: () => import('./TemperatureCard.vue'),
  defaultEnabled: true,
  defaultContainer: 2,
  defaultPosition: 0,
  isAvailable: (store) => {
    const heaters = store.getters['printer/getHeaters']
    const fans = store.getters['printer/getOutputs'](['temperature_fan'])
    const sensors = store.getters['printer/getSensors']
    return heaters.length > 0 || fans.length > 0 || sensors.length > 0
  },
  minRole: 'guest',  // monitoring visible to all; controls gated by IMP-02
  tags: ['thermal', 'monitoring']
}

export default manifest
```

Migration order (by risk, simplest first):
1. `console-card` (no availability check)
2. `jobs-card` (no check)
3. `toolhead-card` (no check)
4. `macros-card` (simple check)
5. `temperature-card` (simple check)
6. `camera-card` (simple check)
7. ... remaining 13 cards

### Phase 4: Plugin Manager UI

#### Settings section: "Plugins"

New `PluginSettings.vue` in `src/components/settings/`:

- List all registered plugins with name, description, version, tags
- Toggle enable/disable (persisted to Moonraker DB)
- Show availability status (hardware present or not)
- Reset to defaults button
- Future: upload/install third-party plugins

#### Dashboard layout mode enhancement

- When in layout mode, show "Add Widget" button that lists all registered (but not placed) plugins
- Plugin availability shown with hardware-detection badges

### Phase 5: Third-Party Plugin Support (Future)

- Plugin packages as npm packages or git repos
- `fluidd-plugins.json` manifest file listing external plugin URLs
- Plugin sandboxing (limited store API surface)
- Plugin settings persistence in Moonraker DB under `fluidd.plugins.<id>`
- Hot-reload support in dev mode

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/types/plugin.ts` | CREATE | Plugin manifest type definition |
| `src/plugins/pluginRegistry.ts` | CREATE | Central registry singleton |
| `src/plugins/pluginAutoDiscover.ts` | CREATE | Auto-discover via import.meta.glob |
| `src/store/plugins/` | CREATE | Plugin state module (6 files) |
| `src/store/index.ts` | MODIFY | Register `plugins` module |
| `src/store/types.ts` | MODIFY | Add `PluginsState` to root types |
| `src/views/Dashboard.vue` | MODIFY | Use registry instead of static imports |
| `src/store/layout/state.ts` | MODIFY | Pull defaults from registry |
| `src/components/widgets/*/manifest.ts` | CREATE (x19) | Manifest for each existing widget |
| `src/components/settings/PluginSettings.vue` | CREATE | Plugin manager settings UI |
| `src/views/Settings.vue` | MODIFY | Add PluginSettings section |
| `src/globals.ts` | MODIFY | Add plugin-related constants |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dynamic components break TypeScript checking | Medium | Use `defineAsyncComponent` wrapper with typed props |
| Layout migration breaks existing user configs | High | Keep backward compat in `setInitLayout` migration |
| `import.meta.glob` bundle size | Low | Already used for cameras/locales; lazy loading keeps chunks small |
| Plugin store modules conflict | Medium | Namespace validation in registry; prefix plugin stores |
| Vue 2.7 async component limitations | Medium | Use `() => import()` which Vue 2.7 supports natively |

## Dependencies

- None external — uses existing Vite/Vue capabilities
- Pairs with IMP-02 (Auth/RBAC) via `minRole` field in manifests

## Estimated Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Core infrastructure | 2-3 days | P0 |
| Phase 2: Dashboard integration | 1-2 days | P0 |
| Phase 3: Migrate existing widgets | 2-3 days | P1 |
| Phase 4: Plugin Manager UI | 2-3 days | P1 |
| Phase 5: Third-party support | 5+ days | P2 |

**Total Phase 1-3 (MVP): ~6-8 days**

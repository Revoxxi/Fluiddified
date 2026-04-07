# IMP-02: Full Authentication & Role-Based Access Control (RBAC)

## Status: PLANNED

## Problem Statement

Fluidd's authentication is **binary** — you're either authenticated or not. There are:

- **No roles** (owner, user, guest)
- **No permission scoping** (UI elements aren't gated by capability)
- **No guest/read-only mode** (can't expose online for monitoring without full control)
- **No per-route authorization** (all routes use the same `isAuthenticated()` guard)
- **No per-action authorization** (any authenticated user can run any gcode, modify configs, etc.)

This makes it impossible to safely expose Fluidd over the internet — anyone with login gets full printer control.

## Current Architecture (Audit Summary)

### Auth state (`src/store/auth/types.ts`)

```typescript
interface AuthState {
  authenticated: boolean        // binary flag
  token: JwtPayload | null
  refresh_token: JwtPayload | null
  currentUser: AppUser | null
  users: AppUser[]
  apiKey: string
}

interface AppUser {
  username: string
  password?: string
  source: string
  created_on?: number
  // NO role, NO permissions
}
```

### Auth flow

1. App init → check localStorage for JWT → set `authenticated: true`
2. If no token → redirect to `/login`
3. Login → `POST /access/login` → store JWT → connect WebSocket with oneshot token
4. All routes share `defaultRouteConfig.beforeEnter` → `isAuthenticated()` (boolean)
5. `isAuthenticated()` = `auth.authenticated || !socket.apiConnected` (disconnected = OK)

### What Moonraker provides

Moonraker's `[authorization]` config supports:

- `trusted_clients` — IP ranges that bypass auth
- `force_logins` — require login even from trusted networks
- JWT-based auth with access/refresh tokens
- API key auth
- Oneshot tokens for WebSocket
- **No built-in roles** — Moonraker treats all authenticated users equally

### Auth getters

`src/store/auth/getters.ts` is **empty** — literally no helper functions.

### Route protection

Single binary guard on all app routes:

```typescript
const isAuthenticated = (): boolean => (
  store.state.auth.authenticated ||
  !store.state.socket.apiConnected
)
```

No `meta.roles`, no `meta.permissions`, no per-route checks.

### UI element protection

None. All buttons, inputs, actions are visible to all authenticated users.

---

## Proposed Solution

### Design Principles

1. **Moonraker-compatible** — roles stored in Fluidd's Moonraker DB namespace, not Moonraker's auth
2. **Client + server enforcement** — UI hides elements AND actions are validated
3. **Default-secure** — new installations require owner setup; first user is owner
4. **Granular** — permissions are per-capability, not just per-page
5. **Live monitoring** — guests get read-only WebSocket access (live temps, progress) via IMP-04's filtered proxy; outbound commands are blocked server-side

### Role Hierarchy

```
owner  → Full control. Manage users, roles, all settings, config files, system.
user   → Print control. Start/stop/pause, run macros, modify temps, upload files.
guest  → Read-only monitoring. View dashboard, thermals, camera. No control actions.
```

### Permission Model

```typescript
// src/types/auth.ts

export type Role = 'owner' | 'user' | 'guest'

export const RoleHierarchy: Record<Role, number> = {
  guest: 0,
  user: 1,
  owner: 2
}

export interface Permission {
  id: string
  name: string
  description: string
  minRole: Role
}

// Predefined permissions
export const Permissions = {
  // Printer control
  PRINTER_CONTROL:      { id: 'printer.control',      name: 'Printer Control',      minRole: 'user' },
  PRINTER_EMERGENCY:    { id: 'printer.emergency',     name: 'Emergency Stop',       minRole: 'user' },
  PRINTER_HOME:         { id: 'printer.home',          name: 'Home Axes',            minRole: 'user' },
  PRINTER_MOVE:         { id: 'printer.move',          name: 'Move Toolhead',        minRole: 'user' },

  // Temperature
  TEMP_SET:             { id: 'temp.set',              name: 'Set Temperatures',     minRole: 'user' },
  TEMP_VIEW:            { id: 'temp.view',             name: 'View Temperatures',    minRole: 'guest' },

  // Macros
  MACRO_RUN:            { id: 'macro.run',             name: 'Run Macros',           minRole: 'user' },
  MACRO_EDIT:           { id: 'macro.edit',            name: 'Edit Macros',          minRole: 'owner' },

  // Files
  FILE_UPLOAD:          { id: 'file.upload',           name: 'Upload Files',         minRole: 'user' },
  FILE_DELETE:          { id: 'file.delete',           name: 'Delete Files',         minRole: 'user' },
  FILE_EDIT:            { id: 'file.edit',             name: 'Edit Config Files',    minRole: 'owner' },
  FILE_VIEW:            { id: 'file.view',             name: 'View Files',           minRole: 'guest' },

  // Print
  PRINT_START:          { id: 'print.start',           name: 'Start Print',          minRole: 'user' },
  PRINT_PAUSE:          { id: 'print.pause',           name: 'Pause/Resume Print',   minRole: 'user' },
  PRINT_CANCEL:         { id: 'print.cancel',          name: 'Cancel Print',         minRole: 'user' },

  // Camera
  CAMERA_VIEW:          { id: 'camera.view',           name: 'View Camera',          minRole: 'guest' },

  // Console
  CONSOLE_SEND:         { id: 'console.send',          name: 'Send Console Commands',minRole: 'user' },
  CONSOLE_VIEW:         { id: 'console.view',          name: 'View Console',         minRole: 'guest' },

  // System
  SYSTEM_RESTART:       { id: 'system.restart',        name: 'Restart Services',     minRole: 'owner' },
  SYSTEM_UPDATE:        { id: 'system.update',         name: 'Update Software',      minRole: 'owner' },
  SYSTEM_POWER:         { id: 'system.power',          name: 'Power Devices',        minRole: 'user' },

  // Settings
  SETTINGS_VIEW:        { id: 'settings.view',         name: 'View Settings',        minRole: 'user' },
  SETTINGS_MODIFY:      { id: 'settings.modify',       name: 'Modify Settings',      minRole: 'owner' },

  // Users
  USER_MANAGE:          { id: 'user.manage',           name: 'Manage Users',         minRole: 'owner' },

  // Jobs / Queue
  JOB_QUEUE_MANAGE:     { id: 'job.queue',             name: 'Manage Job Queue',     minRole: 'user' },

  // History
  HISTORY_VIEW:         { id: 'history.view',          name: 'View Print History',   minRole: 'guest' },

  // Dashboard
  DASHBOARD_VIEW:       { id: 'dashboard.view',        name: 'View Dashboard',       minRole: 'guest' },
  DASHBOARD_LAYOUT:     { id: 'dashboard.layout',      name: 'Edit Dashboard Layout',minRole: 'user' },

  // Outputs
  OUTPUT_VIEW:          { id: 'output.view',           name: 'View Fans/Pins/LEDs',  minRole: 'guest' },
  OUTPUT_CONTROL:       { id: 'output.control',        name: 'Control Fans/Pins/LEDs', minRole: 'user' },

  // Printer limits
  LIMITS_VIEW:          { id: 'limits.view',           name: 'View Printer Limits',  minRole: 'guest' },
  LIMITS_SET:           { id: 'limits.set',            name: 'Set Printer Limits',   minRole: 'user' },

  // Retraction
  RETRACT_VIEW:         { id: 'retract.view',          name: 'View Retraction',      minRole: 'guest' },
  RETRACT_SET:          { id: 'retract.set',           name: 'Set Retraction',       minRole: 'user' },

  // Bed mesh
  MESH_VIEW:            { id: 'mesh.view',             name: 'View Bed Mesh',        minRole: 'guest' },
  MESH_CALIBRATE:       { id: 'mesh.calibrate',        name: 'Calibrate Bed Mesh',   minRole: 'user' },

  // GCode preview — fully available to guests (no print impact)
  GCODE_PREVIEW:        { id: 'gcode.preview',         name: 'GCode Preview',        minRole: 'guest' },

  // MMU / AFC / Spoolman
  MMU_VIEW:             { id: 'mmu.view',              name: 'View MMU/AFC Status',  minRole: 'guest' },
  MMU_CONTROL:          { id: 'mmu.control',           name: 'MMU Operations',       minRole: 'user' },
  SPOOLMAN_VIEW:        { id: 'spoolman.view',         name: 'View Spool Info',      minRole: 'guest' },
  SPOOLMAN_CHANGE:      { id: 'spoolman.change',       name: 'Change Spool',         minRole: 'user' },

  // Fluidd DB persistence (UI prefs shared across sessions)
  UI_PERSIST:           { id: 'ui.persist',            name: 'Save UI Preferences',  minRole: 'user' },
} as const
```

---

## Implementation Plan

### Phase 1: Auth Store & Role Infrastructure

#### 1.1 Extend `AppUser` with role

```typescript
// src/store/auth/types.ts — MODIFIED

export interface AppUser {
  username: string
  password?: string
  source: string
  created_on?: number
  role: Role              // NEW
}

export interface AuthState {
  authenticated: boolean
  token: JwtPayload | null
  refresh_token: JwtPayload | null
  currentUser: AppUser | null
  users: AppUser[]
  apiKey: string
  roles: UserRoleMap       // NEW — persisted to Moonraker DB
}

export type UserRoleMap = Record<string, Role>  // username → role
```

#### 1.2 Populate auth getters

The currently **empty** `src/store/auth/getters.ts` becomes the permission engine:

```typescript
// src/store/auth/getters.ts — MODIFIED

export const getters: GetterTree<AuthState, RootState> = {
  getCurrentRole: (state): Role => {
    if (!state.currentUser) return 'guest'
    return state.roles[state.currentUser.username] ?? 'guest'
  },

  hasPermission: (state, getters) => (permission: Permission): boolean => {
    const userRole: Role = getters.getCurrentRole
    return RoleHierarchy[userRole] >= RoleHierarchy[permission.minRole]
  },

  hasMinRole: (state, getters) => (minRole: Role): boolean => {
    const userRole: Role = getters.getCurrentRole
    return RoleHierarchy[userRole] >= RoleHierarchy[minRole]
  },

  isOwner: (state, getters): boolean => getters.getCurrentRole === 'owner',
  isUser: (state, getters): boolean => getters.hasMinRole('user'),
  isGuest: (state, getters): boolean => getters.getCurrentRole === 'guest',
}
```

#### 1.3 Role persistence in Moonraker DB

Roles stored under `fluidd.auth.roles` in Moonraker's database:

```typescript
// src/globals.ts — add to MOONRAKER_DB.fluidd.ROOTS
auth: { name: 'auth', dispatch: 'auth/initRoles' }
```

Actions:
- `initRoles` — load from Moonraker DB on startup
- `setUserRole` — update role for a username, persist
- `deleteUserRole` — remove role entry on user deletion

#### 1.4 First-user bootstrap

On first login when `roles` map is empty:
- The first user to authenticate is automatically assigned `owner`
- Subsequent users default to `user`
- Owner can downgrade/upgrade any user via settings

### Phase 2: Route-Level Authorization

#### 2.1 Extend route meta

```typescript
// src/router/index.ts

declare module 'vue-router' {
  interface RouteMeta {
    fillHeight?: boolean
    hasSubNavigation?: boolean
    fileDropRoot?: string
    minRole?: Role           // NEW
  }
}
```

#### 2.2 Per-route role requirements

```typescript
const routes: RouteConfig[] = [
  {
    path: '/',
    name: 'home',
    meta: { minRole: 'guest', dashboard: true },
    ...defaultRouteConfig,
    component: () => import('@/views/Dashboard.vue')
  },
  {
    path: '/console',
    name: 'console',
    meta: { minRole: 'guest' },  // view-only for guests, send gated by permission
    ...defaultRouteConfig,
    component: () => import('@/views/Console.vue')
  },
  {
    path: '/configure',
    name: 'configure',
    meta: { minRole: 'owner' },  // config file editing is owner-only
    ...defaultRouteConfig,
    component: () => import('@/views/Configure.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    meta: { minRole: 'user', hasSubNavigation: true },
    ...defaultRouteConfig,
    // ...
  },
  // ... etc
]
```

#### 2.3 Enhanced route guard

```typescript
const defaultRouteConfig: Partial<RouteConfig> = {
  beforeEnter: (to, from, next) => {
    if (!isAuthenticated()) return next({ name: 'login' })

    const minRole = to.meta?.minRole
    if (minRole && !store.getters['auth/hasMinRole'](minRole)) {
      return next({ name: 'home' })  // redirect to dashboard (guest-safe)
    }

    next()
  }
}
```

#### 2.4 Navigation filtering

`AppNavDrawer.vue` already conditionally shows items. Add role checks:

```typescript
// Only show nav items the user's role can access
get visibleRoutes () {
  return this.allRoutes.filter(route =>
    !route.meta?.minRole || this.hasMinRole(route.meta.minRole)
  )
}
```

### Phase 3: UI Element Authorization

#### 3.1 Permission directive

```typescript
// src/directives/permission.ts — NEW

// Usage: v-can="Permissions.PRINTER_CONTROL"
// Hides element if user lacks permission

Vue.directive('can', {
  bind (el, binding, vnode) {
    const permission = binding.value
    const store = vnode.context?.$store
    if (!store?.getters['auth/hasPermission'](permission)) {
      el.style.display = 'none'
    }
  },
  update (el, binding, vnode) {
    const permission = binding.value
    const store = vnode.context?.$store
    el.style.display = store?.getters['auth/hasPermission'](permission)
      ? ''
      : 'none'
  }
})
```

#### 3.2 Permission mixin

```typescript
// src/mixins/auth.ts — NEW (or extend StateMixin)

@Component
export default class AuthMixin extends Vue {
  get currentRole (): Role {
    return this.$typedGetters['auth/getCurrentRole']
  }

  can (permission: Permission): boolean {
    return this.$typedGetters['auth/hasPermission'](permission)
  }

  get isOwner (): boolean {
    return this.$typedGetters['auth/isOwner']
  }

  get isGuest (): boolean {
    return this.$typedGetters['auth/isGuest']
  }
}
```

#### 3.3 Per-widget guest gating — detailed plan

Each dashboard widget needs specific modifications. Widgets fall into three categories:

**A. Guest-safe (no changes needed)** — monitoring only, no controls:

| Widget | Why it's safe |
|--------|---------------|
| `sensors-card` | Display-only sensor chips |
| `gcode-preview-card` | Viewing/loading previews doesn't impact printing. Load, layer slider, reset are local to the viewer. Note: exclude object sends `EXCLUDE_OBJECT` gcode — but the proxy blocks guests from Moonraker API anyway (IMP-04), so the command would fail silently server-side |

**B. Guest-visible, controls hidden** — show the card but hide/disable interactive elements:

| Widget | Show to guest | Hide/disable for guest | Implementation notes |
|--------|--------------|----------------------|---------------------|
| `printer-status-card` | Status tab (thumbnail, progress, ETA) | `#menu` slot (StatusControls: cancel, pause/resume, reset, reprint); entire Reprint tab print buttons | Conditionally render `#menu`; hide or disable Reprint tab actions |
| `temperature-card` | Live temps chart, current values | Target input fields, presets menu, heater context menu (PID/MPC calibrate), cog menu (DB persistence) | Pass `readonly` prop or wrap inputs with `v-can`; hide `TemperaturePresetsMenu`; hide `HeaterContextMenu` |
| `console-card` | Console log output (read-only) | `ConsoleCommand` input bar, clear button, cog menu (filters/auto-scroll = DB writes) | `Console.vue` already has a `readonly` concept — wire it via `v-can` check; hide clear + cog |
| `camera-card` | Live camera stream | Camera selector dropdown (writes active webcam to DB) | Disable `CameraMenu` or make selection session-local for guests |
| `jobs-card` | File list (names, sizes, thumbnails) | Start print, upload, delete, move, copy, zip, preheat, enqueue, drag-drop upload | Heavy surface area — pass `readonly` to `FileSystem` or `v-can` on toolbar actions |
| `bed-mesh-card` | Mesh chart visualization | Calibrate button (`BED_MESH_CALIBRATE`) | `v-can` on calibrate button; screenshot export is client-side (OK) |
| `job-queue-card` | Queue list (read-only) | Pause/resume queue, remove all, drag reorder, add/remove/multiply jobs, toolbar prefs | Pass `readonly`; hide toolbar destructive actions |
| `spoolman-card` | Spool info display | Change spool button | `v-can` on change spool button |
| `runout-sensors-card` | Filament detected state | Enable/disable switch (`SET_FILAMENT_SENSOR`) | `v-can` on `v-switch` or set `disabled` |
| `outputs-card` | Current fan speed, pin value, LED color as text/labels | Fan sliders (`M106`/`SET_FAN_SPEED`), pin sliders/switches (`SET_PIN`), LED color picker (`SET_LED`) | Replace interactive sliders with read-only display; `v-can` wrapper |
| `printer-limits-card` | Current velocity/accel values as text | All sliders (`SET_VELOCITY_LIMIT`) | Replace sliders with read-only values; `v-can` wrapper |
| `retract-card` | Current retraction values as text | All sliders (`SET_RETRACTION`) | Replace sliders with read-only values; `v-can` wrapper |
| `beacon-card` | Model table (names, values) | Load, delete, save, calibrate buttons | `v-can` on all action buttons |
| `mmu-card` | Gate/lane status display | All controls: select, preload, eject, check, recover, unlock, load/unload, tools menu, settings checkboxes | Heavy — `v-can` on `MmuControls`, context menus, tools menu; hide `MmuSettings` |
| `afc-card` | Lane status display | Calibration, LED commands, lane actions (change tool, unload), settings checkboxes, debug download | `v-can` on `AfcCardButtons`, `AfcCardUnitLaneActions`; hide `AfcCardSettings` |

**C. Guest-hidden (entire card not shown):**

| Widget | Why hide entirely |
|--------|-------------------|
| `toolhead-card` | 100% controls (jog, extrude, position, tool change, calibration). No monitoring value without interactivity |
| `macros-card` | 100% action buttons. Showing macro names without run buttons adds no value |

#### 3.4 Implementation approach for widget gating

Two complementary strategies:

**Strategy 1: `v-can` directive on individual elements** (fine-grained)
- Best for cards with a mix of display and control elements
- Apply to specific buttons, inputs, sliders, menus
- Example: `<app-btn v-can="Permissions.PRINT_START" @click="startPrint">`

**Strategy 2: `readonly` / `disabled` prop propagation** (coarse-grained)
- Best for cards where the entire control surface should be suppressed
- Some components already support this (e.g., `Console.vue` has a `readonly` concept)
- Add a computed `readonly` prop tied to `!can(Permissions.X)` in the card wrapper
- Example: `<console :readonly="!can(Permissions.CONSOLE_SEND)" />`

**Strategy 3: Plugin manifest `minRole`** (card-level)
- Hides the entire card for roles below `minRole`
- Used for `toolhead-card` (`minRole: 'user'`) and `macros-card` (`minRole: 'user'`)
- Ties into IMP-01 plugin framework

### Phase 4: Guest Mode

#### 4.1 Guest login support

**Named guest account:**
- Owner creates a Moonraker user and assigns `guest` role in Fluiddified
- Guest logs in with those credentials at the login page
- Full JWT-based session with limited permissions
- Unauthenticated users see only the login page — no anonymous access of any kind
- The built-in proxy (IMP-04) enforces this server-side: no JWT = 401 for everything except login and static assets

#### 4.2 Guest dashboard

When role is `guest`, the dashboard is a **full monitoring view** with zero control:
- **Visible with data, controls hidden:** printer status (progress, ETA, thumbnail), thermals (chart + values), camera stream, outputs (fan speeds, pin values, LED colors as read-only), printer limits (read-only values), retraction (read-only values), sensors, console log (read-only), jobs file list (read-only), gcode preview (fully interactive — doesn't affect printing), bed mesh chart, job queue list, spoolman spool info, runout sensor state, beacon model table, MMU/AFC lane status
- **Hidden entirely:** toolhead card (100% controls), macros card (100% action buttons)
- **Controls hidden across all visible cards:** temperature inputs, presets, sliders, buttons, file upload/delete, print start/pause/cancel, calibrate buttons, macro run, console input, power toggles, queue management
- **Pages blocked:** Settings, Configure
- **Pages allowed (read-only):** Dashboard, Console (log only), History, GCode Preview, Camera

This ties directly into IMP-01: each plugin manifest's `minRole` determines guest visibility.

### Phase 5: Owner User Management UI

#### 5.1 Enhanced AuthSettings component

Extend `src/components/settings/auth/AuthSettings.vue`:

- List all users with their roles
- Role dropdown (owner, user, guest) per user
- Create user with role selection
- Delete user (with confirmation)
- API key management (existing, enhanced with role display)
- Session management (view active sessions, revoke)

#### 5.2 Role management persistence

```typescript
// Actions
auth/setUserRole({ username, role })   → Moonraker DB write
auth/createUser({ username, password, role })  → Moonraker API + DB role write
auth/deleteUser({ username })          → Moonraker API + DB role delete
```

### Phase 6: WebSocket Action Gating (Defense in Depth)

#### 6.1 Wrap SocketActions with permission checks

```typescript
// src/api/socketActions.ts — MODIFIED

// Before:
static async printerEmergencyStop () {
  baseEmit('printer.emergency_stop', { dispatch: 'void' })
}

// After:
static async printerEmergencyStop () {
  if (!this.checkPermission(Permissions.PRINTER_EMERGENCY)) return
  baseEmit('printer.emergency_stop', { dispatch: 'void' })
}

private static checkPermission (permission: Permission): boolean {
  const hasPermission = store.getters['auth/hasPermission'](permission)
  if (!hasPermission) {
    EventBus.$emit('Permission denied', { timeout: 3000 })
  }
  return hasPermission
}
```

This prevents action execution even if UI elements are manipulated via devtools.

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/types/auth.ts` | CREATE | Role, Permission types and constants |
| `src/store/auth/types.ts` | MODIFY | Add `role` to AppUser, `roles` map to state |
| `src/store/auth/state.ts` | MODIFY | Add `roles: {}` to default state |
| `src/store/auth/getters.ts` | MODIFY | Permission checking functions (currently empty) |
| `src/store/auth/actions.ts` | MODIFY | Role CRUD, init, first-user bootstrap |
| `src/store/auth/mutations.ts` | MODIFY | Role mutations |
| `src/router/index.ts` | MODIFY | Route meta roles + enhanced guard |
| `src/directives/permission.ts` | CREATE | `v-can` directive |
| `src/mixins/auth.ts` | CREATE | AuthMixin for components |
| `src/globals.ts` | MODIFY | Add auth DB root |
| `src/api/socketActions.ts` | MODIFY | Permission-gated actions |
| `src/components/layout/AppNavDrawer.vue` | MODIFY | Filter nav by role |
| `src/components/layout/AppBar.vue` | MODIFY | Hide e-stop, upload for guests |
| `src/components/settings/auth/AuthSettings.vue` | MODIFY | Role management UI |
| `src/views/Login.vue` | MODIFY | Guest login support |

### Widget files requiring modification

| Widget file | Changes |
|-------------|---------|
| `widgets/status/StatusControls.vue` | Wrap cancel/pause/resume/reprint with `v-can` |
| `widgets/status/ReprintTab.vue` | Wrap print buttons with `v-can` |
| `widgets/thermals/TemperatureTargets.vue` | Wrap target inputs with `v-can`; disable for guests |
| `widgets/thermals/TemperaturePresetsMenu.vue` | Wrap entire menu with `v-can` |
| `widgets/thermals/HeaterContextMenu.vue` | Wrap PID/MPC actions with `v-can` |
| `widgets/thermals/TemperatureCard.vue` | Wrap cog menu with `v-can` |
| `widgets/console/ConsoleCard.vue` | Pass `readonly` based on role; hide clear + cog |
| `widgets/camera/CameraCard.vue` | Disable `CameraMenu` for guests |
| `widgets/outputs/OutputFan.vue` | Replace slider with read-only for guests |
| `widgets/outputs/OutputPin.vue` | Replace slider/switch with read-only for guests |
| `widgets/outputs/OutputLed.vue` | Replace color picker with read-only for guests |
| `widgets/limits/PrinterLimits.vue` | Replace sliders with read-only for guests |
| `widgets/retract/Retract.vue` | Replace sliders with read-only for guests |
| `widgets/jobs/JobsCard.vue` | Pass `readonly` to FileSystem for guests |
| `widgets/bedmesh/BedMeshCard.vue` | Hide calibrate button for guests |
| `widgets/gcode-preview/GcodePreviewCard.vue` | No changes — fully available to guests (doesn't impact printing) |
| `widgets/job-queue/JobQueueCard.vue` | Pass `readonly`; hide destructive toolbar actions |
| `widgets/spoolman/SpoolmanCard.vue` | Hide change spool button for guests |
| `widgets/mmu/MmuCard.vue` | Hide controls, tools menu, settings for guests |
| `widgets/mmu/MmuControls.vue` | Wrap all actions with `v-can` |
| `widgets/runout-sensors/RunoutSensorsCard.vue` | Disable sensor switches for guests |
| `widgets/beacon/BeaconCard.vue` | Hide load/delete/save/calibrate for guests |
| `widgets/afc/AfcCard.vue` | Hide buttons, lane actions, settings for guests |
| `widgets/afc/AfcCardButtons.vue` | Wrap all commands with `v-can` |
| `widgets/afc/AfcCardUnitLaneActions.vue` | Wrap lane actions with `v-can` |
| `widgets/toolhead/ToolheadCard.vue` | Hidden entirely via manifest `minRole: 'user'` |
| `widgets/macros/MacrosCard.vue` | Hidden entirely via manifest `minRole: 'user'` |

## Moonraker Considerations

Moonraker itself has no RBAC. Fluidd's RBAC is **client-enforced only** with defense-in-depth:

1. **UI layer** — hide/disable elements based on role
2. **Action layer** — `SocketActions` checks permission before emitting
3. **Route layer** — navigation guard prevents page access

For true server-side enforcement, a reverse proxy (nginx/Caddy) or Moonraker plugin would be needed. This is noted as a future enhancement.

### Recommended deployment for internet exposure

```
Internet → Cloudflare Tunnel / Tailscale / WireGuard
  → Reverse proxy (nginx/Caddy) with rate limiting + TLS
    → Moonraker (force_logins: true)
      → Klipper
```

The RBAC in this implementation provides defense at the Fluidd UI layer. Combined with Moonraker's `force_logins` and a secure tunnel, this provides reasonable security for internet access.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Client-only enforcement is bypassable | High | Document as UI-level; recommend reverse proxy for prod |
| Role sync with Moonraker users | Medium | Roles in Fluidd DB, users in Moonraker; link by username |
| Guest account password shared | Low | Owner can reset; standard credential management |
| Breaking existing trusted-client setups | High | Default role for trusted users is `user` |
| Permission creep (too granular) | Low | Start with role-based, not permission-based checks |

## Dependencies

- IMP-01 (Plugin Framework) — manifests use `minRole` for widget-level gating
- Moonraker's existing auth API (`/access/*`)

## Estimated Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Auth store & role infra | 2-3 days | P0 |
| Phase 2: Route-level authorization | 1 day | P0 |
| Phase 3: UI element authorization | 4-5 days | P0 |
| Phase 4: Guest mode | 2-3 days | P1 |
| Phase 5: Owner user mgmt UI | 2-3 days | P1 |
| Phase 6: WebSocket action gating | 1-2 days | P1 |

**Total Phase 1-3 (MVP): ~8-9 days**

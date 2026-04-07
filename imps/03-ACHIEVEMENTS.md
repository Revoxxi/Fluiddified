# IMP-03: Achievement System

## Status: PLANNED

## Overview

A rich gamification layer unique to Fluiddified that tracks printing milestones, behavioral patterns, exploration, and notable events. Unlike OctoPrint's minimal 36-achievement system (mostly hidden, focused on project awareness), Fluiddified's achievements are:

- **Expansive** — 70+ achievements across 8 categories
- **Progression-focused** — multi-tiered milestones with visible progress bars
- **Behavioral** — reward good habits (calibration, maintenance, consistency)
- **Social** — shareable achievement cards (future)
- **Klipper-native** — leverage Klipper-specific features (input shaper, pressure advance, bed mesh, etc.)

Two UI surfaces:

1. **Achievement widget** — a dashboard card (via IMP-01 plugin framework) with a scrollable list showing all achievements, completion status, and progression bars
2. **Notification popup** — when an achievement is unlocked, fire a flash message via the existing `EventBus` system

## Current Infrastructure We Can Leverage

| Component | How it helps |
|-----------|-------------|
| `EventBus.$emit(text, { type, timeout })` | Notification popups — `FlashMessage` with `type: 'success'` |
| `FlashMessageTypes` | Already has `'success'` type for positive notifications |
| `history` store module | `job_totals` has `total_jobs`, `total_print_time`, `total_filament_used`, `longest_print`, `longest_job` |
| `history/getRollUp` getter | Pre-computed averages and totals |
| `history/getHistory` getter | Full job list with `start_time`, `end_time`, `status`, `filament_used`, `print_duration` |
| Moonraker DB persistence | `fluidd` namespace for storing unlocked achievements and stats |
| IMP-01 plugin manifest | Achievement card registers as a dashboard widget via manifest |
| `printer` store | Real-time Klipper state: heaters, toolhead, input shaper, pressure advance, bed mesh, MCU stats, etc. |
| `console` store | Command history for tracking gcode usage |

---

## Achievement Categories & Definitions

### Category 1: Print Volume (tiered progression)

Track cumulative printing output. Each has 7 tiers.

| ID | Name | Description | Metric | Tiers |
|----|------|-------------|--------|-------|
| `prints_completed` | Print Counter | Complete N successful prints | Completed jobs | 1, 10, 50, 100, 250, 500, 1000 |
| `print_hours` | Time Invested | Accumulate N hours of print time | Total print hours | 1, 10, 50, 100, 500, 1000, 5000 |
| `filament_used` | Spool Slayer | Consume N meters of filament | Total filament (m) | 1, 10, 100, 500, 1000, 5000, 10000 |
| `print_weight` | Heavy Hitter | Print N grams of material (estimated) | Filament weight (g) | 10, 100, 500, 1000, 5000, 10000, 50000 |

### Category 2: Consistency & Reliability (tiered progression)

Reward dependable printing habits.

| ID | Name | Description | Metric | Tiers |
|----|------|-------------|--------|-------|
| `consecutive_success` | Streak Master | Complete N prints in a row without failure | Consecutive completions (resets on fail) | 3, 5, 10, 25, 50, 100 |
| `daily_streak` | Daily Driver | Print on N consecutive days | Consecutive calendar days with a print | 3, 7, 14, 30, 60, 90 |
| `weekly_active` | Regular | Print at least once per week for N weeks | Consecutive weeks with ≥1 print | 4, 8, 12, 26, 52 |
| `success_rate` | Quality Control | Maintain N% success rate over 50+ prints | `completed / total` percentage | 80, 85, 90, 95, 99 |
| `days_active` | Dedicated Maker | Print on N distinct days total | Unique calendar dates | 7, 30, 90, 180, 365, 730 |
| `uptime_champion` | Always On | Printer connected for N cumulative hours | WebSocket connected time | 100, 500, 1000, 5000, 10000 |

### Category 3: Print Characteristics (event-based, some tiered)

Recognize notable individual prints.

| ID | Name | Description | Trigger |
|----|------|-------------|---------|
| `first_print` | Hello World | Complete your very first print | First completed job |
| `first_cancel` | Knowing When to Fold | Cancel a print for the first time | First cancelled job |
| `speed_demon` | Speed Demon | Complete a print in under 5 minutes | `print_duration < 300` |
| `quick_job` | Quick Draw | Complete a print in under 1 minute | `print_duration < 60` |
| `marathon_4h` | Endurance Run | Complete a print over 4 hours | `print_duration > 14400` |
| `marathon_12h` | Ultra Marathon | Complete a print over 12 hours | `print_duration > 43200` |
| `marathon_24h` | Iron Printer | Complete a print over 24 hours | `print_duration > 86400` |
| `marathon_48h` | Sleep Is Overrated | Complete a print over 48 hours | `print_duration > 172800` |
| `big_print_50m` | Material Consumer | Single print using 50+ meters of filament | `filament_used > 50000` |
| `big_print_100m` | Mega Build | Single print using 100+ meters | `filament_used > 100000` |
| `big_print_250m` | Industrial Scale | Single print using 250+ meters | `filament_used > 250000` |
| `tiny_print` | Miniaturist | Complete a print using under 0.5 meters | `filament_used < 500 && status === 'completed'` |
| `back_to_back` | Assembly Line | Start a new print within 5 min of finishing one | `start_time - prev.end_time < 300` |
| `triple_play` | Hat Trick | Complete 3 prints in a single day | 3 completed jobs with same calendar date |
| `production_day` | Production Mode | Complete 5+ prints in a single day | 5 completed jobs same date |
| `factory_floor` | Factory Floor | Complete 10+ prints in a single day | 10 completed jobs same date |

### Category 4: Timing & Schedule (event-based)

When you print matters.

| ID | Name | Description | Trigger |
|----|------|-------------|---------|
| `night_owl` | Night Owl | Start a print between midnight and 4 AM | `start_time` hour ∈ [0,4) |
| `early_bird` | Early Bird | Start a print between 5 AM and 7 AM | `start_time` hour ∈ [5,7) |
| `lunch_break` | Lunch Break Print | Start a print between 12 PM and 1 PM | `start_time` hour ∈ [12,13) |
| `weekend_warrior` | Weekend Warrior | Print on 10 different weekends | 10 distinct Sat/Sun dates |
| `midnight_finish` | Midnight Delivery | A print completes between 11:55 PM and 12:05 AM | `end_time` crosses midnight |
| `new_years_print` | New Year, New Layer | Start or finish a print on January 1st | Date check |
| `holiday_printer` | Holiday Spirit | Print on a major holiday (Dec 25, Jul 4, etc.) | Date check against holiday list |
| `friday_13th` | Superstitious Maker | Complete a print on Friday the 13th | Day of week + date check |

### Category 5: Klipper Mastery (event-based, Klipper-specific)

Achievements tied to Klipper's unique features — makes our system distinct from OctoPrint.

| ID | Name | Description | Trigger |
|----|------|-------------|---------|
| `first_mesh` | Leveled Up | Run your first bed mesh calibration | First `BED_MESH_CALIBRATE` command |
| `mesh_master` | Mesh Master | Run bed mesh calibration 25 times | Track `BED_MESH_CALIBRATE` count (tiered: 5, 10, 25) |
| `input_shaper` | Shake It Off | Run input shaper calibration | `SHAPER_CALIBRATE` or `TEST_RESONANCES` detected |
| `pressure_advance` | Under Pressure | Tune pressure advance | `SET_PRESSURE_ADVANCE` with non-zero value |
| `pid_tuned` | Dialed In | Complete a PID calibration | `PID_CALIBRATE` command detected |
| `z_offset_save` | Nailed It | Save Z offset | `Z_OFFSET_APPLY_ENDSTOP` or `SAVE_CONFIG` after Z adjust |
| `firmware_retract` | Retract Master | Configure firmware retraction | `SET_RETRACTION` detected |
| `multi_extruder` | Material Mixer | Use a multi-extruder setup (MMU/AFC/dual) | MMU or AFC state detected during print |
| `exclude_object` | Selective Surgeon | Exclude an object during a print | `EXCLUDE_OBJECT` command |
| `probe_accuracy` | Precision Engineer | Run probe accuracy test | `PROBE_ACCURACY` command |
| `speed_test` | Speed Racer | Run a speed/acceleration test macro | `TEST_SPEED` or similar test macro detected |
| `endstop_check` | Safety First | Query endstops | `QUERY_ENDSTOPS` detected |
| `config_backup` | Belt & Suspenders | Save a config backup | Config backup action in Fluiddified |
| `macro_creator` | Automation Master | Create or edit a macro in config | Edit detected in `[gcode_macro]` section |
| `klipper_restart` | Fresh Start | Restart Klipper firmware | `FIRMWARE_RESTART` detected (tiered: 1, 10, 50, 100) |
| `save_config` | Committed | Use SAVE_CONFIG | `SAVE_CONFIG` command (tiered: 1, 5, 10, 25) |

### Category 6: Exploration & Customization (event-based)

Reward discovering Fluiddified's features.

| ID | Name | Description | Trigger |
|----|------|-------------|---------|
| `first_macro` | Script Kiddie | Run your first macro | First macro execution |
| `macro_variety` | Macro Maestro | Run 25 different macros | Distinct macro names (tiered: 5, 10, 25, 50) |
| `camera_viewer` | Surveillance Pro | View 3 different camera feeds | Distinct webcam IDs viewed |
| `theme_changer` | Interior Designer | Change the UI theme | Theme change detected |
| `theme_collector` | Fashion Show | Use 5 different themes | 5 distinct theme configs applied |
| `layout_editor` | Architect | Customize your dashboard layout | Enter layout edit mode |
| `layout_power_user` | Grand Architect | Make 10 layout changes | Layout change count |
| `console_explorer` | Terminal Wizard | Send 100 console commands | Command count (tiered: 10, 50, 100, 500) |
| `file_organizer` | Tidy Workspace | Create a folder in the file manager | Directory creation detected |
| `multi_instance` | Fleet Commander | Add multiple printer instances | Instance count ≥ 2 |
| `keyboard_shortcuts` | Shortcut Master | Use 5 different keyboard shortcuts | Track distinct shortcut usage |
| `fullscreen_mode` | Immersive Mode | Use a fullscreen view (camera, gcode preview, etc.) | Fullscreen route navigation |
| `settings_deep_dive` | Configurator | Visit every settings section | Track visited settings hashes |
| `gcode_previewer` | Blueprint Reader | Load a gcode preview | Preview load action |
| `history_buff` | Historian | View the print history page | Navigate to `/history` |

### Category 7: Thermal Achievements (real-time monitoring)

| ID | Name | Description | Trigger |
|----|------|-------------|---------|
| `temp_precision` | Thermal Surgeon | Hold heater within 0.5°C of target for 10 min | Real-time temp monitoring |
| `high_temp` | Playing With Fire | Heat a hotend above 280°C | `extruder.temperature > 280` |
| `abs_warrior` | ABS Veteran | Heat bed above 100°C | `heater_bed.temperature > 100` |
| `cool_down_patience` | Patient Cooler | Wait for bed to cool below 30°C before removing print | Post-print bed temp tracking |
| `preheat_master` | Warm Welcome | Use 10 temperature presets | Preset activation count |
| `all_heaters_on` | Full Power | Have 3+ heaters at target simultaneously | Multi-heater target check |

### Category 8: Hidden Achievements (secret, discovered by the user)

These show as "???" in the widget until unlocked.

| ID | Name | Description | Trigger |
|----|------|-------------|---------|
| `konami` | ↑↑↓↓←→←→BA | Enter the Konami code on the dashboard | Keyboard sequence detection |
| `patience` | Zen Master | Watch a print for 30 min without interacting | No user input timer during active print |
| `emergency_stop` | Panic Button | Use emergency stop for the first time | E-stop action |
| `easter_egg_time` | It's Printing O'Clock | Check the dashboard at exactly 3:14 PM (π time) | Time check (14:13:59–14:14:01 window) |
| `palindrome_print` | Mirror Mirror | Complete a print with a palindrome duration (e.g., 1:23:21) | Duration string palindrome check |
| `lucky_seven` | Lucky Number | Your 7th print completes in exactly 7 minutes | Job count + duration check |
| `round_number` | Nice and Round | Complete exactly your 100th/500th/1000th print | Milestone job count |
| `bounced_back` | Resilience | Successfully complete a print right after a failure | `cancelled/error` followed by `completed` |
| `browser_refresh` | Refresh Addict | Refresh the page 10 times in one session | Page reload counter |
| `night_shift` | Graveyard Shift | Have a print running continuously from 11 PM to 6 AM | Print spans midnight hours |
| `temp_42` | The Answer | Set a heater target to exactly 42°C | Temperature target check |
| `scroll_to_bottom` | Achievement Hunter | Scroll to the very bottom of the achievements list | Scroll position detection in widget |
| `five_hundred_errors` | Error Veteran | Accumulate 50 failed/cancelled prints | Failed job count |

---

## Architecture

### Data Model

```typescript
// src/types/achievement.ts

export type AchievementCategory =
  | 'volume'
  | 'consistency'
  | 'characteristics'
  | 'timing'
  | 'klipper'
  | 'exploration'
  | 'thermal'
  | 'hidden'

export interface AchievementDefinition {
  id: string
  name: string
  description: string
  icon: string
  category: AchievementCategory
  hidden?: boolean

  /** For tiered achievements — ordered thresholds */
  tiers?: number[]

  /** Unit label for progression display (e.g., "prints", "hours", "meters") */
  unit?: string

  /** Flavor text shown on unlock */
  unlockMessage?: string

  /** Rarity estimate: common, uncommon, rare, epic, legendary */
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

  /** XP points awarded (for total score display) */
  points?: number
}

export interface AchievementProgress {
  current: number
  tierReached: number
  unlockedAt?: number
  tierUnlockedAt?: Record<number, number>
}

export interface AchievementState {
  progress: Record<string, AchievementProgress>
  stats: AchievementStats
  totalPoints: number
  enabled: boolean
  notificationsEnabled: boolean
}

export interface AchievementStats {
  consecutiveSuccesses: number
  dailyStreak: number
  lastPrintDate: string | null
  distinctMacrosRun: string[]
  distinctFilesCompleted: string[]
  distinctDaysPrinted: string[]
  distinctThemesUsed: string[]
  weekendsPrinted: string[]
  webcamsViewed: string[]
  settingsSectionsVisited: string[]
  shortcutsUsed: string[]
  commandsSentCount: number
  bedMeshCalibrations: number
  themeChanges: number
  layoutChanges: number
  presetActivations: number
  failedPrintCount: number
  lastPrintEndTime: number
  pageRefreshCount: number
  printWatchStartTime: number | null
  controlTouchedDuringWatch: boolean
  uptimeMs: number
  klipperRestarts: number
  saveConfigCount: number
}
```

### Points & Rarity System

Each achievement has a point value based on rarity:

| Rarity | Points | Typical Condition |
|--------|--------|-------------------|
| Common | 10 | First occurrences, basic exploration |
| Uncommon | 25 | Moderate effort, repeated actions |
| Rare | 50 | Sustained consistency, skill-based |
| Epic | 100 | Long-term dedication, multi-day streaks |
| Legendary | 250 | Exceptional milestones (1000 prints, 5000 hours, etc.) |

Total score displayed in widget header. Tiered achievements award points per tier (increasing rarity per tier).

### Store Module

```
src/store/achievements/
├── index.ts
├── state.ts          # defaultState with empty progress + stats
├── getters.ts        # getAchievements, getUnlocked, getProgress, getNextTier,
│                     #   getTotalPoints, getByCategory, getCompletionPercentage
├── mutations.ts      # setProgress, updateStats, setUnlocked, setEnabled
├── actions.ts        # checkAchievements, initAchievements, onPrintComplete,
│                     #   onCommandSent, onThemeChange, onLayoutChange, etc.
└── types.ts          # AchievementState, AchievementStats
```

**Persistence:** Stored in Moonraker DB under `fluidd.achievements`:

```typescript
// src/globals.ts — add to MOONRAKER_DB.fluidd.ROOTS
achievements: { name: 'achievements', dispatch: 'achievements/initAchievements' }
```

### Achievement Checking Pipeline

```
Event (print complete, macro run, temp change, etc.)
  → Store action dispatched (e.g., achievements/onPrintComplete)
    → Update stats counters
    → For each relevant achievement definition:
      → Compare current progress to thresholds/conditions
      → If new tier/unlock reached:
        → Commit unlock mutation
        → Add points to totalPoints
        → Fire EventBus notification (if enabled)
        → Persist to Moonraker DB
```

### Integration Points

#### 1. Print completion/cancel hook

`src/store/history/actions.ts`:

```typescript
dispatch('achievements/onPrintComplete', job, { root: true })
```

Triggers: volume achievements, characteristics, timing, consistency, streaks, hidden

#### 2. Console command hook

`src/store/console/actions.ts`:

```typescript
dispatch('achievements/onCommandSent', command, { root: true })
```

Triggers: Klipper mastery (mesh, input shaper, PID, etc.), macro tracking, console explorer

#### 3. Printer state watchers

`src/store/printer/actions.ts` or Vue watchers:

- Temperature monitoring (thermal achievements)
- MMU/AFC detection (multi-extruder)
- Heater states (all heaters on)

#### 4. UI event hooks

Various components dispatch to achievements store:

- Theme changes → `achievements/onThemeChange`
- Layout edit → `achievements/onLayoutChange`
- Config file save → `achievements/onConfigSave`
- Camera view → `achievements/onCameraView`
- Route navigation → `achievements/onNavigate`
- Settings visit → `achievements/onSettingsVisit`
- Keyboard shortcut → `achievements/onShortcutUsed`
- E-stop → `achievements/onEmergencyStop`
- Preset activation → `achievements/onPresetActivated`
- Page visibility/focus → `achievements/onPageFocus` (for patience tracking)

#### 5. Periodic checks (timers)

- Uptime tracking (increment every 60s while connected)
- Pi time easter egg (check time every 30s)
- Temperature stability (check every 10s during prints)

### Notification

When an achievement unlocks:

```typescript
function notifyAchievement (achievement: AchievementDefinition, tier?: number) {
  const tierLabel = tier != null && achievement.tiers
    ? ` — Tier ${tier + 1}/${achievement.tiers.length}`
    : ''
  const msg = achievement.unlockMessage || achievement.description
  EventBus.$emit(`🏆 ${achievement.name}${tierLabel} — ${msg}`, {
    type: 'success',
    timeout: 8000
  })
}
```

Future enhancement: custom `AchievementNotification.vue` component with:
- Achievement icon + name + description
- Rarity badge (color-coded)
- Points earned
- Progress bar (for tiered)
- Subtle animation (slide in from bottom-right)

---

## Dashboard Widget

### `AchievementsCard.vue`

**Layout:**
```
┌─ Achievements ──────────── [⭐ 1,250 pts │ 24/73] ─┐
│                                                       │
│  [All] [Volume] [Klipper] [Timing] [Hidden] [...]    │
│                                                       │
│  ⭐ Print Counter (Tier 4)         RARE               │
│     "Complete 100 prints"                             │
│     ████████████████░░░░  142/250 for Tier 5          │
│                                                       │
│  ✅ Hello World                    COMMON              │
│     "Your very first print"                           │
│     Completed Apr 2, 2026                             │
│                                                       │
│  🔥 Streak Master                  UNCOMMON            │
│     "5 prints in a row"                               │
│     ███░░░░░░░░░░░░░░░░  3/5 consecutive              │
│                                                       │
│  🔒 Shake It Off                   RARE                │
│     "Run input shaper calibration"                    │
│     Not yet unlocked                                  │
│                                                       │
│  ❓ ???                            LEGENDARY            │
│     "Discover this achievement"                       │
│                                                       │
│  ··· (scrollable) ···                                 │
└───────────────────────────────────────────────────────┘
```

**Features:**
- Scrollable list of all achievements
- Filter tabs by category (All, Volume, Consistency, Klipper, Timing, Exploration, Thermal, Hidden)
- Sort by: rarity, progress, unlock date, category
- Rarity badges with color coding (common=gray, uncommon=green, rare=blue, epic=purple, legendary=gold)
- Points total in header
- Completion percentage ring or bar
- Completed achievements show green check + unlock date
- In-progress achievements show progress bar with current/next tier
- Hidden achievements show "???" until unlocked, then reveal
- Click achievement → detail dialog with tier history, unlock timestamps, flavor text
- Narrow mode: compact layout for smaller columns

**Widget manifest:**

```typescript
const manifest: PluginManifest = {
  id: 'achievements-card',
  name: 'Achievements',
  version: '1.0.0',
  icon: 'trophy',
  component: () => import('./AchievementsCard.vue'),
  defaultEnabled: true,
  defaultContainer: 2,
  defaultPosition: 8,
  minRole: 'guest',
  tags: ['gamification', 'stats'],
  storeModule: {
    name: 'achievements',
    module: achievementsModule
  }
}
```

### Sub-components

```
src/components/widgets/achievements/
├── AchievementsCard.vue            # Main card (CollapsableCard wrapper)
├── AchievementList.vue             # Scrollable list with category tabs + sort
├── AchievementItem.vue             # Single row: icon, name, rarity badge, progress
├── AchievementDetailDialog.vue     # Expanded view: tiers, timestamps, flavor text
├── AchievementProgressBar.vue      # Multi-tier progress visualization
├── AchievementRarityBadge.vue      # Color-coded rarity label
├── AchievementCategoryIcon.vue     # Category-specific icon
├── definitions.ts                  # All 73 achievement definitions
└── manifest.ts                     # Plugin manifest
```

---

## Settings Integration

### Achievement Settings (in Settings page)

New `AchievementSettings.vue` section:

- **Enable/disable** achievement tracking toggle
- **Notifications** — toggle achievement popups on/off
- **Hidden achievements** — spoiler mode (reveal all names/descriptions)
- **Reset achievements** button (with double confirmation)
- **Export** achievement data as JSON
- **Import** achievement data from JSON
- **Stats overview** — total prints tracked, total points, completion %, most recent unlock

---

## Retroactive Unlocking

On first install or when achievements store is empty:

1. Scan `history/getHistory` for all completed jobs via Moonraker `server.history.list`
2. Calculate totals → unlock progression tiers retroactively
3. Check event conditions (night owl, marathon, etc.) against existing history timestamps
4. Check timing achievements against historical `start_time` / `end_time`
5. Set `unlockedAt` to the relevant job's `end_time` (not current time)
6. Calculate streaks and consistency from historical dates
7. **Do not** fire notifications for retroactive unlocks — only show them as already-completed in the widget
8. Fire a single summary notification: "X achievements unlocked from your print history!"

---

## Implementation Plan

### Phase 1: Core Infrastructure (2-3 days)

- [ ] Create `src/types/achievement.ts` — types (with rarity, points, categories)
- [ ] Create `src/store/achievements/` — full Vuex module (6 files)
- [ ] Define all 73 achievement definitions in `definitions.ts`
- [ ] Add `achievements` DB root to `src/globals.ts`
- [ ] Wire module into `src/store/index.ts` and `types.ts`
- [ ] Implement `initAchievements` — load from Moonraker DB
- [ ] Implement `checkProgressionAchievements` — scan history totals
- [ ] Implement `checkEventAchievements` — scan history for one-time events
- [ ] Implement points calculation system

### Phase 2: Event Hooks (3-4 days)

- [ ] Hook into `history` store — print complete/cancel dispatch
- [ ] Hook into `console` store — command tracking (macros, Klipper commands)
- [ ] Hook into `printer` store — temp monitoring, MMU/AFC, heater states
- [ ] Hook into `config` store — theme changes, config saves
- [ ] Hook into `webcams` store — camera view tracking
- [ ] Hook into `layout` store — layout change tracking
- [ ] Hook into router — navigation tracking (settings visits, fullscreen)
- [ ] Implement streak/consistency tracking (daily, weekly)
- [ ] Implement notification via `EventBus.$emit`
- [ ] Add Konami code listener (keyboard event on dashboard)
- [ ] Add "patience" watcher (no-input timer during print)
- [ ] Add periodic timer checks (pi time, uptime, temp stability)
- [ ] Add page refresh counter

### Phase 3: Dashboard Widget (3-4 days)

- [ ] Create `AchievementsCard.vue` with `CollapsableCard` shell
- [ ] Create `AchievementList.vue` with category tabs + sort options
- [ ] Create `AchievementItem.vue` with progress bar + rarity badge
- [ ] Create `AchievementDetailDialog.vue` with tier history
- [ ] Create `AchievementProgressBar.vue` (multi-tier segments)
- [ ] Create `AchievementRarityBadge.vue` (color-coded)
- [ ] Create `AchievementCategoryIcon.vue`
- [ ] Create `manifest.ts` for plugin registry
- [ ] Add default layout entry (container 2, toward bottom)
- [ ] Narrow mode support (compact layout for small columns)
- [ ] Style: rarity colors, tier badges, unlock animations

### Phase 4: Settings & Polish (1-2 days)

- [ ] Create `AchievementSettings.vue`
- [ ] Add to Settings view
- [ ] Reset/export/import functionality
- [ ] Notification preferences
- [ ] Spoiler mode for hidden achievements
- [ ] Stats overview panel
- [ ] Retroactive unlock scan with summary notification
- [ ] Achievement scroll-to-bottom detection (hidden achievement trigger)

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/types/achievement.ts` | CREATE | Achievement types with rarity + points |
| `src/store/achievements/` | CREATE | Vuex module (6 files) |
| `src/globals.ts` | MODIFY | Add achievements DB root |
| `src/store/index.ts` | MODIFY | Register achievements module |
| `src/store/types.ts` | MODIFY | Add AchievementState to root types |
| `src/store/history/actions.ts` | MODIFY | Dispatch to achievements on job events |
| `src/store/console/actions.ts` | MODIFY | Dispatch to achievements on command send |
| `src/store/config/actions.ts` | MODIFY | Dispatch on theme/layout changes |
| `src/components/widgets/achievements/` | CREATE | Widget components (8 files) |
| `src/components/settings/AchievementSettings.vue` | CREATE | Settings panel |
| `src/views/Settings.vue` | MODIFY | Add AchievementSettings section |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance of checking 73 achievements on events | Low | Category-based dispatch — only check relevant achievements per event type |
| Moonraker DB bloat from stats tracking | Low | Stats are small; prune arrays (distinctMacros etc.) at reasonable caps |
| Achievement definitions changing between versions | Medium | Migration: new definitions auto-add; removed keep unlocked state |
| Time-based achievements depend on timezone | Low | Use local timezone via `Date`; document behavior |
| Console history not persisted for retro scan | Medium | Use `server.history.list` API for comprehensive retroactive scan |
| Periodic timers impacting performance | Low | Coarse intervals (10-60s); requestAnimationFrame for precision checks |

## Dependencies

- IMP-01 (Plugin Framework) — registers as dashboard widget via manifest
- Moonraker history API — `server.history.list` and `server.history.totals`
- Existing `EventBus` — notification popups
- No external packages required

## Estimated Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Core infrastructure | 2-3 days | P1 |
| Phase 2: Event hooks | 3-4 days | P1 |
| Phase 3: Dashboard widget | 3-4 days | P1 |
| Phase 4: Settings & polish | 1-2 days | P2 |

**Total: ~10-13 days**

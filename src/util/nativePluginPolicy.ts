/**
 * Built-in dashboard widgets shipped with the app (each widget folder under
 * src/components/widgets contains manifest.ts). These cannot be removed; only a subset
 * may be disabled from the plugin manager.
 */
export const NATIVE_BUNDLED_PLUGIN_IDS = new Set<string>([
  'afc-card',
  'achievements-card',
  'bed-mesh-card',
  'beacon-card',
  'camera-card',
  'console-card',
  'gcode-preview-card',
  'job-queue-card',
  'jobs-card',
  'macros-card',
  'mmu-card',
  'outputs-card',
  'printer-limits-card',
  'printer-status-card',
  'retract-card',
  'runout-sensors-card',
  'sensors-card',
  'spoolman-card',
  'temperature-card',
  'toolhead-card'
])

/**
 * Optional / hardware-specific native widgets the user may turn off from
 * Plugin manager. All other natives stay enabled.
 */
export const NATIVE_OPTIONAL_DISABLE_IDS = new Set<string>([
  'achievements-card',
  'afc-card',
  'beacon-card',
  'job-queue-card',
  'mmu-card',
  'outputs-card',
  'runout-sensors-card',
  'sensors-card',
  'spoolman-card'
])

export function isNativeBundledPlugin (id: string): boolean {
  return NATIVE_BUNDLED_PLUGIN_IDS.has(id)
}

/** False = toggle is locked (built-in non-optional widget). */
export function canUserDisablePlugin (id: string): boolean {
  if (!isNativeBundledPlugin(id)) {
    return true
  }
  return NATIVE_OPTIONAL_DISABLE_IDS.has(id)
}

/** Native widgets (and achievements) are never removable; only external/user packs are. */
export function canUserRemovePlugin (id: string): boolean {
  return !isNativeBundledPlugin(id)
}

export function nativePluginKind (
  id: string
): 'non-native' | 'optional-native' | 'core-native' {
  if (!isNativeBundledPlugin(id)) {
    return 'non-native'
  }
  if (NATIVE_OPTIONAL_DISABLE_IDS.has(id)) {
    return 'optional-native'
  }
  return 'core-native'
}

/**
 * Plugin manager lists optional / non-standard natives and every non-native
 * widget. Core (always-on) built-ins are hidden so the panel stays focused.
 */
export function isShownInPluginManager (id: string): boolean {
  if (!isNativeBundledPlugin(id)) {
    return true
  }
  return NATIVE_OPTIONAL_DISABLE_IDS.has(id)
}

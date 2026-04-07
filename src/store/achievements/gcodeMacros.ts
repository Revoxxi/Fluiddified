import type { RootState } from '@/store/types'

const GCODE_MACRO_PREFIX = 'gcode_macro '

/**
 * If the first token matches a configured [gcode_macro] in Klipper, returns the macro's canonical name.
 * Internal Klipper helpers (name starts with _) are ignored for user-facing macro achievements.
 */
export function resolveUserVisibleMacroName (
  rootState: RootState,
  firstToken: string
): string | null {
  const token = firstToken.trim()
  if (!token) return null

  const upper = token.toUpperCase()
  const printer = rootState.printer?.printer
  if (printer == null || typeof printer !== 'object') return null

  for (const key of Object.keys(printer)) {
    if (!key.toLowerCase().startsWith(GCODE_MACRO_PREFIX)) continue
    const parts = key.split(/\s+/, 2)
    const macroName = parts[1]
    if (macroName == null) continue
    if (macroName.toUpperCase() !== upper) continue
    if (macroName.startsWith('_')) return null
    return macroName
  }

  return null
}

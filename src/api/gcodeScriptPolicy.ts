/**
 * Operators (`user` Fluidd role) may run movement, temps, print control, and macros,
 * but not calibration, Z-offset, mesh, probe tuning, or config-persisting machine commands.
 * Owners bypass this in `socketActions.printerGcodeScript`.
 */

const OPERATOR_FORBIDDEN_SUBSTRINGS: readonly string[] = [
  'SAVE_CONFIG',
  'LOAD_CONFIG',
  'FIRMWARE_RESTART',
  'BED_MESH',
  'SCREWS_TILT',
  'BED_SCREWS_ADJUST',
  'BED_TILT_CALIBRATE',
  'PROBE_CALIBRATE',
  'PROBE_ACCURACY',
  'DELTA_CALIBRATE',
  'Z_TILT_ADJUST',
  'QUAD_GANTRY_LEVEL',
  'Z_ENDSTOP_CALIBRATE',
  'MANUAL_PROBE',
  'BEACON_',
  'CARTOGRAPHER_',
  'SET_GCODE_OFFSET',
  'PID_CALIBRATE',
  'MPC_CALIBRATE',
  'FORCE_MOVE',
  'ACCELEROMETER',
  'INPUT_SHAPER',
  'SET_PRESSURE_ADVANCE',
  'Z_OFFSET_APPLY',
  'TESTZ',
  'SHAPER_CALIBRATE',
  'SET_KINEMATIC_POSITION',
  'TUNING_TOWER',
  'M851'
]

function normalizeGcodeLine (line: string): string {
  const semi = line.indexOf(';')
  const withoutComment = semi >= 0 ? line.slice(0, semi) : line
  return withoutComment.trim().toUpperCase()
}

/**
 * Returns whether a `printer.gcode.script` payload is allowed for Fluidd **user** (operator).
 * **Owner** and **guest** are not evaluated here (guest cannot call the method; owner bypasses).
 */
export function isOperatorGcodeScriptAllowed (script: string): boolean {
  const lines = script.split(/\r?\n/u)

  for (const raw of lines) {
    const line = normalizeGcodeLine(raw)
    if (line.length === 0) continue

    for (const forbidden of OPERATOR_FORBIDDEN_SUBSTRINGS) {
      if (line.includes(forbidden)) {
        return false
      }
    }

    // Marlin-style mesh (avoid matching G290+)
    if (/^\s*G29(\s|$)/u.test(line)) {
      return false
    }
  }

  return true
}

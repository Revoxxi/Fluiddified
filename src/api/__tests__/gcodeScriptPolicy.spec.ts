import { describe, expect, it } from 'vitest'
import { isOperatorGcodeScriptAllowed } from '@/api/gcodeScriptPolicy'

describe('isOperatorGcodeScriptAllowed', () => {
  it('allows movement and temps', () => {
    expect(isOperatorGcodeScriptAllowed('G1 X10 F3000')).toBe(true)
    expect(isOperatorGcodeScriptAllowed('SET_HEATER_TEMPERATURE HEATER=extruder TARGET=200')).toBe(true)
    expect(isOperatorGcodeScriptAllowed('M104 S200')).toBe(true)
  })

  it('allows SAVE_GCODE_STATE / RESTORE_GCODE_STATE', () => {
    expect(isOperatorGcodeScriptAllowed(`SAVE_GCODE_STATE NAME=_ui_movement
G1 X1
RESTORE_GCODE_STATE NAME=_ui_movement`)).toBe(true)
  })

  it('blocks calibration and mesh', () => {
    expect(isOperatorGcodeScriptAllowed('BED_MESH_CALIBRATE')).toBe(false)
    expect(isOperatorGcodeScriptAllowed('QUAD_GANTRY_LEVEL')).toBe(false)
    expect(isOperatorGcodeScriptAllowed('PID_CALIBRATE HEATER=extruder TARGET=200')).toBe(false)
  })

  it('blocks standalone G29', () => {
    expect(isOperatorGcodeScriptAllowed('G29')).toBe(false)
    expect(isOperatorGcodeScriptAllowed('G29 P1')).toBe(false)
  })

  it('does not block G290-style commands', () => {
    expect(isOperatorGcodeScriptAllowed('G290')).toBe(true)
  })
})

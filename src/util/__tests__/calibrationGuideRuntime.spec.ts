import { describe, expect, it } from 'vitest'
import type { CalibrationGuideStep } from '@/types/achievement'
import {
  calibrationCompletedStepCount,
  DEFAULT_CALIBRATION_GUIDE_CONFIG,
  getActiveCalibrationSteps,
  normalizeCalibrationStepsComplete
} from '@/util/calibrationGuideRuntime'

const steps: CalibrationGuideStep[] = [
  { key: 'a', title: 'A', summary: '', docUrl: 'u', triggerCommands: ['X'], suggestedCommands: { direct: [], bowden: [] } },
  { key: 'bed_screws', title: 'S', summary: '', docUrl: 'u', triggerCommands: ['Y'], suggestedCommands: { direct: [], bowden: [] } }
]

describe('calibrationGuideRuntime', () => {
  it('migrates legacy numeric step indices to keys', () => {
    expect(normalizeCalibrationStepsComplete([0, 2])).toEqual([
      'thermal_pid',
      'bed_mesh'
    ])
  })

  it('keeps string keys', () => {
    expect(normalizeCalibrationStepsComplete(['thermal_pid'])).toEqual(['thermal_pid'])
  })

  it('omits bed_screws when probe leveling', () => {
    const active = getActiveCalibrationSteps(steps, {
      ...DEFAULT_CALIBRATION_GUIDE_CONFIG,
      bedLeveling: 'probe'
    })
    expect(active.map(s => s.key)).toEqual(['a'])
  })

  it('includes bed_screws when using screws', () => {
    const active = getActiveCalibrationSteps(steps, {
      ...DEFAULT_CALIBRATION_GUIDE_CONFIG,
      bedLeveling: 'screws'
    })
    expect(active.map(s => s.key)).toEqual(['a', 'bed_screws'])
  })

  it('counts completed steps against active list only', () => {
    const { done, total } = calibrationCompletedStepCount(
      steps,
      { ...DEFAULT_CALIBRATION_GUIDE_CONFIG, bedLeveling: 'probe' },
      ['a']
    )
    expect(done).toBe(1)
    expect(total).toBe(1)
  })
})

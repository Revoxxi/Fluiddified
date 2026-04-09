import type {
  AchievementProgress,
  CalibrationGuideStep,
  CalibrationGuideUserConfig
} from '@/types/achievement'
import { CALIBRATION_GUIDE_ACHIEVEMENT_ID } from '@/components/widgets/achievements/calibrationGuideAchievement'
import type { AchievementsState } from '@/store/achievements/types'

/** Default options before first save (not written to DB until the user clicks Save). */
export const DEFAULT_CALIBRATION_GUIDE_CONFIG: CalibrationGuideUserConfig = {
  extruderMode: 'direct',
  bedLeveling: 'probe',
  nozzleSizeMm: 0.4
}

/** v1 guide: index in the full list → step key (used to migrate `number[]` progress). */
export const CALIBRATION_GUIDE_LEGACY_STEP_ORDER = [
  'thermal_pid',
  'bed_screws',
  'bed_mesh',
  'probe_z',
  'firmware_retraction',
  'pressure_advance',
  'input_shaper'
] as const

export function calibrationGuideConfigsEqual (
  a: CalibrationGuideUserConfig | undefined,
  b: CalibrationGuideUserConfig | undefined
): boolean {
  if (a == null || b == null) return false
  return (
    a.extruderMode === b.extruderMode &&
    a.bedLeveling === b.bedLeveling &&
    a.nozzleSizeMm === b.nozzleSizeMm
  )
}

export function stepAppliesToConfig (
  step: CalibrationGuideStep,
  config: CalibrationGuideUserConfig
): boolean {
  if (step.key === 'bed_screws') return config.bedLeveling === 'screws'
  return true
}

export function getActiveCalibrationSteps (
  steps: CalibrationGuideStep[],
  config: CalibrationGuideUserConfig
): CalibrationGuideStep[] {
  return steps.filter(s => stepAppliesToConfig(s, config))
}

export function normalizeCalibrationStepsComplete (raw: unknown): string[] {
  if (raw == null || !Array.isArray(raw) || raw.length === 0) return []
  if (typeof raw[0] === 'number') {
    return (raw as number[])
      .filter(i => typeof i === 'number' && i >= 0 && i < CALIBRATION_GUIDE_LEGACY_STEP_ORDER.length)
      .map(i => CALIBRATION_GUIDE_LEGACY_STEP_ORDER[i])
  }
  return (raw as unknown[]).filter((k): k is string => typeof k === 'string')
}

export function interpolateCalibrationLine (line: string, config: CalibrationGuideUserConfig): string {
  return line.replace(/\{NOZZLE\}/g, String(config.nozzleSizeMm))
}

function pressureAdvanceStart (config: CalibrationGuideUserConfig): number {
  const n = config.nozzleSizeMm
  if (config.extruderMode === 'bowden') {
    if (n <= 0.3) return 0.42
    if (n <= 0.45) return 0.55
    if (n <= 0.65) return 0.72
    return 0.88
  }
  if (n <= 0.3) return 0.025
  if (n <= 0.45) return 0.04
  if (n <= 0.65) return 0.055
  return 0.075
}

function firmwareRetractLengthDirect (config: CalibrationGuideUserConfig): string {
  const n = config.nozzleSizeMm
  if (n <= 0.3) return '0.35'
  if (n <= 0.45) return '0.45'
  if (n <= 0.65) return '0.55'
  return '0.65'
}

function buildFirmwareRetractionLines (config: CalibrationGuideUserConfig): string[] {
  if (config.extruderMode === 'bowden') {
    return ['SET_RETRACTION RETRACT_LENGTH=6.5 RETRACT_SPEED=45 UNRETRACT_SPEED=30']
  }
  const L = firmwareRetractLengthDirect(config)
  return [`SET_RETRACTION RETRACT_LENGTH=${L} RETRACT_SPEED=40 UNRETRACT_SPEED=20`]
}

function buildPressureAdvanceLines (config: CalibrationGuideUserConfig): string[] {
  const v = pressureAdvanceStart(config)
  const n = config.nozzleSizeMm
  const mode = config.extruderMode === 'bowden' ? 'Bowden' : 'Direct'
  return [
    `; ${mode} • ${String(n)}mm nozzle — validate with a tower`,
    `SET_PRESSURE_ADVANCE VALUE=${String(v)}`
  ]
}

export function getSuggestedLinesForStep (
  step: CalibrationGuideStep,
  config: CalibrationGuideUserConfig
): string[] {
  if (step.key === 'firmware_retraction') {
    return buildFirmwareRetractionLines(config)
  }
  if (step.key === 'pressure_advance') {
    return buildPressureAdvanceLines(config)
  }
  const pack =
    config.extruderMode === 'bowden' ? step.suggestedCommands.bowden : step.suggestedCommands.direct
  return pack.map(line => interpolateCalibrationLine(line, config))
}

export function getCalibrationStepTitle (
  step: CalibrationGuideStep,
  config: CalibrationGuideUserConfig
): string {
  if (step.key === 'bed_mesh' && config.bedLeveling === 'probe') {
    return 'Bed mesh (probe)'
  }
  return step.title
}

export function getCalibrationStepSummary (
  step: CalibrationGuideStep,
  config: CalibrationGuideUserConfig
): string {
  if (step.key === 'bed_mesh') {
    return config.bedLeveling === 'probe'
      ? 'Probe a mesh so the firmware compensates for shape and tilt. Verify Z offset after.'
      : 'Map the bed surface after mechanical leveling.'
  }
  if (step.key === 'probe_z' && config.bedLeveling === 'screws') {
    return 'Set or refine nozzle height relative to the probe or endstop after mechanical bed leveling.'
  }
  return step.summary
}

export function calibrationCompletedStepCount (
  steps: CalibrationGuideStep[],
  config: CalibrationGuideUserConfig,
  calibrationStepsComplete: string[] | number[] | undefined
): { done: number, total: number } {
  const active = getActiveCalibrationSteps(steps, config)
  const activeKeys = new Set(active.map(s => s.key))
  const keys = normalizeCalibrationStepsComplete(calibrationStepsComplete ?? [])
  const done = keys.filter(k => activeKeys.has(k)).length
  return { done, total: active.length }
}

export function migrateCalibrationAchievementProgress (
  progress: AchievementProgress | undefined
): AchievementProgress | undefined {
  if (!progress) return progress
  const next: AchievementProgress = { ...progress }
  next.calibrationStepsComplete = normalizeCalibrationStepsComplete(next.calibrationStepsComplete)

  if (next.calibrationGuideConfig == null) {
    next.calibrationGuideConfig = {
      extruderMode: next.calibrationExtruderMode ?? DEFAULT_CALIBRATION_GUIDE_CONFIG.extruderMode,
      bedLeveling: DEFAULT_CALIBRATION_GUIDE_CONFIG.bedLeveling,
      nozzleSizeMm: DEFAULT_CALIBRATION_GUIDE_CONFIG.nozzleSizeMm
    }
  }

  if (next.calibrationGuideConfigSaved == null) {
    const touched =
      next.calibrationExtruderMode != null ||
      (next.calibrationStepsComplete?.length ?? 0) > 0 ||
      next.unlockedAt != null
    next.calibrationGuideConfigSaved = touched
  }

  return next
}

export function migrateAchievementsDbPayload (
  payload: Partial<AchievementsState>
): Partial<AchievementsState> {
  if (!payload.progress) return payload
  const id = CALIBRATION_GUIDE_ACHIEVEMENT_ID
  const raw = payload.progress[id]
  if (!raw) return payload
  const migrated = migrateCalibrationAchievementProgress(raw)
  if (!migrated) return payload
  return {
    ...payload,
    progress: {
      ...payload.progress,
      [id]: migrated
    }
  }
}

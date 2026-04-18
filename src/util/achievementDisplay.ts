import type { AchievementDefinition, AchievementProgress } from '@/types/achievement'
import {
  calibrationCompletedStepCount,
  DEFAULT_CALIBRATION_GUIDE_CONFIG
} from '@/util/calibrationGuideRuntime'

/** Next tier threshold, or last tier when all are unlocked. */
export function getAchievementNextTarget (def: AchievementDefinition, progress?: AchievementProgress): number {
  if (!def.tiers?.length) return 0
  const reached = progress?.tierReached ?? 0
  if (reached >= def.tiers.length) {
    return def.tiers[def.tiers.length - 1]
  }
  return def.tiers[reached]
}

/**
 * Substitutes placeholder N / N% in tiered achievement descriptions with the next target.
 * Uses word-boundary matching for `N` so words like `SAVE_CONFIG` are not corrupted.
 */
/**
 * Text for unlock toasts / announcements: substitutes the milestone just reached (tier threshold)
 * so "N" / "N%" are never shown literally. Prefer `unlockMessage` when defined.
 */
export function formatAchievementAnnouncement (
  def: AchievementDefinition,
  progress?: AchievementProgress
): string {
  if (def.unlockMessage) return def.unlockMessage
  if (def.calibrationGuide) {
    return formatAchievementDescription(def, progress)
  }
  if (def.tiers?.length && progress && progress.tierReached > 0) {
    const thr = def.tiers[progress.tierReached - 1]
    return def.description
      .replace(/N%/g, `${thr}%`)
      .replace(/\bN\b/g, String(thr))
  }
  return def.description
}

export function formatAchievementDescription (def: AchievementDefinition, progress?: AchievementProgress): string {
  if (def.calibrationGuide) {
    if (progress?.unlockedAt != null) return def.description
    if (progress?.calibrationGuideConfigSaved !== true) {
      return `${def.description} — save your printer setup to start`
    }
    const cfg = progress.calibrationGuideConfig ?? DEFAULT_CALIBRATION_GUIDE_CONFIG
    const { done, total } = calibrationCompletedStepCount(
      def.calibrationGuide.steps,
      cfg,
      progress.calibrationStepsComplete
    )
    return `${def.description} — ${done}/${total} steps`
  }
  if (!def.tiers?.length) return def.description
  const t = getAchievementNextTarget(def, progress)
  const formatted = def.description.replace(/N%/g, `${t}%`)
  // Standalone placeholder "N" only (not letters inside words like CONFIG, SAVE_, etc.)
  return formatted.replace(/\bN\b/g, String(t))
}

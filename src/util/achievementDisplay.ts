import type { AchievementDefinition, AchievementProgress } from '@/types/achievement'

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
 */
export function formatAchievementDescription (def: AchievementDefinition, progress?: AchievementProgress): string {
  if (!def.tiers?.length) return def.description
  const t = getAchievementNextTarget(def, progress)
  return def.description
    .replace(/N%/g, `${t}%`)
    .replace(/N/g, String(t))
}

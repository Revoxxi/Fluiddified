import type { AchievementCategory, AchievementDefinition, AchievementRarity } from '@/types/achievement'

const RARITY_ORDER: Record<AchievementRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4
}

export function compareAchievementRarity (a: AchievementRarity, b: AchievementRarity): number {
  return RARITY_ORDER[a] - RARITY_ORDER[b]
}

/** Common first, legendary last. */
export function sortAchievementsByRarity (defs: AchievementDefinition[]): AchievementDefinition[] {
  return [...defs].sort((x, y) => compareAchievementRarity(x.rarity, y.rarity))
}

/** Pinned (`pinToTop`) entries first, then by rarity. */
export function sortAchievementsByPinThenRarity (defs: AchievementDefinition[]): AchievementDefinition[] {
  const pinned = defs.filter(d => d.pinToTop)
  const rest = defs.filter(d => !d.pinToTop)
  return [...sortAchievementsByRarity(pinned), ...sortAchievementsByRarity(rest)]
}

/**
 * Dashboard list order:
 * - **All**: non-hidden (rarity ascending), then hidden (rarity ascending).
 * - **Category tab**: that category only, rarity ascending.
 */
export function orderAchievementsForList (
  defs: AchievementDefinition[],
  category: AchievementCategory | null
): AchievementDefinition[] {
  if (category != null) {
    return sortAchievementsByPinThenRarity(defs.filter(d => d.category === category))
  }
  const nonHidden = defs.filter(d => !d.hidden)
  const hidden = defs.filter(d => d.hidden)
  return [
    ...sortAchievementsByPinThenRarity(nonHidden),
    ...sortAchievementsByPinThenRarity(hidden)
  ]
}

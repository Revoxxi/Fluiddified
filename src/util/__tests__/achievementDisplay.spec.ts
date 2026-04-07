import { describe, expect, it } from 'vitest'
import type { AchievementDefinition, AchievementProgress } from '@/types/achievement'
import { formatAchievementDescription, getAchievementNextTarget } from '@/util/achievementDisplay'

const tieredDef: AchievementDefinition = {
  id: 'prints_completed',
  name: 'Print Counter',
  description: 'Complete N successful prints',
  icon: '$trophy',
  category: 'volume',
  rarity: 'common',
  points: 10,
  tiers: [1, 10, 50, 100, 250, 500, 1000]
}

const rateDef: AchievementDefinition = {
  id: 'success_rate',
  name: 'Quality Control',
  description: 'Maintain N% success rate over 50+ prints',
  icon: '$star',
  category: 'consistency',
  rarity: 'rare',
  points: 50,
  tiers: [80, 85, 90, 95, 99],
  unit: '%'
}

describe('achievementDisplay', () => {
  it('substitutes next tier for N', () => {
    const p: AchievementProgress = { current: 0, tierReached: 0 }
    expect(getAchievementNextTarget(tieredDef, p)).toBe(1)
    expect(formatAchievementDescription(tieredDef, p)).toBe('Complete 1 successful prints')

    const p2: AchievementProgress = { current: 5, tierReached: 1 }
    expect(getAchievementNextTarget(tieredDef, p2)).toBe(10)
    expect(formatAchievementDescription(tieredDef, p2)).toBe('Complete 10 successful prints')
  })

  it('uses last tier when all unlocked', () => {
    const p: AchievementProgress = { current: 2000, tierReached: 7 }
    expect(getAchievementNextTarget(tieredDef, p)).toBe(1000)
    expect(formatAchievementDescription(tieredDef, p)).toBe('Complete 1000 successful prints')
  })

  it('substitutes N% before bare N', () => {
    const p: AchievementProgress = { current: 0, tierReached: 0 }
    expect(formatAchievementDescription(rateDef, p)).toBe('Maintain 80% success rate over 50+ prints')
  })
})

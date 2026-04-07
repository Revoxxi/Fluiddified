import { describe, expect, it } from 'vitest'
import { orderAchievementsForList, sortAchievementsByRarity } from '@/util/achievementSort'
import type { AchievementDefinition } from '@/types/achievement'

function def (
  partial: Pick<AchievementDefinition, 'id' | 'category' | 'rarity' | 'hidden'> &
    Partial<Pick<AchievementDefinition, 'pinToTop'>>
): AchievementDefinition {
  return {
    id: partial.id,
    name: partial.id,
    description: '',
    category: partial.category,
    rarity: partial.rarity,
    hidden: partial.hidden,
    pinToTop: partial.pinToTop,
    icon: 'i',
    points: 1
  }
}

describe('achievementSort', () => {
  it('sortAchievementsByRarity orders common → legendary', () => {
    const sorted = sortAchievementsByRarity([
      def({ id: 'a', category: 'volume', rarity: 'legendary' }),
      def({ id: 'b', category: 'volume', rarity: 'common' }),
      def({ id: 'c', category: 'volume', rarity: 'rare' })
    ])
    expect(sorted.map(d => d.id)).toEqual(['b', 'c', 'a'])
  })

  it('orderAchievementsForList All puts non-hidden before hidden; rarity within each', () => {
    const out = orderAchievementsForList(
      [
        def({ id: 'h-leg', category: 'hidden', rarity: 'legendary', hidden: true }),
        def({ id: 'v-com', category: 'volume', rarity: 'common' }),
        def({ id: 'h-com', category: 'hidden', rarity: 'common', hidden: true }),
        def({ id: 'v-ep', category: 'volume', rarity: 'epic' })
      ],
      null
    )
    expect(out.map(d => d.id)).toEqual(['v-com', 'v-ep', 'h-com', 'h-leg'])
  })

  it('orderAchievementsForList with category filters and sorts by rarity', () => {
    const out = orderAchievementsForList(
      [
        def({ id: 'x', category: 'volume', rarity: 'legendary' }),
        def({ id: 'y', category: 'volume', rarity: 'uncommon' }),
        def({ id: 'z', category: 'exploration', rarity: 'common' })
      ],
      'volume'
    )
    expect(out.map(d => d.id)).toEqual(['y', 'x'])
  })

  it('pinToTop entries appear before others, each group by rarity', () => {
    const out = orderAchievementsForList(
      [
        def({ id: 'plain-com', category: 'klipper', rarity: 'common' }),
        def({ id: 'pin-leg', category: 'klipper', rarity: 'legendary', pinToTop: true }),
        def({ id: 'pin-com', category: 'klipper', rarity: 'common', pinToTop: true }),
        def({ id: 'plain-unc', category: 'klipper', rarity: 'uncommon' })
      ],
      'klipper'
    )
    expect(out.map(d => d.id)).toEqual(['pin-com', 'pin-leg', 'plain-com', 'plain-unc'])
  })
})

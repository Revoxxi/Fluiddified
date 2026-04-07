import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'achievements-card',
  name: 'Achievements',
  version: '1.0.0',
  icon: '$trophy',
  component: () => import('./AchievementsCard.vue'),
  defaultEnabled: true,
  defaultContainer: 2,
  defaultPosition: 10,
  minRole: 'guest',
  tags: ['gamification', 'stats']
}

export default manifest

import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'console-card',
  name: 'Console',
  version: '1.0.0',
  component: () => import('./ConsoleCard.vue'),
  defaultEnabled: true,
  defaultContainer: 2,
  defaultPosition: 2,
  minRole: 'owner',
  tags: ['console', 'monitoring']
}

export default manifest

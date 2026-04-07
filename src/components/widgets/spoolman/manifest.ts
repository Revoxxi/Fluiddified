import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'spoolman-card',
  name: 'Spoolman',
  version: '1.0.0',
  component: () => import('./SpoolmanCard.vue'),
  defaultContainer: 1,
  defaultPosition: 1,
  isAvailable: (store) => store.getters['server/componentSupport']('spoolman'),
  minRole: 'guest',
  tags: ['spoolman', 'filament']
}

export default manifest

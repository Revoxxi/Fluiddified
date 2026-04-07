import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'toolhead-card',
  name: 'Toolhead',
  version: '1.0.0',
  component: () => import('./ToolheadCard.vue'),
  defaultEnabled: true,
  defaultContainer: 1,
  defaultPosition: 4,
  minRole: 'user',
  tags: ['control', 'toolhead']
}

export default manifest

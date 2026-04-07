import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'afc-card',
  name: 'AFC',
  version: '1.0.0',
  component: () => import('./AfcCard.vue'),
  defaultContainer: 2,
  defaultPosition: 8,
  isAvailable: (store) => store.getters['printer/getSupportsAfc'],
  minRole: 'guest',
  tags: ['afc', 'multi-material']
}

export default manifest

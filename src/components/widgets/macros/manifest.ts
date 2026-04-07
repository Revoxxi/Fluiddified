import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'macros-card',
  name: 'Macros',
  version: '1.0.0',
  component: () => import('./MacrosCard.vue'),
  defaultEnabled: true,
  defaultContainer: 1,
  defaultPosition: 5,
  isAvailable: (store) => store.getters['macros/getVisibleMacros'].length > 0,
  minRole: 'user',
  tags: ['control', 'macros']
}

export default manifest

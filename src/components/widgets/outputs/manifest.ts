import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'outputs-card',
  name: 'Outputs',
  version: '1.0.0',
  component: () => import('./OutputsCard.vue'),
  defaultEnabled: true,
  defaultContainer: 1,
  defaultPosition: 6,
  isAvailable: (store) =>
    store.getters['printer/getAllFans'].length > 0 ||
    store.getters['printer/getAllPins'].length > 0 ||
    store.getters['printer/getAllLeds'].length > 0,
  minRole: 'guest',
  tags: ['outputs', 'control']
}

export default manifest

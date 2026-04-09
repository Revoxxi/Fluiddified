import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'beacon-card',
  name: 'Beacon',
  version: '1.0.0',
  component: () => import('./BeaconCard.vue'),
  defaultEnabled: false,
  defaultContainer: 2,
  defaultPosition: 7,
  isAvailable: (store) => store.getters['printer/getSupportsBeacon'],
  minRole: 'user',
  tags: ['beacon', 'probe']
}

export default manifest

import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'sensors-card',
  name: 'Sensors',
  version: '1.0.0',
  component: () => import('./SensorsCard.vue'),
  defaultContainer: 2,
  defaultPosition: 1,
  isAvailable: (store) => store.getters['sensors/getSensors'].length > 0,
  minRole: 'guest',
  tags: ['sensors', 'monitoring']
}

export default manifest

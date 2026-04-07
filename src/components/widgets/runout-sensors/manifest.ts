import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'runout-sensors-card',
  name: 'Runout Sensors',
  version: '1.0.0',
  component: () => import('./RunoutSensorsCard.vue'),
  defaultEnabled: false,
  defaultContainer: 1,
  defaultPosition: 7,
  isAvailable: (store) => store.getters['printer/getRunoutSensors'].length > 0,
  minRole: 'guest',
  tags: ['sensors', 'filament']
}

export default manifest

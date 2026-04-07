import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'temperature-card',
  name: 'Thermals',
  version: '1.0.0',
  component: () => import('./TemperatureCard.vue'),
  defaultEnabled: true,
  defaultContainer: 2,
  defaultPosition: 0,
  isAvailable: (store) =>
    store.getters['printer/getHeaters'].length > 0 ||
    store.getters['printer/getOutputs'](['temperature_fan']).length > 0 ||
    store.getters['printer/getSensors'].length > 0,
  minRole: 'guest',
  tags: ['thermal', 'monitoring']
}

export default manifest

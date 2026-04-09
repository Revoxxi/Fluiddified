import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'retract-card',
  name: 'Retraction',
  version: '1.0.0',
  component: () => import('./RetractCard.vue'),
  defaultEnabled: true,
  defaultContainer: 1,
  defaultPosition: 9,
  isAvailable: (store) => 'firmware_retraction' in store.getters['printer/getPrinterSettings'],
  minRole: 'user',
  tags: ['retract', 'control']
}

export default manifest

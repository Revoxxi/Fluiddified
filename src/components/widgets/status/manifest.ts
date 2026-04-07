import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'printer-status-card',
  name: 'Printer Status',
  version: '1.0.0',
  component: () => import('./PrinterStatusCard.vue'),
  defaultEnabled: true,
  defaultContainer: 1,
  defaultPosition: 0,
  isAvailable: (store) => store.getters['printer/getKlippyReady'],
  minRole: 'guest',
  tags: ['status', 'monitoring']
}

export default manifest

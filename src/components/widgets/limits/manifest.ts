import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'printer-limits-card',
  name: 'Printer Limits',
  version: '1.0.0',
  component: () => import('./PrinterLimitsCard.vue'),
  defaultEnabled: true,
  defaultContainer: 1,
  defaultPosition: 8,
  minRole: 'guest',
  tags: ['limits', 'monitoring']
}

export default manifest

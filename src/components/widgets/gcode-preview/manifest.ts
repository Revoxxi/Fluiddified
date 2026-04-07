import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'gcode-preview-card',
  name: 'G-code Preview',
  version: '1.0.0',
  component: () => import('./GcodePreviewCard.vue'),
  defaultContainer: 2,
  defaultPosition: 5,
  minRole: 'guest',
  tags: ['preview', 'monitoring']
}

export default manifest

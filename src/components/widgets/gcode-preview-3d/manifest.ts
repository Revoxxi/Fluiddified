import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'gcode-preview-3d-card',
  name: 'G-code Preview (3D)',
  version: '1.0.0',
  component: () => import('./GcodePreview3dCard.vue'),
  defaultContainer: 2,
  defaultPosition: 6,
  minRole: 'guest',
  icon: '$printer3d',
  tags: ['preview', 'monitoring', '3d']
}

export default manifest

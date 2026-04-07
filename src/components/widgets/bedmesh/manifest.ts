import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'bed-mesh-card',
  name: 'Bed Mesh',
  version: '1.0.0',
  component: () => import('./BedMeshCard.vue'),
  defaultEnabled: false,
  defaultContainer: 2,
  defaultPosition: 6,
  isAvailable: (store) => store.getters['mesh/getSupportsBedMesh'],
  minRole: 'guest',
  tags: ['mesh', 'monitoring']
}

export default manifest

import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'camera-card',
  name: 'Camera',
  version: '1.0.0',
  component: () => import('./CameraCard.vue'),
  defaultEnabled: true,
  defaultContainer: 1,
  defaultPosition: 3,
  isAvailable: (store) => store.getters['webcams/getEnabledWebcams'].length > 0,
  minRole: 'guest',
  tags: ['camera', 'monitoring']
}

export default manifest

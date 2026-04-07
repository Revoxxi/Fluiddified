import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'jobs-card',
  name: 'Jobs',
  version: '1.0.0',
  component: () => import('./JobsCard.vue'),
  defaultEnabled: true,
  defaultContainer: 2,
  defaultPosition: 3,
  minRole: 'guest',
  tags: ['files', 'monitoring']
}

export default manifest

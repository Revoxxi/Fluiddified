import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'job-queue-card',
  name: 'Job Queue',
  version: '1.0.0',
  component: () => import('./JobQueueCard.vue'),
  defaultEnabled: false,
  defaultContainer: 2,
  defaultPosition: 4,
  isAvailable: (store) => store.getters['server/componentSupport']('job_queue'),
  minRole: 'guest',
  tags: ['queue', 'jobs']
}

export default manifest

import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'mmu-card',
  name: 'MMU',
  version: '1.0.0',
  component: () => import('./MmuCard.vue'),
  defaultContainer: 1,
  defaultPosition: 2,
  isAvailable: (store) => store.state.printer.printer.mmu != null,
  minRole: 'guest',
  tags: ['mmu', 'multi-material']
}

export default manifest

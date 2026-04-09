import type { PluginManifest } from '@/types/plugin'

const manifest: PluginManifest = {
  id: 'toolhead-card',
  name: 'Toolhead',
  version: '1.0.0',
  component: () => import('./ToolheadCard.vue'),
  defaultEnabled: true,
  defaultContainer: 1,
  defaultPosition: 4,
  /**
   * Always eligible on the dashboard; `ToolheadCard` / `Toolhead` use `guestMode`
   * (RBAC) so spectators see the card but cannot control it — do not raise `minRole`
   * or the entire card is hidden for users still mapped as Fluidd `guest`.
   */
  minRole: 'guest',
  tags: ['control', 'toolhead']
}

export default manifest

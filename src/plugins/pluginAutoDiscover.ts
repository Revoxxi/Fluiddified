import type { PluginManifest } from '@/types/plugin'
import { pluginRegistry } from './pluginRegistry'

const manifests = import.meta.glob<{ default: PluginManifest }>(
  '@/components/widgets/*/manifest.ts',
  { eager: true }
)

export function autoDiscoverPlugins (): void {
  for (const [path, mod] of Object.entries(manifests)) {
    try {
      pluginRegistry.register(mod.default)
    } catch (e) {
      console.warn(`[pluginAutoDiscover] Failed to register ${path}:`, e)
    }
  }
}

import type { PluginManifest } from '@/types/plugin'
import type { LayoutConfig } from '@/store/layout/types'

class PluginRegistry {
  private plugins: Map<string, PluginManifest> = new Map()
  private componentCache: Map<string, any> = new Map()

  register (manifest: PluginManifest): void {
    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin "${manifest.id}" is already registered`)
    }
    this.plugins.set(manifest.id, manifest)
  }

  unregister (id: string): void {
    this.plugins.delete(id)
    this.componentCache.delete(id)
  }

  getAll (): PluginManifest[] {
    return Array.from(this.plugins.values())
  }

  getById (id: string): PluginManifest | undefined {
    return this.plugins.get(id)
  }

  async loadComponent (id: string): Promise<any> {
    if (this.componentCache.has(id)) {
      return this.componentCache.get(id)
    }

    const manifest = this.plugins.get(id)
    if (!manifest) {
      throw new Error(`Plugin "${id}" not found`)
    }

    const mod = await manifest.component()
    this.componentCache.set(id, mod.default)
    return mod.default
  }

  /**
   * Returns a record of component id -> async component factory
   * suitable for passing to Vue's `components` registration.
   */
  getComponentMap (): Record<string, () => Promise<any>> {
    const map: Record<string, () => Promise<any>> = {}
    for (const manifest of this.plugins.values()) {
      map[manifest.id] = async () => {
        const mod = await manifest.component()
        return mod.default
      }
    }
    return map
  }

  getDefaultLayout (): Record<string, LayoutConfig[]> {
    const containers: Record<string, LayoutConfig[]> = {
      container1: [],
      container2: [],
      container3: [],
      container4: []
    }

    for (const manifest of this.plugins.values()) {
      const containerKey = `container${manifest.defaultContainer ?? 2}`
      const config: LayoutConfig = {
        id: manifest.id,
        enabled: manifest.defaultEnabled !== false,
        collapsed: manifest.defaultCollapsed ?? false
      }
      containers[containerKey].push(config)
    }

    // Sort each container by defaultPosition
    for (const key of Object.keys(containers)) {
      containers[key].sort((a, b) => {
        const posA = this.plugins.get(a.id)?.defaultPosition ?? 999
        const posB = this.plugins.get(b.id)?.defaultPosition ?? 999
        return posA - posB
      })
    }

    return containers
  }

  isAvailable (id: string, store: any): boolean {
    const manifest = this.plugins.get(id)
    if (!manifest) return false

    if (manifest.minRole && !store.getters['auth/hasMinRole'](manifest.minRole)) {
      return false
    }

    if (!manifest.isAvailable) return true
    return manifest.isAvailable(store)
  }
}

export const pluginRegistry = new PluginRegistry()

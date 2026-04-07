import type { Module } from 'vuex'
import type { RootState } from '@/store/types'

export interface PluginManifest {
  /** Unique kebab-case id, matches the <component :is=""> tag */
  id: string

  /** Human-readable name for settings UI */
  name: string

  /** Brief description */
  description?: string

  /** Semantic version */
  version: string

  /** Icon key from globals.Icons or raw MDI path */
  icon?: string

  /**
   * Dynamic component loader.
   * Must return a Vue component (default export of a .vue file).
   */
  component: () => Promise<{ default: any }>

  /** Default enabled state */
  defaultEnabled?: boolean

  /** Default collapsed state */
  defaultCollapsed?: boolean

  /** Default container placement (1-4) */
  defaultContainer?: 1 | 2 | 3 | 4

  /** Default position in the container (0-based) */
  defaultPosition?: number

  /**
   * Visibility check — called reactively.
   * Return `true` to show, `false` to hide (when hardware/feature not present).
   * Receives the Vuex store for state checks.
   */
  isAvailable?: (store: any) => boolean

  /**
   * Optional Vuex store module to register dynamically.
   */
  storeModule?: {
    name: string
    module: Module<any, RootState>
  }

  /**
   * Minimum required auth role to see this widget.
   * Ties into IMP-02 (auth/RBAC).
   */
  minRole?: 'guest' | 'user' | 'owner'

  /** Optional settings component for the Settings page */
  settingsComponent?: () => Promise<{ default: any }>

  /** Tags for categorization in plugin manager UI */
  tags?: string[]
}

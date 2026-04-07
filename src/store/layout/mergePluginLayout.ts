import { cloneDeep } from 'lodash-es'
import { defaultState as getDefaultState } from './state'
import { pluginRegistry } from '@/plugins/pluginRegistry'
import type { LayoutContainer, LayoutState } from './types'

/**
 * Appends cards from the plugin registry that are not already in the static
 * default dashboard, then sorts each container by manifest defaultPosition.
 */
export const DASHBOARD_CONTAINER_KEYS = ['container1', 'container2', 'container3', 'container4'] as const

export function mergePluginCardsIntoDashboard (dashboard: LayoutContainer): LayoutContainer {
  const base = cloneDeep(dashboard)
  for (const key of DASHBOARD_CONTAINER_KEYS) {
    if (!Array.isArray(base[key])) {
      base[key] = []
    }
  }
  const pluginLayout = pluginRegistry.getDefaultLayout()
  const existingIds = new Set(
    DASHBOARD_CONTAINER_KEYS.flatMap(k => base[k]).map(c => c.id)
  )

  for (const key of DASHBOARD_CONTAINER_KEYS) {
    const toAdd = (pluginLayout[key] ?? []).filter(p => !existingIds.has(p.id))
    base[key].push(...toAdd)
    for (const t of toAdd) {
      existingIds.add(t.id)
    }
  }

  for (const key of DASHBOARD_CONTAINER_KEYS) {
    base[key].sort((a, b) => {
      const posA = pluginRegistry.getById(a.id)?.defaultPosition ?? 999
      const posB = pluginRegistry.getById(b.id)?.defaultPosition ?? 999
      return posA - posB
    })
  }

  return base
}

export function removePluginFromDashboardLayout (
  dashboard: LayoutContainer,
  pluginId: string
): LayoutContainer {
  const base = cloneDeep(dashboard)
  for (const key of DASHBOARD_CONTAINER_KEYS) {
    if (!Array.isArray(base[key])) {
      base[key] = []
    }
    base[key] = base[key].filter(c => c.id !== pluginId)
  }
  return base
}

/** Default layout state including any widget plugins not listed in static defaults. */
export function getDefaultLayoutStateForInit (): LayoutState {
  const s = cloneDeep(getDefaultState())
  s.layouts.dashboard = mergePluginCardsIntoDashboard(s.layouts.dashboard)
  return s
}

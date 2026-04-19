import { cloneDeep } from 'lodash-es'
import { defaultState as getDefaultState } from './state'
import { pluginRegistry } from '@/plugins/pluginRegistry'
import type { LayoutConfig, LayoutContainer, LayoutState } from './types'

/**
 * Appends cards from the plugin registry that are not already in the saved layout.
 * Only **newly added** cards are ordered by manifest defaultPosition; existing order is kept.
 */
export const DASHBOARD_CONTAINER_KEYS = ['container1', 'container2', 'container3', 'container4'] as const

/** Drop null/undefined and invalid entries (e.g. sparse arrays from bad saves). */
export function sanitizeLayoutContainerValue (value: LayoutContainer): LayoutContainer {
  const out: LayoutContainer = { ...value }
  for (const key of Object.keys(out)) {
    const arr = out[key]
    if (!Array.isArray(arr)) {
      out[key] = []
      continue
    }
    out[key] = arr.filter(
      (c): c is LayoutConfig =>
        c != null && typeof c === 'object' && typeof c.id === 'string'
    )
  }
  return out
}

export function mergePluginCardsIntoDashboard (dashboard: LayoutContainer): LayoutContainer {
  const base = sanitizeLayoutContainerValue(cloneDeep(dashboard))
  for (const key of DASHBOARD_CONTAINER_KEYS) {
    if (!Array.isArray(base[key])) {
      base[key] = []
    }
  }
  const pluginLayout = pluginRegistry.getDefaultLayout()
  const existingIds = new Set(
    DASHBOARD_CONTAINER_KEYS.flatMap(k => base[k] ?? []).map(c => c.id)
  )

  for (const key of DASHBOARD_CONTAINER_KEYS) {
    const toAdd = (pluginLayout[key] ?? []).filter(p => !existingIds.has(p.id))
    insertNewPluginCardsByDefaultPosition(base[key], toAdd)
    for (const t of toAdd) {
      existingIds.add(t.id)
    }
  }

  return base
}

/**
 * Places only **new** registry cards using manifest order, without re-sorting cards the user
 * already has in their saved layout (avoids resetting drag order on every merge / layout watch).
 */
function insertNewPluginCardsByDefaultPosition (container: LayoutConfig[], toAdd: LayoutConfig[]): void {
  if (toAdd.length === 0) return

  const sortedNew = [...toAdd].sort((a, b) => {
    const posA = pluginRegistry.getById(a.id)?.defaultPosition ?? 999
    const posB = pluginRegistry.getById(b.id)?.defaultPosition ?? 999
    return posA - posB
  })

  for (const card of sortedNew) {
    const pos = pluginRegistry.getById(card.id)?.defaultPosition ?? 999
    let insertAt = container.length
    for (let i = 0; i < container.length; i++) {
      const existingPos = pluginRegistry.getById(container[i].id)?.defaultPosition ?? 999
      if (pos < existingPos) {
        insertAt = i
        break
      }
    }
    container.splice(insertAt, 0, card)
  }
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

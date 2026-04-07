import type { PluginsState } from './types'

export const defaultState = (): PluginsState => {
  return {
    registered: [],
    disabled: [],
    loadErrors: {}
  }
}

export const state = defaultState()

export interface PluginsState {
  registered: string[]
  disabled: string[]
  loadErrors: Record<string, string>
}

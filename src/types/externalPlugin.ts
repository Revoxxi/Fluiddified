export interface FluiddPluginsIndex {
  plugins: Array<{ manifestUrl: string }>
}

export interface ExternalPluginManifestJson {
  id: string
  name: string
  version: string
  description?: string
  icon?: string
  componentUrl: string
  defaultEnabled?: boolean
  defaultCollapsed?: boolean
  defaultContainer?: 1 | 2 | 3 | 4
  defaultPosition?: number
  minRole?: 'guest' | 'user' | 'owner'
  tags?: string[]
}

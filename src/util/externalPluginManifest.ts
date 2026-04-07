import type { PluginManifest } from '@/types/plugin'
import type { ExternalPluginManifestJson } from '@/types/externalPlugin'

export function buildPluginManifestFromExternalJson (
  json: ExternalPluginManifestJson,
  componentUrlHref: string,
  extraTags: string[] = []
): PluginManifest {
  const tagSet = new Set<string>([...(json.tags ?? []), ...extraTags])
  return {
    id: json.id,
    name: json.name,
    version: json.version,
    description: json.description,
    icon: json.icon,
    component: () => import(/* @vite-ignore */ componentUrlHref) as Promise<{ default: any }>,
    defaultEnabled: json.defaultEnabled,
    defaultCollapsed: json.defaultCollapsed,
    defaultContainer: json.defaultContainer,
    defaultPosition: json.defaultPosition,
    minRole: json.minRole,
    tags: [...tagSet]
  }
}

import { consola } from 'consola'
import type { ExternalPluginManifestJson, FluiddPluginsIndex } from '@/types/externalPlugin'
import { getRemovedExternalPluginIds } from '@/util/userPluginPersistence'
import { buildPluginManifestFromExternalJson } from '@/util/externalPluginManifest'
import { pluginRegistry } from './pluginRegistry'

export async function loadExternalPlugins (): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}fluidd-plugins.json`)
    if (!res.ok) return

    const index = await res.json() as FluiddPluginsIndex

    for (const entry of index.plugins ?? []) {
      try {
        await registerExternalPlugin(entry.manifestUrl)
      } catch (e) {
        consola.warn('[loadExternalPlugins] Failed:', entry.manifestUrl, e)
      }
    }
  } catch {
    // Optional file — ignore when missing or invalid
  }
}

async function registerExternalPlugin (manifestUrl: string): Promise<void> {
  const resolvedManifestUrl = new URL(manifestUrl, window.location.href).href
  const r = await fetch(resolvedManifestUrl)
  if (!r.ok) {
    throw new Error(`HTTP ${r.status}`)
  }

  const json = await r.json() as ExternalPluginManifestJson

  if (getRemovedExternalPluginIds().has(json.id)) {
    return
  }

  const dir = resolvedManifestUrl.replace(/[^/]+$/, '')
  const componentUrl = /^https?:\/\//i.test(json.componentUrl)
    ? json.componentUrl
    : new URL(json.componentUrl, dir).href

  const manifest = buildPluginManifestFromExternalJson(json, componentUrl, [])

  pluginRegistry.register(manifest)
}

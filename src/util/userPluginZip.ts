import { unzip } from 'fflate'
import { consola } from 'consola'
import type { ExternalPluginManifestJson } from '@/types/externalPlugin'
import { pluginRegistry } from '@/plugins/pluginRegistry'
import { buildPluginManifestFromExternalJson } from '@/util/externalPluginManifest'
import { isNativeBundledPlugin } from '@/util/nativePluginPolicy'
import {
  readUserPluginState,
  upsertUserZip,
  type UserZipStored
} from '@/util/userPluginPersistence'

const MAX_SCRIPT_BYTES = 4 * 1024 * 1024

const blobUrlByPluginId = new Map<string, string>()

function bytesToBase64 (bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i])
  }
  return btoa(bin)
}

function base64ToBytes (b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i)
  }
  return out
}

function normalizeZipPaths (files: Record<string, Uint8Array>): Record<string, Uint8Array> {
  const norm: Record<string, Uint8Array> = {}
  for (const [k, v] of Object.entries(files)) {
    norm[k.replace(/\\/g, '/')] = v
  }
  return norm
}

/** Keys must already use `/` separators. */
function findManifestInZip (norm: Record<string, Uint8Array>): { base: string, manifestKey: string } | null {
  if (norm['manifest.json']) {
    return { base: '', manifestKey: 'manifest.json' }
  }
  const candidates = Object.keys(norm).filter(k => /(?:^|\/)manifest\.json$/.test(k))
  if (candidates.length !== 1) {
    return null
  }
  const mk = candidates[0]
  const base = mk.includes('/') ? mk.slice(0, mk.lastIndexOf('/') + 1) : ''
  return { base, manifestKey: mk }
}

function validateId (id: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) && id.endsWith('-card')
}

export function revokeUserPluginBlob (id: string): void {
  const u = blobUrlByPluginId.get(id)
  if (u) {
    URL.revokeObjectURL(u)
  }
  blobUrlByPluginId.delete(id)
}

export async function installUserPluginFromZipFile (
  file: File
): Promise<{ ok: true, id: string } | { ok: false, error: string }> {
  const buf = new Uint8Array(await file.arrayBuffer())
  const raw = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(buf, (err, data) => (err != null ? reject(err) : resolve(data)))
  })
  const files = normalizeZipPaths(raw)

  const found = findManifestInZip(files)
  if (!found) {
    return { ok: false, error: 'manifest.json not found (use one manifest at ZIP root or in a single folder).' }
  }

  let json: ExternalPluginManifestJson
  try {
    const text = new TextDecoder().decode(files[found.manifestKey])
    json = JSON.parse(text) as ExternalPluginManifestJson
  } catch {
    return { ok: false, error: 'Invalid manifest.json' }
  }

  if (!json.id || !json.name || !json.version || !json.componentUrl) {
    return { ok: false, error: 'Manifest must include id, name, version, and componentUrl.' }
  }

  if (!validateId(json.id)) {
    return { ok: false, error: 'Plugin id must be kebab-case and end with "-card".' }
  }

  if (isNativeBundledPlugin(json.id)) {
    return { ok: false, error: 'This id is reserved for a built-in widget.' }
  }

  if (pluginRegistry.getById(json.id)) {
    return { ok: false, error: 'A plugin with this id is already registered.' }
  }

  const relPath = json.componentUrl.replace(/\\/g, '/').replace(/^\//, '')
  const scriptKey = `${found.base}${relPath}`
  if (!files[scriptKey]) {
    return { ok: false, error: `Bundle not found in ZIP: ${relPath}` }
  }

  const scriptBytes = files[scriptKey]
  if (scriptBytes.byteLength > MAX_SCRIPT_BYTES) {
    return { ok: false, error: 'Bundle exceeds maximum size (4 MiB).' }
  }

  const blob = new Blob([Uint8Array.from(scriptBytes)], { type: 'text/javascript' })
  const blobUrl = URL.createObjectURL(blob)

  const manifest = buildPluginManifestFromExternalJson(json, blobUrl, ['user-zip'])

  try {
    pluginRegistry.register(manifest)
  } catch (e) {
    URL.revokeObjectURL(blobUrl)
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }

  blobUrlByPluginId.set(json.id, blobUrl)

  const stored: UserZipStored = {
    id: json.id,
    name: json.name,
    version: json.version,
    description: json.description,
    icon: json.icon,
    defaultEnabled: json.defaultEnabled,
    defaultCollapsed: json.defaultCollapsed,
    defaultContainer: json.defaultContainer,
    defaultPosition: json.defaultPosition,
    minRole: json.minRole,
    tags: json.tags,
    scriptBase64: bytesToBase64(scriptBytes)
  }
  upsertUserZip(stored)

  return { ok: true, id: json.id }
}

export function rehydrateUserZipPlugins (): void {
  for (const z of readUserPluginState().userZips) {
    if (pluginRegistry.getById(z.id)) {
      continue
    }
    try {
      const scriptBytes = base64ToBytes(z.scriptBase64)
      const blob = new Blob([Uint8Array.from(scriptBytes)], { type: 'text/javascript' })
      const blobUrl = URL.createObjectURL(blob)
      blobUrlByPluginId.set(z.id, blobUrl)
      const json: ExternalPluginManifestJson = {
        id: z.id,
        name: z.name,
        version: z.version,
        description: z.description,
        icon: z.icon,
        componentUrl: blobUrl,
        defaultEnabled: z.defaultEnabled,
        defaultCollapsed: z.defaultCollapsed,
        defaultContainer: z.defaultContainer,
        defaultPosition: z.defaultPosition,
        minRole: z.minRole,
        tags: z.tags
      }
      pluginRegistry.register(buildPluginManifestFromExternalJson(json, blobUrl, ['user-zip']))
    } catch (e) {
      consola.warn('[userPluginZip] Failed to restore', z.id, e)
    }
  }
}

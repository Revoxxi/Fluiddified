import type { ApiConfig, HostConfig, InstanceConfig } from '@/store/config/types'

/**
 * Tells the Fluiddified proxy which Moonraker/camera pair to use for this browser
 * (HttpOnly cookie, per-user/session). Safe: only ids listed in FLUIDDIFIED_INSTANCES work.
 */
export async function syncProxyBackendIfHosted (
  apiConfig: ApiConfig | InstanceConfig,
  hostConfig: HostConfig
): Promise<void> {
  if (!hostConfig.hosted) return
  const id = apiConfig.proxyBackendId?.trim()
  if (!id) return
  const base = apiConfig.apiUrl.replace(/\/$/, '')
  try {
    await fetch(`${base}/__fluiddified/set-proxy-backend`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backendId: id })
    })
  } catch {
    /* non-fatal; user may not be using the Node proxy */
  }
}

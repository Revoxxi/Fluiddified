import Vue from 'vue'
import store from './store'
import { consola } from 'consola'
import { Globals } from './globals'
import type { ApiConfig, InitConfig, HostConfig, InstanceConfig } from './store/config/types'
import axios from 'axios'
import router from './router'
import { httpClientActions } from './api/httpClientActions'
import sanitizeEndpoint from './util/sanitize-endpoint'
import webSocketWrapper from './util/web-socket-wrapper'
import promiseAny from './util/promise-any'
import sleep from './util/sleep'
import md5 from 'md5'
import { syncProxyBackendIfHosted } from '@/util/hostedProxyBackend'

// Load API configuration
/**
 * 1. Load API config.
 *    - Load from local storage, if it exists, if not;
 *    - Ping common endpoints, alongside browser url;
 * 2. Commit instance / api config to store.
 * 3. Load the active instance UI config, if it exists and commit to store.
 * 4. Resume Vue Init
 */

const getHostConfig = async () => {
  const hostConfigResponse = await httpClientActions.get<HostConfig>(
    `${import.meta.env.BASE_URL}config.json`,
    { timeout: Globals.HOST_CONFIG_FETCH_MS }
  )
  if (hostConfigResponse && hostConfigResponse.data) {
    consola.debug('Loaded web host configuration', hostConfigResponse.data)
    return hostConfigResponse.data
  } else {
    consola.debug('Failed loading web host configuration')
    throw new Error('Unable to load host configuration. Please check the host.')
  }
}

/**
 * Same hostname but page is on reverse-proxy port (80/8080/…) while localStorage still
 * has direct Moonraker — WS to :7125 fails from the browser; camera on `/webcam` still works.
 */
function storedApiUrlIncompatibleWithHosted (apiUrl: string): boolean {
  try {
    const u = new URL(apiUrl)
    if (u.hostname !== document.location.hostname) {
      return false
    }
    const pagePort = document.location.port || (document.location.protocol === 'https:' ? '443' : '80')
    const storedPort = u.port || (u.protocol === 'https:' ? '443' : '80')
    return (
      (storedPort === '7125' || storedPort === '7130') &&
      pagePort !== '7125' &&
      pagePort !== '7130'
    )
  } catch {
    return false
  }
}

const getApiConfig = async (hostConfig: HostConfig, apiUrlHash?: string | null): Promise<ApiConfig | InstanceConfig> => {
  // Local storage load
  if (Globals.LOCAL_INSTANCES_STORAGE_KEY in localStorage) {
    const instancesValue = localStorage[Globals.LOCAL_INSTANCES_STORAGE_KEY]

    if (typeof instancesValue === 'string') {
      let instances: InstanceConfig[] = []
      try {
        const parsed: unknown = JSON.parse(instancesValue)
        instances = Array.isArray(parsed) ? parsed as InstanceConfig[] : []
      } catch (e) {
        consola.warn('Ignoring invalid appInstances in localStorage', e)
      }
      if (instances.length) {
        const rejectHostedMismatch = (config: InstanceConfig): boolean => {
          if (storedApiUrlIncompatibleWithHosted(config.apiUrl)) {
            consola.warn(
              '[config] Ignoring stored API URL pointing at this host\'s :7125 while the UI is on another port — ' +
                'using same-origin API/WebSocket. Set config.json "hosted": true when behind Fluiddified/nginx; ' +
                'clear localStorage appInstances if needed.'
            )
            return true
          }
          return false
        }

        if (apiUrlHash) {
          for (const config of instances) {
            if (md5(config.apiUrl) === apiUrlHash) {
              if (!rejectHostedMismatch(config)) {
                consola.debug('API Config from Local Storage', config)
                return config
              }
              break
            }
          }
        }
        for (const config of instances) {
          if (config.active) {
            if (!rejectHostedMismatch(config)) {
              consola.debug('API Config from Local Storage', config)
              return config
            }
            break
          }
        }
      }
    }
  }

  // If local storage not set, then ping the browser url.
  const endpoints: string[] = []
  const blacklist: string[] = []

  if (hostConfig && 'blacklist' in hostConfig && hostConfig.blacklist.length) {
    blacklist.push(...hostConfig.blacklist)
  }

  // If endpoints are defined in the hostConfig file,
  // we want to load these on initial application launch
  if (hostConfig && 'endpoints' in hostConfig && hostConfig.endpoints.length) {
    endpoints.push(
      ...hostConfig.endpoints
        .map(sanitizeEndpoint)
        .filter((endpoint): endpoint is string => !!endpoint))
  }

  // Add the browser url to our endpoints list, unless black listed.
  if (blacklist.findIndex(s => s.includes(document.location.hostname)) === -1) {
    const sameOrigin = `${document.location.protocol}//${document.location.host}`
    endpoints.push(sameOrigin)

    /**
     * Never auto-probe direct Moonraker :7125 when:
     * - `hosted`: UI is behind Fluiddified/nginx proxy — API/WS must stay same-origin
     *   (camera already uses `/webcam` on that origin; Moonraker must match).
     * - UI is on a non-default port (e.g. :80, :8080) unless `probeDirectMoonrakerPort`:
     *   otherwise the race often picks `http://host:7125`, WebSocket fails from the browser
     *   while `/webcam` on the proxy still works.
     */
    if (hostConfig.hosted) {
      // sameOrigin only
    } else if (hostConfig.probeDirectMoonrakerPort === true) {
      const port = document.location.protocol === 'https:' ? '7130' : '7125'
      const direct = `${document.location.protocol}//${document.location.hostname}:${port}`
      if (direct !== sameOrigin) {
        endpoints.push(direct)
      }
    } else {
      const effectivePort = document.location.port ||
        (document.location.protocol === 'https:' ? '443' : '80')
      const onMoonrakerListenPort = effectivePort === '7125' || effectivePort === '7130'
      if (onMoonrakerListenPort) {
        const port = document.location.protocol === 'https:' ? '7130' : '7125'
        const direct = `${document.location.protocol}//${document.location.hostname}:${port}`
        if (direct !== sameOrigin) {
          endpoints.push(direct)
        }
      }
    }
  }

  const abortController = new AbortController()

  try {
    const { signal } = abortController

    const defaultOnTimeout = async () => {
      await sleep(5000, signal)

      return {
        apiUrl: '',
        socketUrl: ''
      } satisfies ApiConfig
    }

    return await promiseAny([
      ...endpoints.map(async (endpoint) => {
        const apiEndpoints = Vue.$filters.getApiUrls(endpoint)

        await webSocketWrapper(apiEndpoints.socketUrl, signal)

        return apiEndpoints
      }),
      defaultOnTimeout()
    ])
  } finally {
    abortController.abort()
  }
}

const getMoorakerDatabase = async (apiConfig: ApiConfig, namespace: string) => {
  const result = {
    data: {} as any,
    apiConnected: true,
    apiAuthenticated: true
  }

  if (apiConfig.apiUrl !== '' && apiConfig.socketUrl !== '') {
    try {
      const response = await httpClientActions.serverDatabaseItemGet(namespace)

      result.data = response.data.result.value

      consola.debug('loaded db', namespace, result.data)
    } catch (e) {
      switch (axios.isAxiosError(e) ? e.response?.status : 0) {
        case 404:
          // Connected but database does not yet exist
          break

        case 401:
          // The API is technically connected, but we're un-authenticated.
          result.apiAuthenticated = false
          break

        default:
          consola.debug('API Down / Not Available:', e)
          result.apiConnected = false
          break
      }
    }
  } else {
    result.apiConnected = false
    result.apiAuthenticated = false
  }

  return result
}

export const appInit = async (apiConfig?: ApiConfig, hostConfig?: HostConfig): Promise<InitConfig> => {
  // Reset the store to its default state.
  await store.dispatch('reset', undefined, { root: true })

  try {
    // Load the Host Config
    if (!hostConfig) {
      hostConfig = await getHostConfig()
    }

    if (!(Globals.LOCAL_INSTANCES_STORAGE_KEY in localStorage)) {
      for (const endpoint of hostConfig.endpoints) {
        apiConfig = Vue.$filters.getApiUrls(endpoint)
        await store.dispatch('config/initLocal', { apiConfig })
      }
    }

    const locationUrl = new URL(window.location.href)

    // Check if we have a printer url hash in search params
    const apiUrlHash = locationUrl.searchParams.get('printer')

    // Load the API Config
    if (!apiConfig) {
      apiConfig = await getApiConfig(hostConfig, apiUrlHash)
    }

    if (apiConfig.apiUrl) {
      // Set the printer url hash in the search params so that the url is bookmarkable
      locationUrl.searchParams.set('printer', md5(apiConfig.apiUrl))

      window.history.replaceState(window.history.state, '', locationUrl)
    }

    // Setup axios
    if (apiConfig.apiUrl) httpClientActions.defaults.baseURL = apiConfig.apiUrl

    if (apiConfig.apiUrl) {
      try {
        await syncProxyBackendIfHosted(apiConfig, hostConfig)
        const infoRes = await httpClientActions.accessInfoGet({
          withAuth: false,
          timeout: Globals.AUTH_HTTP_PROBE_MS
        })
        const info = infoRes.data.result
        store.commit('auth/setMoonrakerTrusted', info.trusted === true)
        store.commit('auth/setMoonrakerLoginRequired', info.login_required === true)
      } catch {
        store.commit('auth/setMoonrakerTrusted', false)
        store.commit('auth/setMoonrakerLoginRequired', false)
      }
    } else {
      store.commit('auth/setMoonrakerTrusted', false)
      store.commit('auth/setMoonrakerLoginRequired', false)
    }

    // Just sets the api urls
    await store.dispatch('config/onInitApiConfig', apiConfig)
    consola.debug('inited apis', store.state.config, apiConfig)

    // Init authentication
    await store.dispatch('auth/initAuth')

    // Shell ready before Moonraker DB hydration so /login (and router-view) is not blank
    // for the whole DB loop. Connection flags are reconciled after the loop.
    await store.dispatch('init', {
      apiConfig,
      hostConfig,
      apiConnected: !!apiConfig.apiUrl
    })

    // Load any configuration we may have in moonrakers db
    let apiConnected = true
    let apiAuthenticated = true
    for (const { NAMESPACE, ROOTS } of Object.values(Globals.MOONRAKER_DB)) {
      if (!apiConnected && !apiAuthenticated) {
        break
      }

      if (Object.keys(ROOTS).length === 0) {
        continue
      }

      const result = await getMoorakerDatabase(apiConfig, NAMESPACE)

      apiAuthenticated = result.apiAuthenticated
      apiConnected = result.apiConnected

      if (!apiConnected || !apiAuthenticated) {
        break
      }

      const { data } = result

      const roots = Object.values<Record<string, any>>(ROOTS)

      const promises = roots.map(async (root) => {
        const value = root.name ? data[root.name] : data

        if (root.migrate_only) {
          if (value) await store.dispatch(root.dispatch, value)
        } else {
          if (!value) {
            try {
              await httpClientActions.serverDatabaseItemPost(NAMESPACE, root.name, {})
            } catch (e) {
              consola.debug('Error creating database item', e)
            }
          }

          await store.dispatch(root.dispatch, value || {})
        }
      })

      await Promise.all(promises)
    }

    if (store.state.socket.apiConnected !== apiConnected) {
      store.commit('socket/setApiConnected', apiConnected)
    }

    const loggedIn = store.getters['auth/uiSessionActive'] as boolean

    // Always require a Moonraker JWT from Fluidd login; never treat HTTP 200s without Bearer as logged in.
    if (loggedIn) {
      if (router.currentRoute.name === 'login') {
        await router.push({ name: 'home' })
      }
    } else if (router.currentRoute.name !== 'login') {
      await router.push({ name: 'login' })
    }

    return { apiConfig, hostConfig, apiConnected, apiAuthenticated }
  } finally {
    if (!store.state.config.appReady) {
      store.commit('config/setAppReady', true)
    }
  }
}

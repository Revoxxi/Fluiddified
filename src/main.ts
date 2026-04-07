// Styles
import '@/scss/global.scss'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

// Global Registrations
import './registerComponentHooks'
import './setupConsola'

// Common, 1st party.
import Vue from 'vue'
import { Globals } from './globals'
import i18n from '@/plugins/i18n'
import router from './router'
import store from './store'
import { consola } from 'consola'

// 3rd party.
import vuetify from './plugins/vuetify'
import VueVirtualScroller from 'vue-virtual-scroller'
import VueMeta from 'vue-meta'
import VuetifyConfirm from 'vuetify-confirm'
import Vue2TouchEvents from 'vue2-touch-events'
import { InlineSvgPlugin } from 'vue-inline-svg'

// Init.
import { appInit } from './init'
import type { InitConfig } from './store/config/types'

// Import plugins
import { HttpClientPlugin } from './plugins/httpClient'
import { FiltersPlugin } from './plugins/filters'
import { SocketPlugin } from './plugins/socketClient'
import { ColorSetPlugin } from './plugins/colorSet'

// Plugin auto-discovery
import { autoDiscoverPlugins } from './plugins/pluginAutoDiscover'
import { loadExternalPlugins } from './plugins/loadExternalPlugins'
import { rehydrateUserZipPlugins } from '@/util/userPluginZip'

// Socket actions store binding
import { setSocketActionsStore } from './api/socketActions'
import { EventBus } from '@/eventBus'

// Main App component
import App from './App.vue'

// Register global directives.
import SafeHtml from './directives/safe-html'
import PermissionDirective from './directives/permission'

// Directives...
Vue.directive('safe-html', SafeHtml)
Vue.directive('can', PermissionDirective)

// v-chart component asynchronously loaded from a split chunk
Vue.component('EChart', () => import('./vue-echarts-chunk'))

// Use any Plugins
Vue.use(VueVirtualScroller)
Vue.use(FiltersPlugin)
Vue.use(VueMeta)
Vue.use(ColorSetPlugin, {})
Vue.use(VuetifyConfirm, {
  vuetify
})
Vue.use(InlineSvgPlugin)
Vue.use(Vue2TouchEvents)

Vue.use(HttpClientPlugin, {
  store
})

Vue.use(SocketPlugin, {
  reconnectEnabled: true,
  reconnectInterval: Globals.SOCKET_RETRY_DELAY,
  store
})

async function bootstrap () {
  autoDiscoverPlugins()
  await loadExternalPlugins()
  rehydrateUserZipPlugins()
  setSocketActionsStore(store)

  Vue.config.productionTip = false

  new Vue({
    i18n,
    router,
    store,
    vuetify,
    render: (h) => h(App)
  }).$mount('#app')

  appInit()
    .then((config: InitConfig) => {
      consola.debug('Loaded App Configuration', config)

      const trust = store.state.auth.moonrakerTrusted
      if (
        config.apiConfig.socketUrl &&
        config.apiConnected &&
        (config.apiAuthenticated || trust)
      ) {
        Vue.$socket.connect(config.apiConfig.socketUrl)
      }
    })
    .catch((e: unknown) => {
      // Production uses consola.level = warn — debug would hide startup failures.
      consola.error('[Fluiddified] appInit failed', e)
      console.error('[Fluiddified] appInit failed', e)
      const detail = e instanceof Error ? e.message : String(e)
      EventBus.$emit(`Startup failed: ${detail}`, { type: 'error', timeout: -1 })
    })
}

bootstrap().catch((e) => {
  consola.error('[Fluiddified] bootstrap failed', e)
  console.error('[Fluiddified] bootstrap failed', e)
})

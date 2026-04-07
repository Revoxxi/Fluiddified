import Vue from 'vue'
import VueRouter, { type RouteConfig } from 'vue-router'
import store from '@/store'
import type { Role } from '@/types/auth'

Vue.use(VueRouter)

const isAuthenticated = (): boolean => {
  return Boolean(store.state.auth.token && store.state.auth.authenticated)
}

const defaultRouteConfig: Partial<RouteConfig> = {
  beforeEnter: (to, from, next) => {
    if (!isAuthenticated()) return next({ name: 'login' })

    const minRole = to.meta?.minRole as Role | undefined
    if (minRole && !store.getters['auth/hasMinRole'](minRole)) {
      return next({ name: 'home', replace: true })
    }

    next()
  },
  meta: {
    fileDropRoot: 'gcodes'
  }
}

const routes: Array<RouteConfig> = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Dashboard.vue'),
    ...defaultRouteConfig,
    meta: {
      ...defaultRouteConfig.meta,
      dashboard: true,
      minRole: 'guest' as Role
    }
  },
  {
    path: '/console',
    name: 'console',
    component: () => import('@/views/Console.vue'),
    ...defaultRouteConfig,
    meta: {
      ...defaultRouteConfig.meta,
      minRole: 'owner' as Role
    }
  },
  {
    path: '/jobs',
    name: 'jobs',
    component: () => import('@/views/Jobs.vue'),
    ...defaultRouteConfig,
    meta: {
      ...defaultRouteConfig.meta,
      minRole: 'guest' as Role
    }
  },
  {
    path: '/tune',
    name: 'tune',
    component: () => import('@/views/Tune.vue'),
    ...defaultRouteConfig,
    meta: {
      ...defaultRouteConfig.meta,
      minRole: 'user' as Role
    }
  },
  {
    path: '/diagnostics',
    name: 'diagnostics',
    component: () => import('@/views/Diagnostics.vue'),
    ...defaultRouteConfig,
    meta: {
      ...defaultRouteConfig.meta,
      dashboard: true,
      minRole: 'user' as Role
    }
  },
  {
    path: '/timelapse',
    name: 'timelapse',
    component: () => import('@/views/Timelapse.vue'),
    ...defaultRouteConfig,
    meta: {
      fileDropRoot: 'timelapse',
      minRole: 'guest' as Role
    }
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/History.vue'),
    ...defaultRouteConfig,
    meta: {
      ...defaultRouteConfig.meta,
      minRole: 'guest' as Role
    }
  },
  {
    path: '/system',
    name: 'system',
    component: () => import('@/views/System.vue'),
    ...defaultRouteConfig,
    meta: {
      ...defaultRouteConfig.meta,
      minRole: 'owner' as Role
    }
  },
  {
    path: '/configure',
    name: 'configure',
    component: () => import('@/views/Configure.vue'),
    ...defaultRouteConfig,
    meta: {
      minRole: 'owner' as Role
    }
  },
  {
    path: '/settings',
    name: 'settings',
    ...defaultRouteConfig,
    meta: {
      hasSubNavigation: true,
      minRole: 'owner' as Role
    },
    components: {
      default: () => import('@/views/Settings.vue'),
      navigation: () => import('@/components/layout/AppSettingsNav.vue')
    },
    children: [
      {
        path: 'macros/:categoryId',
        name: 'macro_category_settings',
        meta: {
          hasSubNavigation: true,
          minRole: 'owner' as Role
        },
        components: {
          default: () => import('@/components/settings/macros/MacroCategorySettings.vue'),
          navigation: () => import('@/components/layout/AppSettingsNav.vue')
        }
      }
    ]
  },
  {
    path: '/camera/:cameraId',
    name: 'camera',
    component: () => import('@/views/FullscreenCamera.vue'),
    ...defaultRouteConfig,
    meta: {
      ...defaultRouteConfig.meta,
      minRole: 'guest' as Role,
      fillHeight: true
    }
  },
  {
    path: '/preview',
    name: 'gcode_preview',
    component: () => import('@/views/GcodePreview.vue'),
    ...defaultRouteConfig,
    meta: {
      ...defaultRouteConfig.meta,
      minRole: 'guest' as Role
    }
  },
  {
    path: '/login',
    alias: '/login/',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    beforeEnter: (to, from, next) => {
      if (store.state.auth.token && store.state.auth.authenticated) {
        next({ name: 'home' })
        return
      }
      next()
    },
    meta: {
      fillHeight: true
    }
  },
  {
    path: '/user-accounts',
    name: 'user_accounts',
    beforeEnter: (to, from, next) => {
      if (!isAuthenticated()) return next({ name: 'login' })
      if (!store.getters['auth/canManageMoonrakerAccounts']) {
        return next({ name: 'home', replace: true })
      }
      next({ name: 'settings', hash: '#auth', replace: true })
    }
  },
  {
    path: '/icons',
    name: 'icons',
    component: () => import('@/views/Icons.vue'),
    ...defaultRouteConfig,
    meta: {
      ...defaultRouteConfig.meta,
      minRole: 'owner' as Role
    }
  },
  {
    path: '*',
    name: 'not_found',
    component: () => import('@/views/NotFound.vue'),
    ...defaultRouteConfig,
    meta: {
      ...defaultRouteConfig.meta,
      minRole: 'guest' as Role
    }
  }
]

const router = new VueRouter({
  base: import.meta.env.BASE_URL,
  routes,
  scrollBehavior: (to, from, savedPosition) => {
    if (savedPosition) return savedPosition
    if (to.hash) {
      return {
        selector: to.hash,
        offset: { x: 0, y: 60 },
        behavior: 'smooth'
      }
    }
    return { x: 0, y: 0 }
  }
})

router.beforeEach((to, from, next) => {
  store.commit('config/setContainerColumnCount', 2)
  store.commit('config/setLayoutMode', false)
  next()
})

router.afterEach((to) => {
  Promise.resolve(store.dispatch('achievements/onNavigate', to.fullPath))
    .catch(() => undefined)
})

declare module 'vue-router' {
  interface RouteMeta {
    fillHeight?: boolean
    hasSubNavigation?: boolean
    fileDropRoot?: string
    minRole?: Role
  }
}

export default router

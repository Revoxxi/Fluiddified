import { defineConfig } from 'vite'
import vue from '@pedrolamas/plugin-vue2'
import { VitePWA } from 'vite-plugin-pwa'
import Components from 'unplugin-vue-components/rolldown'
import { VuetifyResolver } from 'unplugin-vue-components/resolvers'
import path from 'path'
import content from '@originjs/vite-plugin-content'
import checker from 'vite-plugin-checker'
import version from './vite.config.inject-version'

export default defineConfig({
  plugins: [
    VitePWA({
      srcDir: 'src',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      includeAssets: [
        '**/*.svg',
        '**/*.png',
        '**/*.ico',
        'editor.theme.json'
      ],
      injectManifest: {
        globPatterns: [
          '**/*.{js,css,html,ttf,woff,woff2,wasm}'
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 ** 2
      },
      manifest: {
        name: 'Fluiddified',
        short_name: 'Fluiddified',
        description: 'Fluiddified — a Klipper web interface for managing your 3D printer',
        theme_color: '#2196F3',
        background_color: '#000000',
        icons: [
          {
            src: 'img/icons/pwa-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'img/icons/pwa-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Configuration',
            url: '#/configure',
            icons: [
              {
                src: 'img/icons/favicon.svg',
                sizes: 'any',
                type: 'image/svg+xml'
              }
            ]
          },
          {
            name: 'Settings',
            url: '#/settings',
            icons: [
              {
                src: 'img/icons/favicon.svg',
                sizes: 'any',
                type: 'image/svg+xml'
              }
            ]
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html'
      }
    }),
    vue(),
    version(),
    content(),
    checker({
      enableBuild: false,
      vueTsc: {
        tsconfigPath: path.resolve(__dirname, './tsconfig.app.json')
      },
      eslint: {
        lintCommand: 'eslint .',
        useFlatConfig: true
      }
    }),
    Components({
      dts: true,
      dirs: [
        'src/components/common',
        'src/components/layout',
        'src/components/ui'
      ],
      resolvers: [
        VuetifyResolver()
      ]
    })
  ],

  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['import', 'global-builtin', 'slash-div', 'if-function'],
        quietDeps: true,
        additionalData: '@import "@/scss/variables";\n'
      },
      sass: {
        silenceDeprecations: ['import', 'global-builtin', 'slash-div', 'if-function'],
        quietDeps: true,
        additionalData: '@import "@/scss/variables.scss"\n'
      }
    }
  },

  envPrefix: 'VUE_',

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      path: 'path-browserify'
    }
  },

  base: './',

  server: {
    host: '0.0.0.0',
    port: 8080
  }
})

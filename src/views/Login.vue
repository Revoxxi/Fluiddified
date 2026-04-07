<template>
  <v-row
    class="login-view"
    :dense="$vuetify.breakpoint.smAndDown"
    justify="center"
    align="center"
  >
    <v-col
      cols="12"
      class="d-flex justify-center align-center py-2 py-md-6"
    >
      <div class="login-panel-shell">
        <v-card
          class="login-panel"
          :elevation="12"
          width="100%"
        >
        <div
          v-if="firstUserUi === 'loading'"
          class="text-center py-12 px-6"
        >
          <v-progress-circular
            indeterminate
            color="primary"
            size="48"
          />
        </div>

        <v-card-text
          v-else
          class="login-panel__body pa-6 pa-sm-8"
        >
          <template v-if="firstUserUi === 'not_setup'">
            <div class="text-center">
              <v-icon
                size="72"
                color="secondary"
              >
                {{ notSetupIcon }}
              </v-icon>
              <h1 class="text-h5 mt-6">
                {{ $t('app.general.msg.first_user_not_setup_title') }}
              </h1>
              <p class="text-body-1 secondary--text mt-4">
                {{ $t('app.general.msg.first_user_not_setup_body') }}
              </p>
              <p class="text-body-2 secondary--text mt-3">
                {{ $t('app.general.msg.first_user_not_setup_hint') }}
              </p>
            </div>
          </template>

          <template v-else>
            <v-form
              v-if="firstUserUi === 'register'"
              @submit.prevent="handleRegister"
            >
              <div class="text-center">
                <p v-safe-html="$t('app.general.msg.first_user_welcome')" />

                <v-alert
                  v-if="registerError"
                  type="error"
                >
                  {{ registerError }}
                </v-alert>

                <v-text-field
                  v-model="username"
                  :label="$t('app.general.label.username')"
                  autocomplete="username"
                  spellcheck="false"
                  filled
                  dense
                  hide-details="auto"
                  :disabled="loading"
                  class="mb-4"
                />

                <v-text-field
                  v-model="password"
                  :label="$t('app.general.label.password')"
                  autocomplete="new-password"
                  filled
                  dense
                  type="password"
                  hide-details="auto"
                  :disabled="loading"
                  class="mb-4"
                />

                <v-text-field
                  v-model="passwordConfirm"
                  :label="$t('app.general.label.confirm_password')"
                  autocomplete="new-password"
                  filled
                  dense
                  type="password"
                  hide-details="auto"
                  :disabled="loading"
                  class="mb-4"
                />

                <app-btn
                  type="submit"
                  :disabled="loading"
                  large
                  block
                  class="mb-6"
                >
                  <v-icon
                    v-if="loading"
                    class="spin mr-2"
                  >
                    $loading
                  </v-icon>
                  {{ $t('app.general.btn.create_account') }}
                </app-btn>

                <app-btn
                  plain
                  class="custom-transform-class text-none"
                  :href="$globals.DOCS_AUTH"
                  target="_blank"
                >
                  {{ $t('app.general.btn.auth_unsure') }}
                </app-btn>
              </div>
            </v-form>

            <v-form
              v-else
              @submit.prevent="handleLogin"
            >
              <div class="text-center">
                <p v-safe-html="$t('app.general.msg.welcome_back')" />

                <v-alert
                  v-if="error"
                  type="error"
                >
                  {{ $t('app.general.simple_form.error.credentials') }}
                </v-alert>

                <v-text-field
                  v-model="username"
                  :label="$t('app.general.label.username')"
                  autocomplete="username"
                  spellcheck="false"
                  filled
                  dense
                  hide-details="auto"
                  :disabled="loading"
                  class="mb-4"
                />

                <v-text-field
                  v-model="password"
                  :label="$t('app.general.label.password')"
                  autocomplete="current-password"
                  filled
                  dense
                  type="password"
                  hide-details="auto"
                  :disabled="loading"
                  class="mb-4"
                />

                <v-select
                  v-if="availableSources.length > 1"
                  v-model="source"
                  :label="$t('app.general.label.auth_source')"
                  filled
                  dense
                  hide-details="auto"
                  :disabled="loading"
                  :items="availableSources.map(value => ({ text: $t(`app.general.label.${value}`), value }))"
                  class="mb-4"
                />

                <app-btn
                  type="submit"
                  :disabled="loading"
                  large
                  block
                  class="mb-6"
                >
                  <v-icon
                    v-if="loading"
                    class="spin mr-2"
                  >
                    $loading
                  </v-icon>
                  {{ $t('app.general.btn.login') }}
                </app-btn>

                <app-btn
                  plain
                  class="custom-transform-class text-none"
                  :href="$globals.DOCS_AUTH_LOST_PASSWORD"
                  target="_blank"
                >
                  {{ $t('app.general.btn.forgot_password') }}
                </app-btn>

                <app-btn
                  plain
                  class="custom-transform-class text-none"
                  :href="$globals.DOCS_AUTH"
                  target="_blank"
                >
                  {{ $t('app.general.btn.auth_unsure') }}
                </app-btn>
              </div>
            </v-form>
          </template>
        </v-card-text>
        </v-card>
      </div>
    </v-col>
  </v-row>
</template>

<script lang="ts">
import axios from 'axios'
import Vue from 'vue'
import { Component, Vue as VueBase } from 'vue-property-decorator'
import { appInit } from '@/init'
import { consola } from 'consola'
import type { InstanceConfig } from '@/store/config/types'
import type { FirstUserSetupState } from '@/store/auth/types'
import i18n from '@/plugins/i18n'
import { Icons } from '@/globals'

@Component({})
export default class Login extends VueBase {
  readonly notSetupIcon = Icons.alertCircle

  username = ''
  password = ''
  passwordConfirm = ''
  error = false
  loading = false
  source = 'moonraker'
  availableSources = [this.source]

  firstUserUi: 'loading' | 'login' | 'register' | 'not_setup' = 'loading'
  registerError = ''

  /**
   * Discovery can take several seconds. `httpClient.defaults.baseURL` is set as soon
   * as the printer URL is known (before the Moonraker DB loop finishes); `appReady`
   * is set when `store.dispatch('init')` runs — including when there is no printer.
   * No fixed timeout: if bootstrap aborts before `init` (e.g. host config missing),
   * the spinner may persist until a successful reload.
   */
  waitForPrinterApiOrigin (): Promise<void> {
    const httpReady = (): boolean => Boolean(
      this.$store.state.config.apiUrl ||
      Vue.$httpClient.defaults.baseURL
    )
    const initDone = (): boolean => this.$store.state.config.appReady

    if (httpReady()) return Promise.resolve()

    return new Promise((resolve) => {
      let settled = false
      function finish (): void {
        if (settled) return
        settled = true
        clearInterval(poll)
        unwatch()
        resolve()
      }
      const poll = setInterval(() => {
        if (httpReady() || initDone()) finish()
      }, 50)
      const unwatch = this.$store.watch(
        () => ({
          url: this.$store.state.config.apiUrl,
          ready: this.$store.state.config.appReady
        }),
        () => {
          if (httpReady() || initDone()) finish()
        }
      )
    })
  }

  async mounted () {
    await this.waitForPrinterApiOrigin()

    const authInfo = await this.$typedDispatch('auth/getAuthInfo')
    const setup: FirstUserSetupState = await this.$typedDispatch('auth/getFirstUserSetupState')

    this.source = authInfo.defaultSource ?? this.source
    this.availableSources = authInfo.availableSources ?? this.availableSources

    if (setup.mode === 'register') {
      this.firstUserUi = 'register'
    } else if (setup.mode === 'blocked_untrusted') {
      this.firstUserUi = 'not_setup'
    } else {
      this.firstUserUi = 'login'
    }
  }

  async afterAuthSuccess () {
    const instance: InstanceConfig | undefined = this.$typedGetters['config/getCurrentInstance']

    const config = await appInit(instance, this.$typedState.config.hostConfig)

    const trust = this.$typedState.auth.moonrakerTrusted
    if (config.apiConfig.socketUrl && config.apiConnected && (config.apiAuthenticated || trust)) {
      consola.debug('Activating socket with config', config)
      this.$socket.connect(config.apiConfig.socketUrl)
    }
  }

  async handleLogin () {
    this.error = false
    this.loading = true
    try {
      await this.$typedDispatch('auth/login', { username: this.username, password: this.password, source: this.source })
      await this.afterAuthSuccess()
    } catch {
      this.error = true
    }
    this.loading = false
  }

  async handleRegister () {
    this.registerError = ''
    if (this.password !== this.passwordConfirm) {
      this.registerError = i18n.t('app.general.simple_form.error.password_mismatch').toString()
      return
    }
    this.loading = true
    try {
      await this.$typedDispatch('auth/registerFirstUser', {
        username: this.username,
        password: this.password
      })
      await this.afterAuthSuccess()
    } catch (error: unknown) {
      const fallback = i18n.t('app.general.simple_form.error.registration_failed').toString()
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as { error?: { message?: string }, message?: string } | undefined
        const fromApi = data?.error?.message ?? data?.message
        this.registerError =
          typeof fromApi === 'string' && fromApi.length > 0 ? fromApi : fallback
      } else {
        this.registerError = fallback
      }
    }
    this.loading = false
  }
}
</script>

<style lang="scss" scoped>
  .login-view {
    // Align with Globals.HEADER_HEIGHT (app bar)
    min-height: calc(100vh - 56px);
  }

  /* Hard cap: v-card max-width is unreliable inside flex v-col with width="100%". */
  .login-panel-shell {
    width: 100%;
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
    flex: 0 1 auto;
  }

  .login-panel {
    border-radius: 12px;
    // Modal-like containment: cap height on short viewports / long registration form
    max-height: min(90vh, 640px);
    display: flex;
    flex-direction: column;
  }

  .login-panel__body {
    overflow-x: hidden;
    overflow-y: auto;
    flex: 1 1 auto;
    min-height: 0;
  }
</style>

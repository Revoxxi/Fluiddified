<template>
  <div>
    <v-subheader id="plugins">
      {{ $t('app.setting.title.plugin_manager') }}
    </v-subheader>
    <v-card
      :elevation="5"
      dense
      class="mb-4"
    >
      <v-card-text
        v-if="isOwner"
        class="pb-0"
      >
        <input
          ref="zipFileInput"
          type="file"
          accept=".zip,application/zip"
          class="d-none"
          @change="onZipSelected"
        >
        <v-btn
          small
          outlined
          color="primary"
          class="mr-2"
          @click="openZipPicker"
        >
          {{ $t('app.setting.msg.plugin_install_zip') }}
        </v-btn>
        <span class="text-caption text--secondary">
          {{ $t('app.setting.msg.plugin_zip_help') }}
        </span>
        <v-alert
          v-if="zipInstallError"
          type="error"
          dense
          outlined
          class="mt-3 mb-0"
        >
          {{ zipInstallError }}
        </v-alert>
      </v-card-text>
      <div
        v-else
        class="px-4 pt-2 text-caption text--secondary"
      >
        {{ $t('app.setting.msg.plugin_owner_only') }}
      </div>

      <template v-for="(plugin, i) in plugins">
        <app-setting
          :key="plugin.id"
          :title="plugin.name"
          :sub-title="plugin.description"
        >
          <template
            v-if="plugin.icon"
            #title-icon
          >
            <v-icon
              small
              class="mr-2"
            >
              {{ plugin.icon }}
            </v-icon>
          </template>
          <template #sub-title>
            <div class="text-body-2 secondary--text">
              {{ plugin.description }}
            </div>
            <div class="mt-1">
              <v-chip
                x-small
                label
                class="mr-1"
              >
                {{ pluginKindLabel(plugin.id) }}
              </v-chip>
              <span class="text-caption text--secondary">v{{ plugin.version }}</span>
            </div>
          </template>
          <div class="d-flex align-center flex-nowrap">
            <v-tooltip bottom>
              <template #activator="{ on, attrs }">
                <v-icon
                  small
                  class="mr-2"
                  :color="pluginStatusColor(plugin.id)"
                  v-bind="attrs"
                  v-on="on"
                >
                  {{ pluginStatusIcon(plugin.id) }}
                </v-icon>
              </template>
              <span>{{ pluginStatusTooltip(plugin.id) }}</span>
            </v-tooltip>
            <v-btn
              v-if="showRemoveFor(plugin.id)"
              icon
              small
              class="mr-1"
              :aria-label="$t('app.setting.msg.plugin_remove')"
              @click="confirmRemove(plugin.id)"
            >
              <v-icon small>
                {{ deleteIcon }}
              </v-icon>
            </v-btn>
            <v-tooltip
              bottom
              :disabled="!disableSwitchLocked(plugin.id)"
            >
              <template #activator="{ on, attrs }">
                <div
                  v-bind="attrs"
                  v-on="on"
                >
                  <v-switch
                    :input-value="pluginSwitchValue(plugin.id)"
                    :disabled="disableSwitchLocked(plugin.id)"
                    hide-details
                    class="mt-0"
                    @change="togglePlugin(plugin.id, $event)"
                  />
                </div>
              </template>
              <span>{{ $t('app.setting.msg.plugin_disable_locked') }}</span>
            </v-tooltip>
          </div>
        </app-setting>
        <v-divider
          v-if="i < plugins.length - 1"
          :key="`d-${plugin.id}`"
        />
      </template>

      <div
        v-if="plugins.length === 0"
        class="pa-4 text-center text-body-2 text--disabled"
      >
        {{ emptyPluginManagerMessage }}
      </div>
    </v-card>
  </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import { pluginRegistry } from '@/plugins/pluginRegistry'
import type { PluginManifest } from '@/types/plugin'
import AuthMixin from '@/mixins/auth'
import { Icons } from '@/globals'
import {
  canUserDisablePlugin,
  canUserRemovePlugin,
  isCoreAlwaysOnDashboardPlugin,
  isNativeBundledPlugin,
  isShownInPluginManager,
  nativePluginKind
} from '@/util/nativePluginPolicy'
import { isUserZipPluginId } from '@/util/userPluginPersistence'

@Component({})
export default class PluginSettings extends Mixins(AuthMixin) {
  declare $refs: {
    zipFileInput: HTMLInputElement
  }

  readonly deleteIcon = Icons.delete

  pluginStatusIcon (id: string): string {
    switch (this.pluginStatus(id)) {
      case 'error':
        return Icons.alertCircle
      case 'stopped':
        return Icons.stop
      default:
        return Icons.checkedCircle
    }
  }

  pluginStatusColor (id: string): string | undefined {
    switch (this.pluginStatus(id)) {
      case 'error':
        return 'error'
      case 'stopped':
        return 'grey'
      default:
        return 'success'
    }
  }

  pluginStatusTooltip (id: string): string {
    switch (this.pluginStatus(id)) {
      case 'error':
        return this.$t('app.setting.msg.plugin_status_error') as string
      case 'stopped':
        return this.$t('app.setting.msg.plugin_status_stopped') as string
      default:
        return this.$t('app.setting.msg.plugin_status_working') as string
    }
  }

  pluginStatus (id: string): 'error' | 'stopped' | 'working' {
    const err = this.$typedGetters['plugins/getLoadError'](id)
    if (err) {
      return 'error'
    }
    if (canUserDisablePlugin(id) && this.$typedGetters['plugins/isDisabled'](id)) {
      return 'stopped'
    }
    return 'working'
  }

  get plugins (): PluginManifest[] {
    const list = pluginRegistry.getAll()
      .filter(p => isShownInPluginManager(p.id))
    const core = list
      .filter(p => isCoreAlwaysOnDashboardPlugin(p.id))
      .sort((a, b) => a.name.localeCompare(b.name))
    const rest = list
      .filter(p => !isCoreAlwaysOnDashboardPlugin(p.id))
      .sort((a, b) => a.name.localeCompare(b.name))
    return [...core, ...rest]
  }

  get emptyPluginManagerMessage (): string {
    if (pluginRegistry.getAll().length === 0) {
      return this.$t('app.setting.msg.no_plugins_registered') as string
    }
    return this.$t('app.setting.msg.plugin_manager_core_only') as string
  }

  get zipInstallError (): string | undefined {
    return this.$typedGetters['plugins/getLoadError']('__zip_install__')
  }

  pluginKindLabel (id: string): string {
    if (isUserZipPluginId(id)) {
      return this.$t('app.setting.msg.plugin_badge_user_zip') as string
    }
    const k = nativePluginKind(id)
    if (k === 'core-native') {
      return this.$t('app.setting.msg.plugin_badge_core') as string
    }
    if (k === 'optional-native') {
      return this.$t('app.setting.msg.plugin_badge_optional') as string
    }
    return this.$t('app.setting.msg.plugin_badge_external') as string
  }

  pluginSwitchValue (id: string): boolean {
    if (!canUserDisablePlugin(id) && isNativeBundledPlugin(id)) {
      return true
    }
    return !this.$typedGetters['plugins/isDisabled'](id)
  }

  disableSwitchLocked (id: string): boolean {
    return !canUserDisablePlugin(id)
  }

  showRemoveFor (id: string): boolean {
    return this.isOwner && canUserRemovePlugin(id)
  }

  togglePlugin (id: string, enabled: boolean) {
    if (!canUserDisablePlugin(id)) {
      return
    }
    if (enabled) {
      this.$typedDispatch('plugins/enablePlugin', id)
    } else {
      this.$typedDispatch('plugins/disablePlugin', id)
    }
  }

  openZipPicker () {
    this.$refs.zipFileInput?.click()
  }

  onZipSelected (ev: Event) {
    const input = ev.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file) {
      this.$typedDispatch('plugins/installPluginFromZip', file)
    }
  }

  async confirmRemove (id: string) {
    if (!this.showRemoveFor(id)) {
      return
    }
    const ok = await this.$confirm(
      this.$t('app.setting.msg.plugin_remove_confirm_message') as string,
      {
        title: this.$t('app.setting.msg.plugin_remove_confirm_title') as string,
        color: 'card-heading',
        icon: '$error'
      }
    )
    if (ok) {
      await this.$typedDispatch('plugins/removePlugin', id)
    }
  }
}
</script>

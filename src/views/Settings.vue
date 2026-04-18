<template>
  <v-row
    :dense="$vuetify.breakpoint.smAndDown"
    justify="center"
  >
    <v-col
      cols="12"
      lg="8"
    >
      <router-view v-if="uiSessionActive && socketConnected" />
      <div v-if="$route.matched.length === 1">
        <general-settings />
        <warnings-settings />
        <theme-settings />
        <auth-settings v-if="supportsAuth" />
        <console-settings />
        <file-browser-settings />
        <file-editor-settings />
        <macro-settings />
        <job-queue-farm-settings v-if="supportsJobQueue" />
        <camera-settings />
        <toolhead-settings />
        <preset-settings />
        <gcode-preview-settings />
        <timelapse-settings v-if="supportsTimelapse" />
        <mmu-settings v-if="supportsMmu" />
        <spoolman-settings v-if="supportsSpoolman" />
        <achievement-settings />
        <plugin-settings />
        <version-settings v-if="supportsVersions" />
      </div>
    </v-col>
  </v-row>
</template>

<script lang="ts">
import { Component, Mixins, Watch } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'

import MacroSettings from '@/components/settings/macros/MacroSettings.vue'
import GeneralSettings from '@/components/settings/GeneralSettings.vue'
import PresetSettings from '@/components/settings/presets/PresetSettings.vue'
import CameraSettings from '@/components/settings/cameras/CameraSettings.vue'
import ToolheadSettings from '@/components/settings/ToolheadSettings.vue'
import ThemeSettings from '@/components/settings/ThemeSettings.vue'
import VersionSettings from '@/components/settings/VersionSettings.vue'
import GcodePreviewSettings from '@/components/settings/GcodePreviewSettings.vue'
import AuthSettings from '@/components/settings/auth/AuthSettings.vue'
import ConsoleSettings from '@/components/settings/console/ConsoleSettings.vue'
import FileBrowserSettings from '@/components/settings/FileBrowserSettings.vue'
import FileEditorSettings from '@/components/settings/FileEditorSettings.vue'
import TimelapseSettings from '@/components/settings/timelapse/TimelapseSettings.vue'
import SpoolmanSettings from '@/components/settings/SpoolmanSettings.vue'
import MmuSettings from '@/components/settings/MmuSettings.vue'
import WarningsSettings from '@/components/settings/WarningsSettings.vue'
import PluginSettings from '@/components/settings/PluginSettings.vue'
import AchievementSettings from '@/components/settings/AchievementSettings.vue'
import JobQueueFarmSettings from '@/components/settings/JobQueueFarmSettings.vue'

@Component({
  components: {
    SpoolmanSettings,
    MmuSettings,
    TimelapseSettings,
    MacroSettings,
    GeneralSettings,
    PresetSettings,
    CameraSettings,
    ToolheadSettings,
    ThemeSettings,
    VersionSettings,
    GcodePreviewSettings,
    AuthSettings,
    ConsoleSettings,
    FileBrowserSettings,
    FileEditorSettings,
    WarningsSettings,
    PluginSettings,
    AchievementSettings,
    JobQueueFarmSettings
  }
})
export default class Settings extends Mixins(StateMixin) {
  @Watch('$route', { immediate: true })
  onSettingsRouteChange () {
    const n = this.$route.name
    if (n !== 'settings' && n !== 'macro_category_settings') {
      return
    }
    const h = this.$route.hash
    if (h.length > 1) {
      this.$typedDispatch('achievements/onSettingsVisit', h)
    }
  }

  get supportsVersions (): boolean {
    return this.$typedGetters['server/componentSupport']('update_manager')
  }

  get supportsAuth (): boolean {
    return this.$typedGetters['server/componentSupport']('authorization')
  }

  get supportsTimelapse (): boolean {
    return this.$typedGetters['server/componentSupport']('timelapse')
  }

  get supportsSpoolman (): boolean {
    return this.$typedGetters['server/componentSupport']('spoolman')
  }

  get supportsMmu (): boolean {
    return this.$typedState.printer.printer.mmu != null
  }

  get supportsJobQueue (): boolean {
    return this.$typedGetters['server/componentSupport']('job_queue')
  }
}
</script>

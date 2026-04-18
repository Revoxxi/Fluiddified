<template>
  <div>
    <v-subheader id="job-queue-farm">
      {{ $t('app.setting.title.job_queue_farm') }}
    </v-subheader>
    <v-card
      :elevation="5"
      dense
      class="mb-4"
    >
      <app-setting :title="$t('app.setting.label.job_queue_farm_show_ui')">
        <v-switch
          :input-value="farm.showFarmAssistUi"
          class="mt-0 pt-0"
          color="primary"
          hide-details
          @change="patchField('showFarmAssistUi', $event)"
        />
      </app-setting>

      <template v-if="farm.showFarmAssistUi">
        <v-divider />

        <app-setting :title="$t('app.setting.label.job_queue_machine_preset')">
          <v-select
            v-model="presetModel"
            :items="presetItems"
            item-value="value"
            item-text="text"
            filled
            dense
            hide-details
          />
        </app-setting>

        <app-setting :title="$t('app.setting.label.job_queue_clearance_mode')">
          <v-select
            :value="farm.clearanceMode"
            :items="clearanceItems"
            item-value="value"
            item-text="text"
            filled
            dense
            hide-details
            @input="patchField('clearanceMode', $event)"
          />
        </app-setting>

        <app-setting
          v-if="farm.clearanceMode === 'custom_macro'"
          :title="$t('app.setting.label.job_queue_custom_macro')"
        >
          <v-text-field
            :value="farm.customMacroName"
            filled
            dense
            hide-details
            :placeholder="$t('app.setting.label.job_queue_custom_macro_placeholder')"
            @change="patchField('customMacroName', $event)"
          />
        </app-setting>

        <app-setting :title="$t('app.setting.label.job_queue_cooldown')">
          <v-text-field
            :value="farm.cooldownSeconds"
            type="number"
            min="0"
            filled
            dense
            hide-details
            suffix="s"
            @change="patchField('cooldownSeconds', Math.max(0, parseInt($event, 10) || 0))"
          />
        </app-setting>

        <app-setting :title="$t('app.setting.label.job_queue_notes')">
          <v-textarea
            :value="farm.notes"
            filled
            dense
            rows="3"
            hide-details
            @change="patchField('notes', $event)"
          />
        </app-setting>

        <v-card-text class="caption text--secondary pt-0">
          {{ $t('app.setting.tooltip.job_queue_farm_disclaimer') }}
        </v-card-text>
      </template>
    </v-card>
  </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import type { JobQueueFarmConfig, JobQueueFarmClearanceMode } from '@/store/config/types'

@Component
export default class JobQueueFarmSettings extends Mixins(StateMixin) {
  get farm (): JobQueueFarmConfig {
    return this.$typedState.config.uiSettings.general.jobQueueFarm
  }

  get presetItems () {
    return [
      { text: this.$t('app.setting.label.machine_preset_custom').toString(), value: 'custom' },
      { text: this.$t('app.setting.label.machine_preset_ender3_v3_se').toString(), value: 'ender3_v3_se' },
      { text: this.$t('app.setting.label.machine_preset_voron').toString(), value: 'voron' }
    ]
  }

  get clearanceItems () {
    return [
      { text: this.$t('app.setting.label.clearance_none').toString(), value: 'none' as JobQueueFarmClearanceMode },
      { text: this.$t('app.setting.label.clearance_bed_strip').toString(), value: 'bed_strip' as JobQueueFarmClearanceMode },
      { text: this.$t('app.setting.label.clearance_toolhead_push').toString(), value: 'toolhead_push' as JobQueueFarmClearanceMode },
      { text: this.$t('app.setting.label.clearance_custom_macro').toString(), value: 'custom_macro' as JobQueueFarmClearanceMode }
    ]
  }

  get presetModel (): string {
    return this.farm.machinePreset
  }

  set presetModel (value: string) {
    const next: JobQueueFarmConfig = { ...this.farm, machinePreset: value }
    if (value === 'ender3_v3_se') {
      next.clearanceMode = 'toolhead_push'
      next.cooldownSeconds = 45
    } else if (value === 'voron') {
      next.clearanceMode = 'bed_strip'
      next.cooldownSeconds = 90
    }
    this.persistFarmConfig(next)
  }

  patchField<K extends keyof JobQueueFarmConfig> (key: K, value: JobQueueFarmConfig[K]) {
    this.persistFarmConfig({
      ...this.farm,
      [key]: value
    })
  }

  persistFarmConfig (value: JobQueueFarmConfig) {
    this.$typedDispatch('config/saveByPath', {
      path: 'uiSettings.general.jobQueueFarm',
      value,
      server: true
    })
  }
}
</script>

<template>
  <collapsable-card
    :title="$t('app.general.title.temperature')"
    icon="$fire"
    :help-tooltip="$t('app.chart.tooltip.help')"
    :lazy="false"
    draggable
    layout-path="dashboard.temperature-card"
  >
    <template #menu>
      <app-btn-collapse-group
        v-if="!isGuest"
        :collapsed="narrow"
      >
        <temperature-presets-menu
          @applyOff="handleApplyOff"
          @applyPreset="handleApplyPreset"
        />
      </app-btn-collapse-group>

      <v-menu
        v-if="!isGuest"
        bottom
        left
        offset-y
        transition="slide-y-transition"
        :close-on-content-click="false"
      >
        <template #activator="{ on, attrs }">
          <app-btn
            icon
            v-bind="attrs"
            v-on="on"
          >
            <v-icon dense>
              $cog
            </v-icon>
          </app-btn>
        </template>

        <v-list dense>
          <v-list-item @click="chartVisible = !chartVisible">
            <v-list-item-action class="my-0">
              <v-checkbox :input-value="chartVisible" />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>
                {{ $t('app.setting.label.show_chart') }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>

          <v-list-item @click="showRateOfChange = !showRateOfChange">
            <v-list-item-action class="my-0">
              <v-checkbox :input-value="showRateOfChange" />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>
                {{ $t('app.setting.label.show_rate_of_change') }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>

          <v-list-item @click="showRelativeHumidity = !showRelativeHumidity">
            <v-list-item-action class="my-0">
              <v-checkbox :input-value="showRelativeHumidity" />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>
                {{ $t('app.setting.label.show_relative_humidity') }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>

          <v-list-item @click="showBarometricPressure = !showBarometricPressure">
            <v-list-item-action class="my-0">
              <v-checkbox :input-value="showBarometricPressure" />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>
                {{ $t('app.setting.label.show_barometric_pressure') }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>

          <v-list-item @click="showGasResistance = !showGasResistance">
            <v-list-item-action class="my-0">
              <v-checkbox :input-value="showGasResistance" />
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>
                {{ $t('app.setting.label.show_gas_resistance') }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>

          <v-divider />

          <v-list-item>
            <v-list-item-content>
              <v-list-item-title class="mb-2">
                {{ $t('app.setting.label.thermal_chart_scale') }}
              </v-list-item-title>
              <v-select
                :value="thermalChartScale.mode"
                :items="thermalChartScaleModeItems"
                item-value="value"
                item-text="text"
                dense
                filled
                hide-details
                @input="patchThermalChartScale({ mode: $event })"
              />
              <v-row
                v-if="thermalChartScale.mode === 'fixed'"
                class="mt-2"
                dense
              >
                <v-col cols="6">
                  <v-text-field
                    type="number"
                    :label="$t('app.setting.label.thermal_chart_min')"
                    :value="thermalChartScale.min ?? ''"
                    dense
                    filled
                    hide-details
                    @change="onThermalChartMinChange"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    type="number"
                    :label="$t('app.setting.label.thermal_chart_max')"
                    :value="thermalChartScale.max ?? ''"
                    dense
                    filled
                    hide-details
                    @change="onThermalChartMaxChange"
                  />
                </v-col>
              </v-row>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-menu>
    </template>

    <temperature-targets
      :readonly="isGuest"
      :manual-target-lock="!isOwner"
      @updateChartSelectedLegends="updateChartSelectedLegends"
    />

    <template v-if="chartReady && chartVisible">
      <v-divider />

      <thermal-chart
        ref="thermalchart"
        :narrow="narrow"
        :scale-mode="thermalChartScale.mode"
        :fixed-min="thermalChartScale.min"
        :fixed-max="thermalChartScale.max"
      />
    </template>
  </collapsable-card>
</template>

<script lang="ts">
import { Component, Mixins, Prop, Ref } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import BrowserMixin from '@/mixins/browser'
import AuthMixin from '@/mixins/auth'

import ThermalChart from '@/components/widgets/thermals/ThermalChart.vue'
import TemperatureTargets from '@/components/widgets/thermals/TemperatureTargets.vue'
import TemperaturePresetsMenu from './TemperaturePresetsMenu.vue'
import type { TemperaturePreset, ThermalChartScaleConfig } from '@/store/config/types'
import type { ChartSelectedLegends } from '@/store/charts/types'
import { encodeGcodeParamValue } from '@/util/gcode-helpers'

@Component({
  components: {
    ThermalChart,
    TemperatureTargets,
    TemperaturePresetsMenu
  }
})
export default class TemperatureCard extends Mixins(StateMixin, BrowserMixin, AuthMixin) {
  @Prop({ type: Boolean })
  readonly narrow?: boolean

  @Ref('thermalchart')
  readonly thermalChartElement!: ThermalChart

  get chartReady (): boolean {
    return (
      this.$typedState.socket.acceptingNotifications &&
      this.$typedState.socket.ready &&
      this.$typedState.charts.ready &&
      this.klippyReady
    )
  }

  updateChartSelectedLegends (chartSelectedLegends: ChartSelectedLegends) {
    if (this.chartVisible) {
      this.thermalChartElement.updateChartSelectedLegends(chartSelectedLegends)
    }
  }

  get chartVisible (): boolean {
    return this.$typedState.config.uiSettings.general.chartVisible
  }

  set chartVisible (value: boolean) {
    this.$typedDispatch('config/saveByPath', {
      path: 'uiSettings.general.chartVisible',
      value,
      server: true
    })
  }

  get showRateOfChange (): boolean {
    return this.$typedState.config.uiSettings.general.showRateOfChange
  }

  set showRateOfChange (value: boolean) {
    this.$typedDispatch('config/saveByPath', {
      path: 'uiSettings.general.showRateOfChange',
      value,
      server: true
    })
  }

  get showRelativeHumidity (): boolean {
    return this.$typedState.config.uiSettings.general.showRelativeHumidity
  }

  set showRelativeHumidity (value: boolean) {
    this.$typedDispatch('config/saveByPath', {
      path: 'uiSettings.general.showRelativeHumidity',
      value,
      server: true
    })
  }

  get showBarometricPressure (): boolean {
    return this.$typedState.config.uiSettings.general.showBarometricPressure
  }

  set showBarometricPressure (value: boolean) {
    this.$typedDispatch('config/saveByPath', {
      path: 'uiSettings.general.showBarometricPressure',
      value,
      server: true
    })
  }

  get showGasResistance (): boolean {
    return this.$typedState.config.uiSettings.general.showGasResistance
  }

  set showGasResistance (value: boolean) {
    this.$typedDispatch('config/saveByPath', {
      path: 'uiSettings.general.showGasResistance',
      value,
      server: true
    })
  }

  get thermalChartScale (): ThermalChartScaleConfig {
    return this.$typedState.config.uiSettings.general.thermalChartScale
  }

  get thermalChartScaleModeItems () {
    return [
      { text: this.$t('app.setting.label.thermal_chart_scale_auto').toString(), value: 'auto' as const },
      { text: this.$t('app.setting.label.thermal_chart_scale_fixed').toString(), value: 'fixed' as const }
    ]
  }

  patchThermalChartScale (partial: Partial<ThermalChartScaleConfig>) {
    const next: ThermalChartScaleConfig = {
      ...this.thermalChartScale,
      ...partial
    }
    this.$typedDispatch('config/saveByPath', {
      path: 'uiSettings.general.thermalChartScale',
      value: next,
      server: true
    })
  }

  onThermalChartMinChange (v: string) {
    const n = parseFloat(v)
    this.patchThermalChartScale({ min: Number.isFinite(n) ? n : null })
  }

  onThermalChartMaxChange (v: string) {
    const n = parseFloat(v)
    this.patchThermalChartScale({ max: Number.isFinite(n) ? n : null })
  }

  handleApplyPreset (preset: TemperaturePreset) {
    if (preset) {
      if (preset.values) {
        for (const key in preset.values) {
          const item = preset.values[key]
          if (item.type === 'heater' && item.active && item.value > -1) {
            this.sendGcode(`SET_HEATER_TEMPERATURE HEATER=${encodeGcodeParamValue(key)} TARGET=${item.value}`)
          }
          if (item.type === 'fan' && item.active && item.value > -1) {
            this.sendGcode(`SET_TEMPERATURE_FAN_TARGET TEMPERATURE_FAN=${encodeGcodeParamValue(key)} TARGET=${item.value}`)
          }
        }
      }

      if (preset.gcode) {
        this.sendGcode(preset.gcode)
      }

      this.$typedDispatch('achievements/onPresetActivated', undefined, { root: true })
    }
  }

  async handleApplyOff () {
    const result = (
      !['printing', 'busy', 'paused'].includes(this.printerState) ||
      await this.$confirm(
        this.$tc('app.general.label.heaters_busy'),
        { title: this.$tc('app.general.simple_form.msg.confirm'), color: 'card-heading', icon: '$error' }
      )
    )

    if (result) {
      this.sendGcode('TURN_OFF_HEATERS')
    }
  }
}
</script>

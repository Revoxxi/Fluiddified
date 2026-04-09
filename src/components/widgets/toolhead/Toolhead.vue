<template>
  <div :class="{ 'guest-toolhead-disabled': guestMode }">
    <v-card-text>
      <tool-change-commands />

      <v-row
        justify="space-between"
        align="start"
      >
        <v-col class="controls-wrapper">
          <extruder-selection v-if="hasMultipleExtruders" />
          <template v-if="!printerPrinting">
            <toolhead-control-cross v-if="toolheadControlStyle === 'cross'" />
            <toolhead-control-bars v-else-if="toolheadControlStyle === 'bars'" />
            <toolhead-control-circle v-else-if="toolheadControlStyle === 'circle'" />
          </template>
          <z-height-adjust v-else-if="isOwner" />
        </v-col>

        <v-col class="controls-wrapper">
          <toolhead-position />
          <extruder-moves v-if="!printerPrinting && hasExtruder" />
          <z-height-adjust v-if="!printerPrinting && isOwner" />
        </v-col>
      </v-row>
    </v-card-text>

    <template v-if="!printerPrinting">
      <v-divider />

      <extruder-stats />

      <v-divider />
    </template>

    <v-card-text v-if="isOwner">
      <speed-and-flow-adjust />
      <pressure-advance-adjust v-if="showPressureAdvance" />
    </v-card-text>

    <extruder-steppers v-if="isOwner" />
  </div>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import AuthMixin from '@/mixins/auth'
import ToolheadMixin from '@/mixins/toolhead'
import ToolheadControlCross from './ToolheadControlCross.vue'
import ToolheadControlBars from './ToolheadControlBars.vue'
import ToolheadControlCircle from './ToolheadControlCircle.vue'
import ExtruderMoves from './ExtruderMoves.vue'
import ExtruderSelection from './ExtruderSelection.vue'
import ToolheadPosition from './ToolheadPosition.vue'
import ZHeightAdjust from './ZHeightAdjust.vue'
import SpeedAndFlowAdjust from './SpeedAndFlowAdjust.vue'
import PressureAdvanceAdjust from './PressureAdvanceAdjust.vue'
import ExtruderStats from './ExtruderStats.vue'
import ExtruderSteppers from './ExtruderSteppers.vue'
import ToolChangeCommands from './ToolChangeCommands.vue'
import type { ToolheadControlStyle } from '@/store/config/types'

@Component({
  components: {
    ToolheadControlCross,
    ToolheadControlBars,
    ToolheadControlCircle,
    ExtruderMoves,
    ExtruderSelection,
    ToolheadPosition,
    ZHeightAdjust,
    SpeedAndFlowAdjust,
    PressureAdvanceAdjust,
    ExtruderStats,
    ExtruderSteppers,
    ToolChangeCommands
  }
})
export default class Toolhead extends Mixins(StateMixin, AuthMixin, ToolheadMixin) {
  @Prop({ type: Boolean, default: false })
  readonly guestMode!: boolean

  get showPressureAdvance (): boolean {
    return this.activeExtruder?.pressure_advance !== undefined
  }

  get toolheadControlStyle (): ToolheadControlStyle {
    return this.$typedState.config.uiSettings.general.toolheadControlStyle
  }
}
</script>

<style type="scss" scoped>
  .controls-wrapper {
    min-width: 380px !important;
    max-width: 450px !important;
  }

  /* Guest role: block toolhead interactions (RBAC uses role only once authenticated). */
  .guest-toolhead-disabled ::v-deep button,
  .guest-toolhead-disabled ::v-deep .v-btn,
  .guest-toolhead-disabled ::v-deep input,
  .guest-toolhead-disabled ::v-deep textarea,
  .guest-toolhead-disabled ::v-deep .v-slider,
  .guest-toolhead-disabled ::v-deep .v-list-item,
  .guest-toolhead-disabled ::v-deep .v-chip--clickable {
    pointer-events: none;
    opacity: 0.55;
  }
</style>

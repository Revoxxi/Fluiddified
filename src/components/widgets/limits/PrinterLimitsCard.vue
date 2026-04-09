<template>
  <collapsable-card
    :title="$t('app.general.title.limits')"
    icon="$limits"
    draggable
    layout-path="dashboard.printer-limits-card"
  >
    <printer-limits :readonly="!isOwner" />
  </collapsable-card>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import PrinterLimits from '@/components/widgets/limits/PrinterLimits.vue'
import AuthMixin from '@/mixins/auth'

@Component({
  components: {
    PrinterLimits
  }
})
export default class PrinterLimitsCard extends Mixins(AuthMixin) {}
</script>

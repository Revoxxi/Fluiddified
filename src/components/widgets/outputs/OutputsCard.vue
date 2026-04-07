<template>
  <collapsable-card
    :title="$t('app.general.title.fans_outputs')"
    icon="$motion"
    draggable
    layout-path="dashboard.outputs-card"
    menu-breakpoint="lg"
  >
    <outputs :readonly="guestMode" />
  </collapsable-card>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import Outputs from '@/components/widgets/outputs/Outputs.vue'

@Component({
  components: {
    Outputs
  }
})
export default class OutputsCard extends Vue {
  get guestMode (): boolean {
    return this.$typedGetters['auth/isGuest']
  }
}
</script>

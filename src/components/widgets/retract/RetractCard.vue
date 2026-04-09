<template>
  <collapsable-card
    :title="$t('app.general.title.retract')"
    icon="$retract"
    draggable
    layout-path="dashboard.retract-card"
  >
    <retract :readonly="!isOwner" />
  </collapsable-card>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import Retract from '@/components/widgets/retract/Retract.vue'
import AuthMixin from '@/mixins/auth'

@Component({
  components: {
    Retract
  }
})
export default class RetractCard extends Mixins(AuthMixin) {}
</script>

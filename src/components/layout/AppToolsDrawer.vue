<template>
  <v-navigation-drawer
    v-model="open"
    app
    right
    clipped
    temporary
    width="300"
    dense
  >
    <v-list
      v-if="socketConnected && uiSessionActive && !isGuest"
      dense
    >
      <v-subheader>{{ instanceName }}</v-subheader>
      <v-divider />
      <system-commands @click="open = false" />
    </v-list>

    <system-printers
      v-if="socketConnected && uiSessionActive && !isGuest"
      @click="open = false"
    />

    <system-layout
      v-if="socketConnected && uiSessionActive && !isGuest"
      @click="open = false"
    />
  </v-navigation-drawer>
</template>

<script lang="ts">
import { Component, Mixins, VModel } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import AuthMixin from '@/mixins/auth'

@Component({})
export default class AppToolsDrawer extends Mixins(StateMixin, AuthMixin) {
  @VModel({ type: Boolean })
  open?: boolean

  get instanceName (): string {
    return this.$typedState.config.uiSettings.general.instanceName
  }
}
</script>

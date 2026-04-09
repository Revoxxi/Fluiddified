<template>
  <collapsable-card
    :title="$t('app.general.title.jobs')"
    icon="$files"
    :draggable="!fullscreen"
    :collapsable="!fullscreen"
    layout-path="dashboard.jobs-card"
    :help-tooltip="$t('app.general.tooltip.file_browser_help')"
  >
    <template #menu>
      <app-btn
        v-if="!fullscreen && !guestMode"
        icon
        @click="$filters.routeTo({ name: 'jobs' })"
      >
        <v-icon dense>
          $fullScreen
        </v-icon>
      </app-btn>
    </template>

    <file-system
      v-if="fullscreen"
      roots="gcodes"
      name="jobs"
      bulk-actions
      :read-only-filesystem="filesystemReadOnly"
      class="full-screen"
    />

    <file-system
      v-else
      roots="gcodes"
      name="dashboard"
      dense
      :read-only-filesystem="filesystemReadOnly"
      class="partial-screen"
    />
  </collapsable-card>
</template>

<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import FileSystem from '@/components/widgets/filesystem/FileSystem.vue'
import AuthMixin from '@/mixins/auth'

@Component({
  components: {
    FileSystem
  }
})
export default class JobsCard extends Mixins(AuthMixin) {
  @Prop({ type: Boolean })
  readonly fullscreen?: boolean

  /** Operators and guests: no delete/move/upload; owners have full file actions. */
  get filesystemReadOnly (): boolean {
    return !this.isOwner
  }

  get guestMode (): boolean {
    return this.isGuest
  }
}
</script>

<style lang="scss" scoped>
  .full-screen {
    max-height: calc(100vh - 190px);
    max-height: calc(100svh - 190px);
  }

  .partial-screen {
    height: 400px;
  }
</style>

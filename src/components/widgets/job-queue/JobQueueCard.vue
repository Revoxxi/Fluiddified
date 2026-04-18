<template>
  <collapsable-card
    v-if="showCard"
    :title="$t('app.general.title.job_queue')"
    icon="$jobQueue"
    :draggable="!fullscreen"
    :collapsable="!fullscreen"
    layout-path="dashboard.job-queue-card"
    :help-tooltip="$t('app.job_queue.tooltip.help')"
  >
    <template
      v-if="!guestMode"
      #menu
    >
      <app-btn-collapse-group :collapsed="narrow">
        <app-btn
          v-if="['ready','loading','starting'].includes(queueState)"
          small
          class="me-1 my-1"
          @click="handlePause"
        >
          <v-icon
            small
            left
          >
            $pause
          </v-icon>
          <span>{{ $t('app.general.btn.pause') }}</span>
        </app-btn>
        <app-btn
          v-else-if="queueState === 'paused'"
          small
          class="my-1"
          :class="{
            'me-1': !fullscreen
          }"
          @click="handleResume"
        >
          <v-icon
            small
            left
          >
            $resume
          </v-icon>
          <span>{{ $t('app.general.btn.resume') }}</span>
        </app-btn>
      </app-btn-collapse-group>

      <app-btn
        v-if="!fullscreen"
        icon
        @click="$filters.routeTo({ name: 'jobs' })"
      >
        <v-icon dense>
          $fullScreen
        </v-icon>
      </app-btn>
    </template>

    <job-queue
      :dense="!fullscreen"
      :bulk-actions="fullscreen && !guestMode"
      :guest-mode="guestMode"
      :class="{
        'full-screen': fullscreen,
        'partial-screen': !fullscreen
      }"
    />
  </collapsable-card>
</template>

<script lang="ts">
import { Component, Prop, Mixins } from 'vue-property-decorator'
import JobQueue from '@/components/widgets/job-queue/JobQueue.vue'
import { SocketActions } from '@/api/socketActions'
import AuthMixin from '@/mixins/auth'
import StateMixin from '@/mixins/state'

@Component({
  components: {
    JobQueue
  }
})
export default class JobQueueCard extends Mixins(AuthMixin, StateMixin) {
  @Prop({ type: Boolean })
  readonly narrow?: boolean

  @Prop({ type: Boolean })
  readonly fullscreen?: boolean

  get guestMode (): boolean {
    return this.isGuest
  }

  /** Hide on the dashboard when the queue is empty and the printer is idle (still show while printing/paused or on Jobs fullscreen). */
  get showCard (): boolean {
    if (this.fullscreen) return true
    if (this.$typedState.config.layoutMode) return true
    if (this.$typedState.jobQueue.queuedJobs.length > 0) return true
    return this.printerPrinting || this.printerPaused
  }

  get queueState (): Moonraker.JobQueue.QueueState {
    return this.$typedState.jobQueue.queueState
  }

  handlePause () {
    SocketActions.serverJobQueuePause()
  }

  handleResume () {
    SocketActions.serverJobQueueStart()
  }
}
</script>

<style lang="scss" scoped>
  .full-screen {
    max-height: calc(100vh - 190px);
    max-height: calc(100svh - 190px);
  }

  .partial-screen {
    max-height: 400px;
  }
</style>

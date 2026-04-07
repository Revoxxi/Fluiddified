<template>
  <div>
    <v-subheader id="achievements">
      {{ $t('app.achievements.title.achievements') }}
    </v-subheader>
    <v-card
      :elevation="5"
      dense
      class="mb-4"
    >
      <app-setting :title="$t('app.setting.label.enable')">
        <v-switch
          :input-value="enabled"
          hide-details
          class="mt-0"
          @change="setEnabled"
        />
      </app-setting>

      <v-divider />

      <app-setting title="Notifications">
        <v-switch
          :input-value="notificationsEnabled"
          :disabled="!enabled"
          hide-details
          class="mt-0"
          @change="setNotificationsEnabled"
        />
      </app-setting>

      <v-divider />

      <app-setting title="Stats">
        <span class="text-body-2 text--secondary mr-4">
          {{ totalPoints }} pts
        </span>
        <span class="text-body-2 text--secondary mr-4">
          {{ unlockedCount }}/{{ totalCount }} unlocked
        </span>
        <span class="text-body-2 text--secondary">
          {{ completionPct }}%
        </span>
      </app-setting>

      <v-divider />

      <app-setting title="Retroactive Scan">
        <app-btn
          outlined
          small
          color="primary"
          :disabled="!enabled || scanning"
          :loading="scanning"
          @click="runRetroactiveScan"
        >
          Scan History
        </app-btn>
      </app-setting>

      <v-divider />

      <app-setting title="Reset">
        <app-btn
          outlined
          small
          color="error"
          :disabled="!enabled"
          @click="handleReset"
        >
          Reset All
        </app-btn>
      </app-setting>
    </v-card>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import { achievementDefinitions } from '@/components/widgets/achievements/definitions'

@Component({})
export default class AchievementSettings extends Vue {
  scanning = false

  get enabled (): boolean {
    return this.$typedState.achievements.enabled
  }

  get notificationsEnabled (): boolean {
    return this.$typedState.achievements.notificationsEnabled
  }

  get totalPoints (): number {
    return this.$typedGetters['achievements/getTotalPoints']
  }

  get unlockedCount (): number {
    return this.$typedGetters['achievements/getUnlockedIds'].length
  }

  get totalCount (): number {
    return achievementDefinitions.length
  }

  get completionPct (): number {
    return this.$typedGetters['achievements/getCompletionPercentage']
  }

  setEnabled (val: boolean) {
    this.$typedDispatch('achievements/setEnabled', val)
  }

  setNotificationsEnabled (val: boolean) {
    this.$typedDispatch('achievements/setNotificationsEnabled', val)
  }

  async runRetroactiveScan () {
    this.scanning = true
    try {
      await this.$typedDispatch('achievements/retroactiveScan')
    } finally {
      this.scanning = false
    }
  }

  async handleReset () {
    const result = await this.$confirm(
      'This will reset all achievement progress. Are you sure?',
      { title: 'Reset Achievements', color: 'card-heading', icon: '$error' }
    )

    if (result) {
      const confirm2 = await this.$confirm(
        'This action cannot be undone. Confirm reset?',
        { title: 'Final Confirmation', color: 'error', icon: '$error' }
      )

      if (confirm2) {
        await this.$typedDispatch('achievements/resetAndSave')
      }
    }
  }
}
</script>

<template>
  <v-list-item
    :class="{ 'achievement-unlocked': isUnlocked }"
    @click="$emit('click')"
  >
    <v-list-item-avatar size="32">
      <v-icon :color="rarityColor">
        {{ displayIcon }}
      </v-icon>
    </v-list-item-avatar>

    <v-list-item-content>
      <v-list-item-title class="d-flex align-center">
        <span>{{ displayName }}</span>
        <achievement-rarity-badge
          :rarity="definition.rarity"
          class="ml-2"
        />
        <span
          v-if="tierLabel"
          class="ml-1 text-caption text--secondary"
        >
          {{ tierLabel }}
        </span>
      </v-list-item-title>
      <v-list-item-subtitle
        v-if="definition.calibrationGuide"
        class="primary--text font-weight-medium"
      >
        Open for calibration guide
      </v-list-item-subtitle>
      <v-list-item-subtitle>
        {{ displayDescription }}
      </v-list-item-subtitle>
      <v-progress-linear
        v-if="showProgress"
        :value="progressPercent"
        height="4"
        :color="rarityColor"
        class="mt-1"
        rounded
      />
    </v-list-item-content>

    <v-list-item-action v-if="isUnlocked">
      <v-icon
        small
        color="success"
      >
        $check
      </v-icon>
    </v-list-item-action>
  </v-list-item>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import type { AchievementDefinition, AchievementProgress, AchievementRarity } from '@/types/achievement'
import { formatAchievementDescription } from '@/util/achievementDisplay'
import {
  calibrationCompletedStepCount,
  DEFAULT_CALIBRATION_GUIDE_CONFIG
} from '@/util/calibrationGuideRuntime'
import AchievementRarityBadge from './AchievementRarityBadge.vue'

const rarityColors: Record<AchievementRarity, string> = {
  common: 'grey',
  uncommon: 'success',
  rare: 'info',
  epic: 'purple',
  legendary: 'amber darken-2'
}

@Component({
  components: {
    AchievementRarityBadge
  }
})
export default class AchievementItem extends Vue {
  @Prop({ type: Object, required: true })
  readonly definition!: AchievementDefinition

  @Prop({ type: Object, default: undefined })
  readonly progress?: AchievementProgress

  get isUnlocked (): boolean {
    if (this.definition.tiers) {
      return (this.progress?.tierReached ?? 0) > 0
    }
    return this.progress?.unlockedAt != null
  }

  get displayName (): string {
    if (this.definition.hidden && !this.isUnlocked) return '?'
    return this.definition.name
  }

  get displayDescription (): string {
    if (this.definition.hidden && !this.isUnlocked) return '?'
    return formatAchievementDescription(this.definition, this.progress)
  }

  get displayIcon (): string {
    if (this.definition.hidden && !this.isUnlocked) return '$help'
    return this.definition.icon
  }

  get tierLabel (): string | null {
    if (this.definition.hidden && !this.isUnlocked) {
      return this.definition.tiers ? '?' : null
    }
    if (!this.definition.tiers || !this.progress) return null
    const reached = this.progress.tierReached
    const total = this.definition.tiers.length
    return `Tier ${reached}/${total}`
  }

  get showProgress (): boolean {
    if (this.definition.hidden && !this.isUnlocked) return false
    if (this.definition.calibrationGuide && !this.isUnlocked) {
      return true
    }
    return !!(this.definition.tiers && this.progress && this.progress.current > 0)
  }

  get progressPercent (): number {
    if (this.definition.calibrationGuide) {
      const cfg = this.progress?.calibrationGuideConfig ?? DEFAULT_CALIBRATION_GUIDE_CONFIG
      const { done, total } = calibrationCompletedStepCount(
        this.definition.calibrationGuide.steps,
        cfg,
        this.progress?.calibrationStepsComplete
      )
      if (total === 0 || this.progress?.calibrationGuideConfigSaved !== true) return 0
      return Math.min(100, (done / total) * 100)
    }
    if (!this.definition.tiers || !this.progress) return 0
    const reached = this.progress.tierReached
    const tiers = this.definition.tiers
    if (reached >= tiers.length) return 100
    const target = tiers[reached]
    const prev = reached > 0 ? tiers[reached - 1] : 0
    const range = target - prev
    if (range <= 0) return 0
    return Math.min(100, ((this.progress.current - prev) / range) * 100)
  }

  get rarityColor (): string {
    return rarityColors[this.definition.rarity]
  }
}
</script>

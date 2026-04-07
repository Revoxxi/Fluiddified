<template>
  <v-dialog
    :value="value"
    max-width="420"
    @input="$emit('input', $event)"
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon
          :color="rarityColor"
          class="mr-2"
        >
          {{ displayIcon }}
        </v-icon>
        {{ displayTitle }}
        <v-spacer />
        <v-chip
          v-if="secretLocked"
          x-small
          label
          color="grey"
          text-color="white"
        >
          ?
        </v-chip>
        <achievement-rarity-badge
          v-else
          :rarity="definition.rarity"
        />
      </v-card-title>

      <v-card-text>
        <p>{{ displayDescription }}</p>

        <div
          v-if="definition.unlockMessage && isUnlocked"
          class="text-body-2 font-italic mb-3"
        >
          "{{ definition.unlockMessage }}"
        </div>

        <div
          v-if="definition.tiers && secretLocked"
          class="text-body-2 mb-3"
        >
          ?
        </div>

        <div
          v-else-if="definition.tiers"
          class="mb-3"
        >
          <div class="text-subtitle-2 mb-1">
            Progress
          </div>
          <div
            v-for="(tier, i) in definition.tiers"
            :key="i"
            class="d-flex align-center mb-1"
          >
            <v-icon
              x-small
              :color="tierReached(i) ? 'success' : 'grey'"
              class="mr-1"
            >
              {{ tierReached(i) ? '$check' : '$circle' }}
            </v-icon>
            <span class="text-body-2 mr-2">
              Tier {{ i + 1 }}: {{ tier }} {{ definition.unit || '' }}
            </span>
            <span
              v-if="tierReached(i) && tierTimestamp(i)"
              class="text-caption text--secondary"
            >
              {{ formatDate(tierTimestamp(i)) }}
            </span>
          </div>
          <v-progress-linear
            :value="overallProgress"
            height="6"
            :color="rarityColor"
            class="mt-2"
            rounded
          />
          <div class="text-caption text--secondary mt-1">
            {{ currentValue }} / {{ nextTarget }} {{ definition.unit || '' }}
          </div>
        </div>

        <div
          v-else-if="isUnlocked"
          class="text-body-2"
        >
          <v-icon
            small
            color="success"
            class="mr-1"
          >
            $check
          </v-icon>
          Unlocked {{ formatDate(progress?.unlockedAt) }}
        </div>
        <div
          v-else-if="!secretLocked"
          class="text-body-2 text--secondary"
        >
          Not yet unlocked
        </div>

        <div class="text-caption text--secondary mt-2">
          {{ secretLocked ? '? • ?' : `${definition.points} points • ${definition.category}` }}
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <app-btn
          text
          @click="$emit('input', false)"
        >
          {{ $t('app.general.btn.close') }}
        </app-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import type { AchievementDefinition, AchievementProgress, AchievementRarity } from '@/types/achievement'
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
export default class AchievementDetailDialog extends Vue {
  @Prop({ type: Boolean })
  readonly value!: boolean

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

  /** Hidden achievements stay secret in the dialog until unlocked. */
  get secretLocked (): boolean {
    return !!(this.definition.hidden && !this.isUnlocked)
  }

  get displayTitle (): string {
    return this.secretLocked ? '?' : this.definition.name
  }

  get displayDescription (): string {
    return this.secretLocked ? '?' : this.definition.description
  }

  get displayIcon (): string {
    return this.secretLocked ? '$help' : this.definition.icon
  }

  get rarityColor (): string {
    return rarityColors[this.definition.rarity]
  }

  get currentValue (): number {
    return this.progress?.current ?? 0
  }

  get nextTarget (): number {
    if (!this.definition.tiers) return 0
    const reached = this.progress?.tierReached ?? 0
    if (reached >= this.definition.tiers.length) {
      return this.definition.tiers[this.definition.tiers.length - 1]
    }
    return this.definition.tiers[reached]
  }

  get overallProgress (): number {
    if (!this.definition.tiers) return 0
    const reached = this.progress?.tierReached ?? 0
    const tiers = this.definition.tiers
    if (reached >= tiers.length) return 100
    const target = tiers[reached]
    const prev = reached > 0 ? tiers[reached - 1] : 0
    const range = target - prev
    if (range <= 0) return 0
    return Math.min(100, ((this.currentValue - prev) / range) * 100)
  }

  tierReached (i: number): boolean {
    return (this.progress?.tierReached ?? 0) > i
  }

  tierTimestamp (i: number): number | undefined {
    return this.progress?.tierUnlockedAt?.[i]
  }

  formatDate (ts?: number): string {
    if (!ts) return ''
    return new Date(ts).toLocaleDateString()
  }
}
</script>

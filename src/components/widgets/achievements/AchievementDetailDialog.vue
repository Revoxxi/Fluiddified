<template>
  <v-dialog
    :value="value"
    :max-width="dialogMaxWidth"
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

      <v-card-text :class="{ 'achievement-detail-dialog__text--guide': showCalibrationGuide }">
        <p>{{ displayDescription }}</p>

        <div
          v-if="definition.unlockMessage && isUnlocked"
          class="text-body-2 font-italic mb-3"
        >
          "{{ definition.unlockMessage }}"
        </div>

        <div
          v-if="showCalibrationGuide"
          class="achievement-detail-dialog__guide mb-4"
        >
          <div
            v-if="isUnlocked"
            class="text-body-2 mb-3"
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

          <div class="text-subtitle-2 mb-1">
            Extruder setup
          </div>
          <p class="text-caption text--secondary mb-2">
            Pick your setup for example starting G-code (still verify on your hardware).
          </p>
          <v-radio-group
            :value="extruderMode"
            row
            hide-details
            dense
            class="mt-0"
            @change="onExtruderModeChange"
          >
            <v-radio
              label="Direct drive"
              value="direct"
            />
            <v-radio
              label="Bowden"
              value="bowden"
            />
          </v-radio-group>

          <v-divider class="my-3" />

          <div class="achievement-detail-dialog__steps">
            <div
              v-for="(step, idx) in guideSteps"
              :key="idx"
              class="mb-4"
            >
              <div class="d-flex align-center mb-1">
                <v-icon
                  x-small
                  :color="calibrationStepDone(idx) ? 'success' : 'grey'"
                  class="mr-2"
                >
                  {{ calibrationStepDone(idx) ? '$check' : '$circle' }}
                </v-icon>
                <span class="text-subtitle-2">{{ idx + 1 }}. {{ step.title }}</span>
              </div>
              <p class="text-body-2 mb-2">
                {{ step.summary }}
              </p>
              <p
                v-if="step.methodTip"
                class="text-caption text--secondary font-italic mb-2"
              >
                {{ step.methodTip }}
              </p>
              <v-btn
                small
                outlined
                color="primary"
                class="mb-2"
                :href="step.docUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                Klipper documentation
                <v-icon
                  right
                  x-small
                >
                  $openInNew
                </v-icon>
              </v-btn>
              <div class="text-caption text--secondary mb-1">
                Example G-code
              </div>
              <div
                v-for="(line, li) in suggestedLines(step)"
                :key="li"
                class="d-flex align-start mb-1"
              >
                <code class="achievement-detail-dialog__code flex-grow-1">{{ line }}</code>
                <v-btn
                  v-if="copyableGcodeLine(line)"
                  icon
                  x-small
                  class="ml-1 flex-shrink-0"
                  :aria-label="'Copy'"
                  @click="copyGcodeLine(line)"
                >
                  <v-icon x-small>
                    {{ $globals.Icons.contentCopy }}
                  </v-icon>
                </v-btn>
              </div>
            </div>
          </div>
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
          v-else-if="isUnlocked && !definition.calibrationGuide"
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
          v-else-if="!secretLocked && !definition.calibrationGuide"
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
import type {
  AchievementDefinition,
  AchievementProgress,
  AchievementRarity,
  CalibrationExtruderMode,
  CalibrationGuideStep
} from '@/types/achievement'
import { EventBus } from '@/eventBus'
import { formatAchievementDescription } from '@/util/achievementDisplay'
import clipboardCopy from '@/util/clipboard-copy'
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
    return this.secretLocked
      ? '?'
      : formatAchievementDescription(this.definition, this.progress)
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

  get dialogMaxWidth (): number {
    return this.definition.calibrationGuide != null ? 560 : 420
  }

  get showCalibrationGuide (): boolean {
    return !this.secretLocked && this.definition.calibrationGuide != null
  }

  get guideSteps (): CalibrationGuideStep[] {
    return this.definition.calibrationGuide?.steps ?? []
  }

  get extruderMode (): CalibrationExtruderMode {
    return this.progress?.calibrationExtruderMode ?? 'direct'
  }

  calibrationStepDone (idx: number): boolean {
    return this.progress?.calibrationStepsComplete?.includes(idx) ?? false
  }

  suggestedLines (step: CalibrationGuideStep): string[] {
    return this.extruderMode === 'bowden'
      ? step.suggestedCommands.bowden
      : step.suggestedCommands.direct
  }

  copyableGcodeLine (line: string): boolean {
    const t = line.trim()
    return t.length > 0 && !t.startsWith(';')
  }

  async copyGcodeLine (line: string) {
    const ok = await clipboardCopy(line, this.$el)
    if (ok) {
      EventBus.$emit('Copied to clipboard', { type: 'success', timeout: 2000 })
    }
  }

  onExtruderModeChange (mode: string) {
    if (mode !== 'direct' && mode !== 'bowden') return
    Promise.resolve(
      this.$typedDispatch('achievements/setCalibrationExtruderMode', {
        id: this.definition.id,
        mode
      })
    ).catch(() => undefined)
  }
}
</script>

<style lang="scss" scoped>
  .achievement-detail-dialog__text--guide {
    max-height: min(72vh, 640px);
    overflow-y: auto;
  }

  .achievement-detail-dialog__code {
    display: block;
    font-size: 0.75rem;
    padding: 4px 6px;
    border-radius: 4px;
    background: rgba(127, 127, 127, 0.12);
    word-break: break-word;
    white-space: pre-wrap;
  }
</style>

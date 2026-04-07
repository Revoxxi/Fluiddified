<template>
  <collapsable-card
    :title="$t('app.achievements.title.achievements')"
    icon="$trophy"
    draggable
    layout-path="dashboard.achievements-card"
  >
    <template #menu>
      <v-chip
        small
        class="mr-2"
      >
        {{ totalPoints }} pts
      </v-chip>
      <v-chip small>
        {{ unlockedCount }}/{{ totalCount }}
      </v-chip>
    </template>

    <div
      ref="achievementsScroll"
      class="achievements-card__scroll"
      @scroll.passive="onAchievementsScroll"
    >
      <v-tabs
        v-model="activeTab"
        show-arrows
        dense
        class="px-2"
      >
        <v-tab
          v-for="cat in categories"
          :key="cat.value"
        >
          {{ cat.label }}
        </v-tab>
      </v-tabs>

      <v-list
        dense
        class="py-0"
      >
        <achievement-item
          v-for="achievement in filteredAchievements"
          :key="achievement.id"
          :definition="achievement"
          :progress="getProgress(achievement.id)"
          @click="openDetail(achievement)"
        />
        <v-list-item v-if="filteredAchievements.length === 0">
          <v-list-item-content class="text-center text--disabled">
            No achievements in this category
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </div>

    <achievement-detail-dialog
      v-if="detailDialog.open"
      v-model="detailDialog.open"
      :definition="detailDialog.definition"
      :progress="detailDialog.progress"
    />
  </collapsable-card>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import type { AchievementCategory, AchievementDefinition, AchievementProgress } from '@/types/achievement'
import { achievementDefinitions } from './definitions'
import AchievementItem from './AchievementItem.vue'
import AchievementDetailDialog from './AchievementDetailDialog.vue'

const categoryLabels: Array<{ label: string, value: AchievementCategory | null }> = [
  { label: 'All', value: null },
  { label: 'Volume', value: 'volume' },
  { label: 'Consistency', value: 'consistency' },
  { label: 'Characteristics', value: 'characteristics' },
  { label: 'Timing', value: 'timing' },
  { label: 'Klipper', value: 'klipper' },
  { label: 'Exploration', value: 'exploration' },
  { label: 'Thermal', value: 'thermal' },
  { label: 'Hidden', value: 'hidden' }
]

@Component({
  components: {
    AchievementItem,
    AchievementDetailDialog
  }
})
export default class AchievementsCard extends Vue {
  activeTab = 0

  detailDialog: {
    open: boolean
    definition: AchievementDefinition | null
    progress: AchievementProgress | undefined
  } = {
      open: false,
      definition: null,
      progress: undefined
    }

  get categories () {
    return categoryLabels
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

  get filteredAchievements (): AchievementDefinition[] {
    const cat = this.categories[this.activeTab]?.value ?? null
    let defs = achievementDefinitions

    if (cat) {
      defs = defs.filter(d => d.category === cat)
    }

    return defs.map(d => {
      if (d.hidden && !this.isAchievementUnlocked(d)) {
        return { ...d }
      }
      return d
    })
  }

  getProgress (id: string): AchievementProgress | undefined {
    return this.$typedGetters['achievements/getProgressById'](id)
  }

  openDetail (achievement: AchievementDefinition) {
    this.detailDialog = {
      open: true,
      definition: achievement,
      progress: this.getProgress(achievement.id)
    }
  }

  onAchievementsScroll (e: Event) {
    const el = e.target as HTMLElement
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 10) {
      Promise.resolve(this.$typedDispatch('achievements/onScrollAchievementsListEnd', undefined, { root: true }))
        .catch(() => undefined)
    }
  }

  private isAchievementUnlocked (def: AchievementDefinition): boolean {
    const progress = this.getProgress(def.id)
    if (def.tiers) {
      return (progress?.tierReached ?? 0) > 0
    }
    return progress?.unlockedAt != null
  }
}
</script>

<style lang="scss" scoped>
  .achievements-card__scroll {
    max-height: min(52vh, 400px);
    overflow-x: hidden;
    overflow-y: auto;
  }
</style>

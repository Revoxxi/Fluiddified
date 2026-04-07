<template>
  <v-chip
    x-small
    :color="color"
    :text-color="textColor"
    label
  >
    {{ label }}
  </v-chip>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import type { AchievementRarity } from '@/types/achievement'

const rarityColors: Record<AchievementRarity, string> = {
  common: 'grey',
  uncommon: 'success',
  rare: 'info',
  epic: 'purple',
  legendary: 'amber darken-2'
}

@Component
export default class AchievementRarityBadge extends Vue {
  @Prop({ type: String, required: true })
  readonly rarity!: AchievementRarity

  get label (): string {
    return this.rarity.charAt(0).toUpperCase() + this.rarity.slice(1)
  }

  get color (): string {
    return rarityColors[this.rarity]
  }

  get textColor (): string {
    return this.rarity === 'legendary' ? 'black' : 'white'
  }
}
</script>

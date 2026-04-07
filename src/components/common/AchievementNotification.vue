<template>
  <v-dialog
    v-model="open"
    :max-width="520"
    content-class="achievement-celebration-dialog"
    :overlay-opacity="0.78"
    @click:outside="close"
  >
    <v-card
      class="achievement-celebration-card"
      :class="[`achievement-celebration-card--${achievement.rarity}`]"
    >
      <div
        class="achievement-celebration-card__rays"
        aria-hidden="true"
      />

      <div
        class="achievement-celebration-card__confetti"
        aria-hidden="true"
      >
        <i
          v-for="n in 16"
          :key="n"
          class="achievement-celebration-card__confetti-piece"
        />
      </div>

      <v-btn
        icon
        small
        absolute
        top
        right
        class="mt-2 mr-2"
        :aria-label="$t('app.general.btn.close')"
        @click="close"
      >
        <v-icon small>
          {{ closeIcon }}
        </v-icon>
      </v-btn>

      <v-card-text class="text-center pa-8 pa-sm-10 position-relative">
        <div
          class="achievement-celebration-card__icon-wrap"
          :class="`achievement-celebration-card__icon-wrap--${achievement.rarity}`"
        >
          <v-icon
            size="80"
            :color="accentColor"
          >
            {{ displayIcon }}
          </v-icon>
        </div>

        <div class="text-overline text--secondary mb-1">
          {{ $t('app.achievements.toast.unlocked') }}
        </div>

        <h2 class="text-h5 text-sm-h4 font-weight-bold mb-2">
          {{ achievement.name }}
        </h2>

        <div
          v-if="achievement.tierLabel"
          class="text-caption text--secondary mb-2"
        >
          {{ achievement.tierLabel }}
        </div>

        <p class="text-body-1 mb-4">
          {{ achievement.description }}
        </p>

        <div class="d-flex align-center justify-center flex-wrap">
          <v-chip
            small
            label
            class="mr-2 mb-2"
            :color="accentColor"
            text-color="white"
          >
            {{ rarityLabel }}
          </v-chip>
          <span class="text-subtitle-2 text--secondary mb-2">
            +{{ achievement.points }} {{ $t('app.achievements.toast.points') }}
          </span>
        </div>

        <v-btn
          color="primary"
          class="mt-2"
          depressed
          @click="close"
        >
          {{ $t('app.general.btn.close') }}
        </v-btn>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import type { AchievementToastPayload } from '@/types'
import { Icons } from '@/globals'
import { Component, Prop, VModel, Vue, Watch } from 'vue-property-decorator'

@Component({})
export default class AchievementNotification extends Vue {
  @VModel({ type: Boolean })
  open?: boolean

  @Prop({ type: Object, required: true })
  readonly achievement!: AchievementToastPayload

  @Prop({ type: Number, default: 8000 })
  readonly timeout!: number

  private closeTimerId: ReturnType<typeof setTimeout> | null = null

  readonly closeIcon = Icons.close

  get displayIcon (): string {
    return this.achievement.icon ?? '$trophy'
  }

  get accentColor (): string {
    const m: Record<AchievementToastPayload['rarity'], string> = {
      common: 'grey',
      uncommon: 'success',
      rare: 'info',
      epic: 'deep-purple',
      legendary: 'amber darken-2'
    }
    return m[this.achievement.rarity] ?? 'primary'
  }

  get rarityLabel (): string {
    return this.achievement.rarity.charAt(0).toUpperCase() + this.achievement.rarity.slice(1)
  }

  @Watch('open')
  onOpenChanged (isOpen: boolean | undefined): void {
    this.clearCloseTimer()
    if (isOpen) {
      this.closeTimerId = window.setTimeout(() => {
        this.open = false
      }, this.timeout)
    }
  }

  beforeDestroy (): void {
    this.clearCloseTimer()
  }

  close (): void {
    this.clearCloseTimer()
    this.open = false
  }

  private clearCloseTimer (): void {
    if (this.closeTimerId != null) {
      clearTimeout(this.closeTimerId)
      this.closeTimerId = null
    }
  }
}
</script>

<style lang="scss">
// Unscoped: v-dialog moves content to document body; scoped styles would not apply.
.achievement-celebration-dialog {
  box-shadow:
    0 8px 40px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(255, 255, 255, 0.06);
}

.achievement-celebration-card {
  position: relative;
  overflow: hidden;
  border-radius: 16px !important;
  animation: achievement-card-in 0.55s cubic-bezier(0.34, 1.45, 0.64, 1) both;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      transparent 40%,
      rgba(255, 255, 255, 0.12) 50%,
      transparent 60%
    );
    transform: translateX(-120%);
    animation: achievement-shine 2.2s ease-in-out 0.35s 1 both;
    pointer-events: none;
  }

  &__rays {
    position: absolute;
    width: 140%;
    height: 140%;
    left: -20%;
    top: -20%;
    background: conic-gradient(
      from 0deg,
      transparent 0deg,
      rgba(255, 255, 255, 0.04) 25deg,
      transparent 55deg,
      transparent 80deg,
      rgba(255, 255, 255, 0.06) 110deg,
      transparent 140deg
    );
    animation: achievement-rays-spin 14s linear infinite;
    pointer-events: none;
    opacity: 0.85;
  }

  &__confetti {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 48px;
    pointer-events: none;
  }

  &__confetti-piece {
    position: absolute;
    top: -8px;
    width: 7px;
    height: 11px;
    border-radius: 1px;
    opacity: 0;
    animation: achievement-confetti-fall 1.35s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  }

  @for $i from 1 through 16 {
    &__confetti-piece:nth-child(#{$i}) {
      left: 4% + $i * 5.5%;
      animation-delay: 0.05s + $i * 0.035s;
      background: hsl((30 + $i * 19) % 360, 88%, 58%);
      --ach-drift: if($i % 2 == 0, 28px, -32px) + ($i % 3) * 8px;
    }
  }

  &__icon-wrap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 112px;
    height: 112px;
    margin: 0 auto 20px;
    border-radius: 50%;
    animation: achievement-icon-pop 0.7s cubic-bezier(0.34, 1.55, 0.64, 1) 0.08s both;

    &--common {
      background: radial-gradient(circle at 30% 30%, rgba(158, 158, 158, 0.35), rgba(80, 80, 80, 0.15));
      box-shadow:
        0 0 0 3px rgba(158, 158, 158, 0.35),
        0 12px 28px rgba(0, 0, 0, 0.35);
    }

    &--uncommon {
      background: radial-gradient(circle at 30% 30%, rgba(129, 199, 132, 0.45), rgba(56, 142, 60, 0.2));
      box-shadow:
        0 0 0 3px rgba(76, 175, 80, 0.5),
        0 0 28px rgba(76, 175, 80, 0.35);
    }

    &--rare {
      background: radial-gradient(circle at 30% 30%, rgba(100, 181, 246, 0.45), rgba(25, 118, 210, 0.2));
      box-shadow:
        0 0 0 3px rgba(33, 150, 243, 0.5),
        0 0 32px rgba(33, 150, 243, 0.35);
    }

    &--epic {
      background: radial-gradient(circle at 30% 30%, rgba(186, 104, 200, 0.45), rgba(74, 20, 140, 0.25));
      box-shadow:
        0 0 0 3px rgba(156, 39, 176, 0.55),
        0 0 36px rgba(156, 39, 176, 0.4);
    }

    &--legendary {
      background: radial-gradient(circle at 30% 30%, rgba(255, 213, 79, 0.55), rgba(255, 152, 0, 0.3));
      box-shadow:
        0 0 0 3px rgba(255, 193, 7, 0.65),
        0 0 40px rgba(255, 193, 7, 0.45);
      animation:
        achievement-icon-pop 0.7s cubic-bezier(0.34, 1.55, 0.64, 1) 0.08s both,
        achievement-legendary-pulse 2s ease-in-out 0.85s infinite;
    }
  }

  &--common {
    border: 1px solid rgba(158, 158, 158, 0.35);
  }

  &--uncommon {
    border: 1px solid rgba(76, 175, 80, 0.45);
  }

  &--rare {
    border: 1px solid rgba(33, 150, 243, 0.45);
  }

  &--epic {
    border: 1px solid rgba(156, 39, 176, 0.45);
  }

  &--legendary {
    border: 1px solid rgba(255, 193, 7, 0.55);
  }
}

@keyframes achievement-card-in {
  from {
    opacity: 0;
    transform: scale(0.82) translateY(24px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes achievement-icon-pop {
  0% {
    opacity: 0;
    transform: scale(0.15) rotate(-18deg);
  }

  65% {
    opacity: 1;
    transform: scale(1.08) rotate(4deg);
  }

  80% {
    transform: scale(0.96) rotate(-2deg);
  }

  100% {
    transform: scale(1) rotate(0deg);
  }
}

@keyframes achievement-legendary-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 3px rgba(255, 193, 7, 0.65),
      0 0 40px rgba(255, 193, 7, 0.45);
  }

  50% {
    box-shadow:
      0 0 0 4px rgba(255, 193, 7, 0.85),
      0 0 52px rgba(255, 193, 7, 0.6);
  }
}

@keyframes achievement-shine {
  0% {
    transform: translateX(-120%);
  }

  100% {
    transform: translateX(120%);
  }
}

@keyframes achievement-rays-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes achievement-confetti-fall {
  0% {
    opacity: 1;
    transform: translateY(0) translateX(0) rotate(0deg);
  }

  100% {
    opacity: 0;
    transform: translateY(140px) translateX(var(--ach-drift, 0)) rotate(580deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .achievement-celebration-card {
    animation: none;

    &::after {
      display: none;
    }

    &__rays {
      animation: none;
      opacity: 0.35;
    }

    &__confetti-piece {
      display: none;
    }

    &__icon-wrap {
      animation: none !important;
    }
  }
}
</style>

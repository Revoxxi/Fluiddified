<template>
  <v-col
    v-bind="$attrs"
    v-on="$listeners"
  >
    <slot :narrow="narrow" />
  </v-col>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'

@Component({
  inheritAttrs: false
})
export default class AppObservedColumn extends Vue {
  observer: ResizeObserver | null = null
  narrow = false
  private narrowRaf: number | null = null

  updateNarrow (width: number) {
    this.narrow = width < 560
  }

  scheduleUpdateNarrow (width: number) {
    if (this.narrowRaf != null) {
      cancelAnimationFrame(this.narrowRaf)
    }
    this.narrowRaf = requestAnimationFrame(() => {
      this.narrowRaf = null
      this.updateNarrow(width)
    })
  }

  mounted () {
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(entries => {
        const lastEntry = entries[entries.length - 1]
        this.scheduleUpdateNarrow(lastEntry.contentRect.width)
      })

      this.observer.observe(this.$el)
    }

    this.updateNarrow(this.$el.clientWidth)
  }

  beforeDestroy () {
    if (this.narrowRaf != null) {
      cancelAnimationFrame(this.narrowRaf)
      this.narrowRaf = null
    }
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
  }
}
</script>

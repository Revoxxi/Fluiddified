<template>
  <v-row :dense="$vuetify.breakpoint.smAndDown">
    <template v-for="(container, containerIndex) in containers">
      <app-observed-column
        v-if="inLayout || hasCards(container)"
        :key="`container${containerIndex}`"
        cols="12"
        md="6"
        :lg="columnSpan"
        :class="{ 'drag': inLayout }"
      >
        <template #default="{ narrow }">
          <app-draggable
            v-model="containers[containerIndex]"
            class="list-group"
            :options="{
              group: 'dashboard',
              disabled: !inLayout,
            }"
            @end="handleUpdateLayout"
          >
            <template v-for="c in container">
              <component
                :is="c.id"
                v-if="inLayout || (c.enabled && !filtered(c))"
                :key="c.id"
                :narrow="narrow"
                class="mb-2 mb-md-4"
              />
            </template>
          </app-draggable>
        </template>
      </app-observed-column>
    </template>
  </v-row>
</template>

<script lang="ts">
import { Component, Mixins, Watch } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import { eventTargetIsContentEditable } from '@/util/event-helpers'
import { pluginRegistry } from '@/plugins/pluginRegistry'
import type { LayoutConfig, LayoutContainer } from '@/store/layout/types'

@Component({
  components: pluginRegistry.getComponentMap()
})
export default class Dashboard extends Mixins(StateMixin) {
  containers: Array<LayoutConfig[]> = []

  mounted () {
    this.onLayoutChange()
    window.addEventListener('keydown', this.handleKonamiKeydown, true)
  }

  beforeDestroy () {
    window.removeEventListener('keydown', this.handleKonamiKeydown, true)
  }

  handleKonamiKeydown (e: KeyboardEvent) {
    if (!this.$typedState.achievements.enabled) return
    if (eventTargetIsContentEditable(e)) return
    const t = e.target
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) {
      return
    }
    const k = e.key
    const allowed = (
      k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight' ||
      k === 'b' || k === 'B' || k === 'a' || k === 'A'
    )
    if (!allowed) return
    Promise.resolve(this.$typedDispatch('achievements/onKonamiKey', k, { root: true }))
      .catch(() => undefined)
  }

  get columnCount () {
    if (this.inLayout) return 4

    return this.containers.reduce((count, container) => +this.hasCards(container) + count, 0)
  }

  @Watch('columnCount')
  onColumnCount (value: number) {
    this.$typedCommit('config/setContainerColumnCount', value)
  }

  get columnSpan () {
    return 12 / this.columnCount
  }

  get inLayout (): boolean {
    return this.$typedState.config.layoutMode
  }

  get layout (): LayoutContainer | undefined {
    const layoutName: string = this.$typedGetters['layout/getSpecificLayoutName']

    return this.$typedGetters['layout/getLayout'](layoutName)
  }

  @Watch('layout')
  onLayoutChange () {
    const containers: Array<LayoutConfig[]> = []

    for (let index = 1; index <= 4; index++) {
      const container = this.layout?.[`container${index}`]

      if (container && container.length > 0) {
        containers.push(container)
      }
    }

    while (containers.length < 4) {
      containers.push([])
    }

    this.containers = containers.slice(0, 4)
  }

  handleUpdateLayout () {
    const name: string = this.$typedGetters['layout/getSpecificLayoutName']

    this.$typedDispatch('layout/onLayoutChange', {
      name,
      value: {
        container1: this.containers[0],
        container2: this.containers[1],
        container3: this.containers[2],
        container4: this.containers[3]
      }
    })
  }

  hasCards (container: LayoutConfig[]) {
    return container.some(card => card.enabled && !this.filtered(card))
  }

  filtered (item: LayoutConfig) {
    if (this.inLayout) return false
    if (this.$typedGetters['plugins/isDisabled'](item.id)) return true
    if (!pluginRegistry.isAvailable(item.id, this.$store)) return true
    return !item.enabled
  }
}
</script>

<style lang="scss" scoped>
@import '@/scss/draggable.scss';
</style>

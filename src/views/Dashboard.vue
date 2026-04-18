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
            <div
              v-for="c in container"
              :key="`${containerIndex}-${c.id}`"
              class="dashboard-card-wrap mb-2 mb-md-4"
            >
              <component
                :is="c.id"
                v-show="inLayout || (isDashboardCardVisible(c))"
                :narrow="narrow"
              />
            </div>
          </app-draggable>
        </template>
      </app-observed-column>
    </template>
  </v-row>
</template>

<script lang="ts">
import { Component, Mixins, Watch } from 'vue-property-decorator'
import { cloneDeep } from 'lodash-es'
import StateMixin from '@/mixins/state'
import { eventTargetIsContentEditable } from '@/util/event-helpers'
import { pluginRegistry } from '@/plugins/pluginRegistry'
import {
  DASHBOARD_CONTAINER_KEYS,
  mergePluginCardsIntoDashboard
} from '@/store/layout/mergePluginLayout'
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
    const layout = this.layout
    if (!layout) {
      this.containers = [[], [], [], []]
      return
    }

    const merged = mergePluginCardsIntoDashboard(cloneDeep(layout))
    const beforeIds = new Set(
      DASHBOARD_CONTAINER_KEYS.flatMap(k => layout[k] ?? []).map(c => c.id)
    )
    const hasNewIds = DASHBOARD_CONTAINER_KEYS.flatMap(k => merged[k] ?? []).some(
      c => !beforeIds.has(c.id)
    )
    if (hasNewIds) {
      const name: string = this.$typedGetters['layout/getSpecificLayoutName']
      this.$typedDispatch('layout/onLayoutChange', { name, value: merged })
      return
    }

    const containers: Array<LayoutConfig[]> = []
    for (let index = 1; index <= 4; index++) {
      containers.push(merged[`container${index}`] ?? [])
    }
    this.containers = containers
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
    return container.some(card => this.isDashboardCardVisible(card))
  }

  isDashboardCardVisible (card: LayoutConfig): boolean {
    if (this.filtered(card)) return false
    return card.enabled
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

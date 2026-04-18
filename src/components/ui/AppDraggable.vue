<template>
  <div class="app-draggable">
    <slot />
  </div>
</template>

<script lang="ts">
import { Component, Prop, VModel, Vue, Watch } from 'vue-property-decorator'
import Sortable from 'sortablejs'

const instanceKey = Symbol('instanceKey')

type TargetHtmlElement = HTMLElement & {
  [instanceKey]: AppDraggable | null
}

const isTargetHtmlElement = (element: HTMLElement): element is TargetHtmlElement => instanceKey in element

@Component({})
export default class AppDraggable extends Vue {
  @VModel({ type: Array, default: () => [] })
  items!: unknown[]

  @Prop({ type: Object })
  readonly options?: Sortable.Options

  @Prop({ type: String })
  readonly target?: string

  @Watch('options')
  onOptions (value: Sortable.Options) {
    if (this.sortable) {
      for (const prop in value) {
        if (prop === 'onEnd') continue
        const propAsOptionsKey = prop as keyof Sortable.Options

        this.sortable.option(propAsOptionsKey, value[propAsOptionsKey])
      }
    }
  }

  @Watch('target')
  onTarget () {
    this.dettach()
    this.attach()
  }

  sortable: Sortable | null = null

  handleStart (event: Sortable.SortableEvent) {
    this.$emit('start', event)
  }

  /**
   * Sortable may fire add/remove/update in an order that races with Vue's patch when we
   * replace arrays with spread. Sync model once on `onEnd` with in-place splices only.
   */
  private static syncSortableEnd (event: Sortable.SortableEvent): void {
    const marked = event as Sortable.SortableEvent & { _fluiddSynced?: boolean }
    if (marked._fluiddSynced) return
    marked._fluiddSynced = true

    const from = event.from as TargetHtmlElement
    const to = event.to as TargetHtmlElement
    const fromInst = from[instanceKey]
    const toInst = to[instanceKey]
    if (!fromInst || !toInst) return

    const oldIndex = event.oldIndex
    const newIndex = event.newIndex
    if (oldIndex == null || newIndex == null) return

    if (fromInst === toInst) {
      if (oldIndex === newIndex) return
      const list = fromInst.items as unknown[]
      const [moved] = list.splice(oldIndex, 1)
      list.splice(newIndex, 0, moved)
      fromInst.$emit('input', list)
    } else {
      const fromList = fromInst.items as unknown[]
      const toList = toInst.items as unknown[]
      const [moved] = fromList.splice(oldIndex, 1)
      toList.splice(newIndex, 0, moved)
      fromInst.$emit('input', fromList)
      toInst.$emit('input', toList)
    }

    toInst.$emit('end', event)
  }

  attach () {
    const targetElement = (
      this.target &&
      this.$el.querySelector<TargetHtmlElement>(this.target)
    ) || this.$el as TargetHtmlElement

    targetElement[instanceKey] = this

    const { onEnd: userOnEnd, ...restOptions } = this.options ?? {}
    const options: Sortable.Options = {
      animation: 200,
      handle: '.handle',
      ghostClass: 'app-draggable__ghost',
      chosenClass: 'app-draggable__chosen',
      ...restOptions,
      onStart: this.handleStart,
      onEnd: (evt: Sortable.SortableEvent) => {
        AppDraggable.syncSortableEnd(evt)
        if (typeof userOnEnd === 'function') {
          userOnEnd(evt)
        }
      }
    }

    this.sortable = Sortable.create(targetElement, options)
  }

  dettach () {
    const targetElement = this.sortable?.el

    if (targetElement && isTargetHtmlElement(targetElement)) {
      targetElement[instanceKey] = null
    }

    this.sortable?.destroy()
    this.sortable = null
  }

  mounted () {
    this.attach()
  }

  unmounted () {
    this.dettach()
  }
}
</script>

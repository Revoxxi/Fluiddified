<template>
  <div
    v-if="open && camera"
    class="floating-camera-panel elevation-8"
    :style="livePanelStyle"
  >
    <div
      class="floating-camera-panel__header"
      @mousedown.prevent="startDrag"
    >
      <span class="floating-camera-panel__title">
        {{ $tc('app.general.title.camera', 2) }}
      </span>
      <div
        class="floating-camera-panel__select-wrap"
        @mousedown.stop
      >
        <v-select
          :value="floating.webcamUid"
          :items="webcamItems"
          item-value="uid"
          :item-text="webcamLabel"
          dense
          hide-details
          outlined
          class="floating-camera-panel__select pt-0 mt-0"
          @input="patchFloating({ webcamUid: $event })"
        />
      </div>
      <app-btn
        icon
        small
        class="floating-camera-panel__close"
        @mousedown.stop
        @click.stop="patchFloating({ visible: false })"
      >
        <v-icon dense>
          $close
        </v-icon>
      </app-btn>
    </div>
    <div
      class="floating-camera-panel__body"
      :style="{ height: `${Math.max(bodyHeight, 120)}px` }"
    >
      <camera-item
        :camera="camera"
        class="floating-camera-panel__stream"
      />
    </div>
    <div
      class="floating-camera-panel__resize"
      @mousedown.prevent.stop="startResize"
    />
  </div>
</template>

<script lang="ts">
import { Component, Mixins, Watch } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import CameraItem from '@/components/widgets/camera/CameraItem.vue'
import type { FloatingCameraUiConfig } from '@/store/config/types'

@Component({
  components: { CameraItem }
})
export default class FloatingCameraPanel extends Mixins(StateMixin) {
  drag: { active: boolean; startX: number; startY: number; origX: number; origY: number } | null = null
  resize: { active: boolean; startX: number; startY: number; origW: number; origH: number; origX: number; origY: number } | null = null
  /** Local x/y/w/h while dragging — committed on mouseup */
  live: { x: number; y: number; width: number; height: number } | null = null

  get floating (): FloatingCameraUiConfig {
    return this.$typedState.config.uiSettings.general.floatingCamera
  }

  get open (): boolean {
    return this.floating.visible && this.webcamItems.length > 0
  }

  get webcamItems (): Moonraker.Webcam.Entry[] {
    return this.$typedGetters['webcams/getEnabledWebcams']
  }

  webcamLabel (w: Moonraker.Webcam.Entry) {
    return w.name || w.uid
  }

  get camera (): Moonraker.Webcam.Entry | undefined {
    const uid = this.floating.webcamUid
    if (uid) {
      const c = this.$typedGetters['webcams/getWebcamById'](uid)
      if (c) return c
    }
    return this.webcamItems[0]
  }

  get panelStyle (): Record<string, string> {
    const f = this.live ?? this.floating
    return {
      left: `${f.x}px`,
      top: `${f.y}px`,
      width: `${f.width}px`,
      height: `${f.height}px`,
      zIndex: '2500'
    }
  }

  get livePanelStyle (): Record<string, string> {
    return this.panelStyle
  }

  get bodyHeight (): number {
    const h = (this.live ?? this.floating).height
    return Math.max(120, h - 52)
  }

  mounted () {
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup', this.onMouseUp)
  }

  beforeDestroy () {
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup', this.onMouseUp)
  }

  patchFloating (partial: Partial<FloatingCameraUiConfig>) {
    const next: FloatingCameraUiConfig = { ...this.floating, ...partial }
    this.$typedDispatch('config/saveByPath', {
      path: 'uiSettings.general.floatingCamera',
      value: next,
      server: true
    })
  }

  @Watch('webcamItems', { immediate: true })
  ensureWebcamUid () {
    if (!this.webcamItems.length) return
    if (!this.floating.webcamUid || !this.$typedGetters['webcams/getWebcamById'](this.floating.webcamUid)) {
      this.patchFloating({ webcamUid: this.webcamItems[0].uid })
    }
  }

  startDrag (e: MouseEvent) {
    if (e.button !== 0) return
    const f = this.floating
    this.live = { x: f.x, y: f.y, width: f.width, height: f.height }
    this.drag = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: f.x,
      origY: f.y
    }
  }

  startResize (e: MouseEvent) {
    const f = this.floating
    this.live = { x: f.x, y: f.y, width: f.width, height: f.height }
    this.resize = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origW: f.width,
      origH: f.height,
      origX: f.x,
      origY: f.y
    }
  }

  onMouseMove (e: MouseEvent) {
    if (this.drag?.active && this.live) {
      const dx = e.clientX - this.drag.startX
      const dy = e.clientY - this.drag.startY
      this.live.x = Math.max(0, Math.min(window.innerWidth - 80, this.drag.origX + dx))
      this.live.y = Math.max(0, Math.min(window.innerHeight - 80, this.drag.origY + dy))
    }
    if (this.resize?.active && this.live) {
      const dx = e.clientX - this.resize.startX
      const dy = e.clientY - this.resize.startY
      this.live.width = Math.max(200, Math.min(window.innerWidth - 16, this.resize.origW + dx))
      this.live.height = Math.max(160, Math.min(window.innerHeight - 16, this.resize.origH + dy))
    }
  }

  onMouseUp () {
    if (this.drag?.active && this.live) {
      this.patchFloating({ x: this.live.x, y: this.live.y, width: this.live.width, height: this.live.height })
    }
    if (this.resize?.active && this.live) {
      this.patchFloating({ x: this.live.x, y: this.live.y, width: this.live.width, height: this.live.height })
    }
    if (this.drag?.active || this.resize?.active) {
      this.live = null
    }
    this.drag = null
    this.resize = null
  }
}
</script>

<style lang="scss" scoped>
.floating-camera-panel {
  position: fixed;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 4px;
  overflow: hidden;
  user-select: none;
  box-sizing: border-box;
}

.floating-camera-panel__header {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  cursor: grab;
  padding: 6px 8px;
  gap: 8px;
  min-height: 40px;
  /* Opaque bar — matches app surface so it does not show video through the title row */
  background: #212121;
  color: rgba(255, 255, 255, 0.87);
}

.theme--light .floating-camera-panel__header {
  background: #eeeeee;
  color: rgba(0, 0, 0, 0.87);
}

.floating-camera-panel__title {
  flex: 0 0 auto;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  padding-right: 4px;
}

.floating-camera-panel__select-wrap {
  flex: 1 1 auto;
  min-width: 96px;
  /* Stay beside the title — never span the full bar */
  max-width: min(280px, calc(100% - 5.5rem));
}

.floating-camera-panel__select {
  margin: 0;
  padding: 0;

  :deep(.v-input) {
    margin: 0;
    padding: 0;
    font-size: 0.8125rem;
  }

  :deep(.v-input__slot) {
    min-height: 32px !important;
    padding: 0 8px !important;
  }
}

.floating-camera-panel__close {
  flex: 0 0 auto;
}

.floating-camera-panel__body {
  position: relative;
  flex: 1;
  min-height: 120px;
}

.floating-camera-panel__stream {
  height: 100%;
}

.floating-camera-panel__resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, rgba(255, 255, 255, 0.35) 50%);
}
</style>

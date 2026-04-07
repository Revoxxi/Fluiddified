<template>
  <v-sheet
    :elevation="0"
    class="camera-container"
    :class="{ 'camera-container--fullscreen': fullscreen }"
    v-on="$listeners"
  >
    <template v-if="cameraComponent">
      <div
        v-if="fullscreen"
        ref="viewport"
        class="camera-viewport"
        :class="{ 'camera-viewport--pannable': canPanViewport }"
        @wheel.prevent="onViewportWheel"
        @pointerdown="onPanPointerDown"
        @pointermove="onPanPointerMove"
        @pointerup="onPanPointerEnd"
        @pointercancel="onPanPointerEnd"
        @lostpointercapture="onPanPointerEnd"
      >
        <div
          class="camera-viewport__hud"
          @pointerdown.stop
        >
          <v-tooltip bottom>
            <template #activator="{ on, attrs }">
              <span
                v-bind="attrs"
                class="camera-viewport__hud-text"
                v-on="on"
              >
                {{ zoomPercent }}%
              </span>
            </template>
            <span>{{ $t('app.general.tooltip.camera_fullscreen_zoom') }}</span>
          </v-tooltip>
          <v-tooltip bottom>
            <template #activator="{ on, attrs }">
              <v-btn
                v-bind="attrs"
                icon
                small
                class="camera-viewport__reset"
                :disabled="!hasViewportTransform"
                v-on="on"
                @click="resetViewport"
              >
                <v-icon small>
                  {{ resetViewIcon }}
                </v-icon>
              </v-btn>
            </template>
            <span>{{ $t('app.general.tooltip.camera_fullscreen_reset') }}</span>
          </v-tooltip>
        </div>
        <div
          ref="stage"
          class="camera-viewport__stage"
          :style="viewportTransformStyle"
        >
          <component
            :is="cameraComponent"
            ref="component-instance"
            :camera="camera"
            :crossorigin="crossorigin"
            class="camera-image camera-image--fullscreen-capable"
            @update:status="status = $event"
            @update:camera-name="cameraName = $event"
            @update:camera-name-menu-items="cameraNameMenuItems = $event"
            @update:raw-camera-url="rawCameraUrl = $event"
            @update:frames-per-second="handleFramesPerSecond"
            @frame="$emit('frame', $event)"
          />
        </div>
      </div>
      <component
        :is="cameraComponent"
        v-else
        ref="component-instance"
        :camera="camera"
        :crossorigin="crossorigin"
        class="camera-image"
        @update:status="status = $event"
        @update:camera-name="cameraName = $event"
        @update:camera-name-menu-items="cameraNameMenuItems = $event"
        @update:raw-camera-url="rawCameraUrl = $event"
        @update:frames-per-second="handleFramesPerSecond"
        @frame="$emit('frame', $event)"
      />
    </template>
    <div v-else>
      Camera service not supported!
    </div>

    <template v-if="cameraName || camera.name">
      <v-menu
        v-if="cameraNameMenuItems.length > 0"
        top
        offset-y
        transition="slide-y-reverse-transition"
      >
        <template #activator="{ on, attrs, value }">
          <div
            v-bind="attrs"
            class="camera-name"
            v-on="on"
          >
            {{ cameraNameAndStatus }}
            <v-icon
              small
              class="ml-1"
              :class="{ 'rotate-180': value }"
            >
              $chevronDown
            </v-icon>
          </div>
        </template>
        <v-list dense>
          <v-list-item
            v-for="(item, index) in cameraNameMenuItems"
            :key="index"
            @click="cameraNameMenuItemClick(item)"
          >
            <v-list-item-icon>
              <v-icon>
                {{ item.icon }}
              </v-icon>
            </v-list-item-icon>
            <v-list-item-content>
              <v-list-item-title>
                {{ item.text }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-menu>

      <div
        v-else
        class="camera-name"
      >
        {{ cameraNameAndStatus }}
      </div>
    </template>

    <div
      v-if="framesPerSecond"
      class="camera-frames"
    >
      fps: {{ framesPerSecond }}
    </div>

    <div
      v-if="!fullscreen && (fullscreenMode === 'embed' || !rawCameraUrl) && camera.service !== 'device'"
      class="camera-fullscreen"
    >
      <router-link
        :to="{
          name: 'camera',
          params: {
            cameraId: camera.uid
          }
        }"
      >
        <v-icon>$fullScreen</v-icon>
      </router-link>
    </div>
    <div
      v-else-if="rawCameraUrl"
      class="camera-fullscreen"
    >
      <a
        :href="rawCameraUrl"
        target="_blank"
      >
        <v-icon>$openInNew</v-icon>
      </a>
    </div>
  </v-sheet>
</template>

<script lang="ts">
import { Component, Vue, Prop, Watch, Ref } from 'vue-property-decorator'
import type { CameraFullscreenAction } from '@/store/config/types'
import { CameraComponents } from '@/dynamicImports'
import type CameraMixin from '@/mixins/camera'
import type { CameraConnectionStatus, CameraNameMenuItem } from '@/types'
import { startCase } from 'lodash-es'
import { Icons } from '@/globals'

const MIN_ZOOM = 1
const MAX_ZOOM = 4

@Component({})
export default class CameraItem extends Vue {
  @Prop({ type: Object, required: true })
  readonly camera!: Moonraker.Webcam.Entry

  @Prop({ type: Boolean })
  readonly fullscreen?: boolean

  @Prop({ type: String })
  readonly crossorigin?: 'anonymous' | 'use-credentials' | ''

  @Ref('component-instance')
  readonly componentInstance!: CameraMixin

  @Ref('viewport')
  readonly viewportEl!: HTMLElement | undefined

  @Ref('stage')
  readonly stageEl!: HTMLElement | undefined

  readonly resetViewIcon = Icons.reset

  status: CameraConnectionStatus = 'disconnected'
  rawCameraUrl = ''
  framesPerSecond = ''
  cameraName = ''
  cameraNameMenuItems: CameraNameMenuItem[] = []

  zoom = 1
  panX = 0
  panY = 0
  panDragging = false
  panLastX = 0
  panLastY = 0
  panPointerId: number | null = null

  get zoomPercent (): number {
    return Math.round(this.zoom * 100)
  }

  get canPanViewport (): boolean {
    return Boolean(this.fullscreen && this.zoom > MIN_ZOOM + 0.0001)
  }

  get hasViewportTransform (): boolean {
    return this.zoom > MIN_ZOOM + 0.0001 ||
      Math.abs(this.panX) > 0.5 ||
      Math.abs(this.panY) > 0.5
  }

  get viewportTransformStyle (): Record<string, string> {
    if (!this.fullscreen) {
      return {}
    }
    return {
      transform: `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`,
      transformOrigin: 'center center',
      willChange: 'transform'
    }
  }

  resetViewport (): void {
    this.zoom = 1
    this.panX = 0
    this.panY = 0
  }

  onViewportWheel (e: WheelEvent): void {
    if (!this.fullscreen) {
      return
    }
    const factor = e.deltaY > 0 ? 0.92 : 1.08
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor))
    if (next === this.zoom) {
      return
    }

    const vp = this.viewportEl
    if (vp) {
      const r = vp.getBoundingClientRect()
      const cx = e.clientX - r.left
      const cy = e.clientY - r.top
      const ratio = next / this.zoom
      this.panX = cx - (cx - this.panX) * ratio
      this.panY = cy - (cy - this.panY) * ratio
    }

    this.zoom = next
    if (this.zoom <= MIN_ZOOM) {
      this.resetViewport()
    } else {
      this.$nextTick(() => this.clampPan())
    }
  }

  onPanPointerDown (e: PointerEvent): void {
    if (!this.fullscreen || this.zoom <= MIN_ZOOM || e.button !== 0) {
      return
    }
    const t = e.target as HTMLElement | null
    if (t?.closest('.camera-viewport__hud')) {
      return
    }
    this.panDragging = true
    this.panPointerId = e.pointerId
    this.panLastX = e.clientX
    this.panLastY = e.clientY
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  onPanPointerMove (e: PointerEvent): void {
    if (!this.panDragging || e.pointerId !== this.panPointerId) {
      return
    }
    this.panX += e.clientX - this.panLastX
    this.panY += e.clientY - this.panLastY
    this.panLastX = e.clientX
    this.panLastY = e.clientY
    this.clampPan()
  }

  onPanPointerEnd (e: PointerEvent): void {
    if (this.panPointerId === null) {
      return
    }
    if (e.pointerId !== this.panPointerId && e.type !== 'lostpointercapture') {
      return
    }
    this.panDragging = false
    this.panPointerId = null
  }

  clampPan (): void {
    if (!this.fullscreen || this.zoom <= MIN_ZOOM) {
      this.panX = 0
      this.panY = 0
      return
    }
    const vp = this.viewportEl
    const st = this.stageEl
    if (!vp || !st) {
      return
    }
    const vw = vp.clientWidth
    const vh = vp.clientHeight
    if (vh < 1 || vw < 1) {
      return
    }

    const iw = st.scrollWidth
    const ih = st.scrollHeight
    if (iw < 1 || ih < 1) {
      return
    }

    const scaledW = iw * this.zoom
    const scaledH = ih * this.zoom
    const maxX = Math.max(0, (scaledW - vw) / 2)
    const maxY = Math.max(0, (scaledH - vh) / 2)

    this.panX = Math.max(-maxX, Math.min(maxX, this.panX))
    this.panY = Math.max(-maxY, Math.min(maxY, this.panY))
  }

  cameraNameMenuItemClick (item: CameraNameMenuItem) {
    this.componentInstance.menuItemClick(item)
  }

  @Watch('camera')
  onCamera () {
    this.status = 'disconnected'
    this.rawCameraUrl = ''
    this.framesPerSecond = ''
    this.cameraName = ''
    this.cameraNameMenuItems = []
    this.resetViewport()
  }

  @Watch('fullscreen')
  onFullscreenChange (enabled: boolean): void {
    if (!enabled) {
      this.resetViewport()
    }
  }

  @Watch('status')
  onStatusForClamp (s: CameraConnectionStatus): void {
    if (this.fullscreen && s === 'connected') {
      this.$nextTick(() => this.clampPan())
    }
  }

  get fullscreenMode (): CameraFullscreenAction {
    return this.$typedState.config.uiSettings.general.cameraFullscreenAction
  }

  get cameraComponent () {
    const cameraService = this.camera.service

    if (cameraService) {
      const componentName = `${startCase(cameraService).replace(/ /g, '')}Camera`

      if (componentName in CameraComponents) {
        return CameraComponents[componentName]
      }
    }
  }

  get cameraNameAndStatus () {
    const cameraName = this.cameraName || this.camera.name

    if (this.status !== 'connected') {
      return `${cameraName} (${this.status})`
    }

    return cameraName
  }

  handleFramesPerSecond (framesPerSecond : number) {
    this.framesPerSecond = framesPerSecond >= 0
      ? framesPerSecond.toString().padStart(2, '0')
      : ''
  }
}
</script>

<style lang="scss" scoped>
  .camera-image {
    display: block;
    max-width: 100%;
    max-height: calc(100vh - 130px);
    max-height: calc(100svh - 130px);
    white-space: nowrap;
    margin: auto;
    pointer-events: none;
    user-select: none;
  }

  .camera-container {
    position: relative;
    background: rgba(0, 0, 0, 1);
    min-height: 70px;
  }

  .camera-name,
  .camera-frames {
    position: absolute;
    bottom: 0;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.75);
    font-weight: 100;
  }

  .theme--light .camera-name,
  .theme--light .camera-frames {
    background: rgba(255, 255, 255, 0.75);
  }

  .camera-fullscreen {
    position: absolute;
    text-align: right;
    top: 0;
    right: 0;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.75);
    border-bottom-left-radius: 4px;
  }

  .theme--light .camera-fullscreen {
    background: rgba(255, 255, 255, 0.75);
  }

  .camera-name {
    left: 0;
    border-top-right-radius: 4px;
  }

  .camera-frames {
    text-align: right;
    right: 0;
    border-top-left-radius: 4px;
  }

  .camera-container--fullscreen {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .camera-viewport {
    position: relative;
    flex: 1;
    min-height: 0;
    width: 100%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
    user-select: none;
    cursor: default;
  }

  .camera-viewport--pannable {
    cursor: grab;
  }

  .camera-viewport--pannable:active {
    cursor: grabbing;
  }

  .camera-viewport__hud {
    position: absolute;
    top: 4px;
    left: 4px;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 2px 2px 6px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.55);
    pointer-events: auto;
  }

  .theme--light .camera-viewport__hud {
    background: rgba(255, 255, 255, 0.88);
  }

  .camera-viewport__hud-text {
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0 2px;
    cursor: help;
    line-height: 1;
  }

  .camera-viewport__stage {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    max-height: 100%;
  }

  .camera-image--fullscreen-capable {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    margin: 0;
  }
</style>

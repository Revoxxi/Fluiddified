<template>
  <collapsable-card
    v-if="!cameraPopoutOpen"
    :title="$tc('app.general.title.camera', 2)"
    icon="$camera"
    :lazy="false"
    draggable
    layout-path="dashboard.camera-card"
    @collapsed="collapsed = $event"
  >
    <template #menu>
      <v-tooltip
        v-if="canPopoutCamera"
        bottom
      >
        <template #activator="{ on, attrs }">
          <app-btn
            icon
            small
            class="me-1"
            v-bind="attrs"
            v-on="on"
            @click="openCameraPopout"
          >
            <v-icon dense>
              $openInNew
            </v-icon>
          </app-btn>
        </template>
        <span>{{ $t('app.general.tooltip.camera_popout') }}</span>
      </v-tooltip>
      <camera-menu
        @select="handleCameraSelect"
      />
    </template>

    <v-row
      v-if="cameras.length > 1"
      justify="space-around"
      class="ma-2"
    >
      <template v-for="camera in cameras">
        <v-col
          v-if="!collapsed"
          :key="camera.uid"
          cols="12"
          :sm="cols"
        >
          <camera-item
            :camera="camera"
          />
        </v-col>
      </template>
    </v-row>

    <camera-item
      v-if="!collapsed && cameras.length === 1"
      :camera="cameras[0]"
    />
  </collapsable-card>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import CameraItem from '@/components/widgets/camera/CameraItem.vue'
import CameraMenu from './CameraMenu.vue'
import StateMixin from '@/mixins/state'
import type { FloatingCameraUiConfig } from '@/store/config/types'

@Component({
  components: {
    CameraItem,
    CameraMenu
  }
})
export default class CameraCard extends Mixins(StateMixin) {
  collapsed = false

  /** While true, the floating panel is open — hide this card until it is closed (any route). */
  get cameraPopoutOpen (): boolean {
    return this.$typedState.config.uiSettings.general.floatingCamera.visible
  }

  get canPopoutCamera (): boolean {
    return (this.$typedGetters['webcams/getEnabledWebcams'] as Moonraker.Webcam.Entry[]).length > 0
  }

  openCameraPopout () {
    const f: FloatingCameraUiConfig = this.$typedState.config.uiSettings.general.floatingCamera
    const active = this.$typedState.webcams.activeWebcam
    const enabled: Moonraker.Webcam.Entry[] = this.$typedGetters['webcams/getEnabledWebcams']
    let webcamUid: string | null = f.webcamUid
    if (active !== 'all' && enabled.some(w => w.uid === active)) {
      webcamUid = active
    } else if (this.cameras.length > 0) {
      webcamUid = this.cameras[0].uid
    } else if (enabled.length > 0) {
      webcamUid = enabled[0].uid
    }
    this.$typedDispatch('config/saveByPath', {
      path: 'uiSettings.general.floatingCamera',
      value: {
        ...f,
        visible: true,
        webcamUid: webcamUid ?? f.webcamUid
      },
      server: true
    })
  }

  get cols () {
    if (this.cameras.length === 1) return 12
    if (this.cameras.length <= 2) return 6
    if (this.cameras.length > 2) return 4
  }

  get cameras (): Moonraker.Webcam.Entry[] {
    return this.$typedGetters['webcams/getVisibleWebcams']
  }

  handleCameraSelect (id: string) {
    this.$typedDispatch('webcams/updateActiveWebcam', id)
  }
}
</script>

<template>
  <v-card
    v-if="camera"
    class="fullscreen-camera-card overflow-hidden"
    flat
    tile
  >
    <CameraItem
      :camera="camera"
      fullscreen
    />
  </v-card>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import CameraItem from '@/components/widgets/camera/CameraItem.vue'

@Component({
  components: {
    CameraItem
  }
})
export default class FullscreenCamera extends Vue {
  camera: Moonraker.Webcam.Entry | null = null

  created () {
    const cameraId = this.$route.params.cameraId
    const camera: Moonraker.Webcam.Entry | undefined = this.$typedGetters['webcams/getWebcamById'](cameraId)

    this.camera = camera ?? null

    if (cameraId) {
      this.$typedDispatch('achievements/onCameraView', cameraId, { root: true })
    }
  }
}
</script>

<style lang="scss" scoped>
  .fullscreen-camera-card {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 56px);
    min-height: 280px;
  }

  .fullscreen-camera-card :deep(.camera-container--fullscreen) {
    flex: 1;
    min-height: 0;
  }
</style>

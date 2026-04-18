<template>
  <v-row
    class="gcode-preview-page fill-height"
    align="stretch"
    :dense="$vuetify.breakpoint.smAndDown"
  >
    <v-col
      cols="12"
      class="d-flex flex-column fill-height pa-0"
      style="min-height: 0"
    >
      <div
        class="gcode-preview-page__toolbar d-flex align-center flex-wrap flex-shrink-0 px-2 pt-2 pb-1"
      >
        <v-btn-toggle
          v-model="toggleModel"
          mandatory
          dense
          color="primary"
        >
          <v-btn
            value="2d"
            small
          >
            {{ $t('app.gcode.label.view_2d') }}
          </v-btn>
          <v-btn
            value="3d"
            small
          >
            {{ $t('app.gcode.label.view_3d') }}
          </v-btn>
        </v-btn-toggle>
      </div>

      <gcode-preview-card
        v-if="viewMode === '2d'"
        fullscreen
        class="gcode-preview-page__card flex-grow-1"
      />
      <gcode-preview-3d-card
        v-else
        fullscreen
        class="gcode-preview-page__card flex-grow-1"
      />
    </v-col>
  </v-row>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import GcodePreviewCard from '@/components/widgets/gcode-preview/GcodePreviewCard.vue'
import GcodePreview3dCard from '@/components/widgets/gcode-preview-3d/GcodePreview3dCard.vue'

type GcodeViewMode = '2d' | '3d'

@Component({
  components: {
    GcodePreviewCard,
    GcodePreview3dCard
  }
})
export default class GcodePreview extends Vue {
  get viewMode (): GcodeViewMode {
    return this.$route.query.view === '3d' ? '3d' : '2d'
  }

  get toggleModel (): GcodeViewMode {
    return this.viewMode
  }

  set toggleModel (value: GcodeViewMode) {
    this.$router.replace({
      query: {
        ...this.$route.query,
        view: value
      }
    }).catch(() => undefined)
  }
}
</script>

<style scoped>
.gcode-preview-page {
  min-height: 0;
}

.gcode-preview-page__card {
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>

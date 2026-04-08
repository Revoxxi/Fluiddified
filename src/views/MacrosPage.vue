<template>
  <v-container
    fluid
    class="constrained-width pa-2 pa-sm-4"
  >
    <h1 class="text-h5 font-weight-light mb-4">
      {{ $t('app.general.title.macros') }}
    </h1>
    <macros :show-category-edit="isOwner" />
  </v-container>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import AuthMixin from '@/mixins/auth'
import Macros from '@/components/widgets/macros/Macros.vue'

@Component({
  components: {
    Macros
  }
})
export default class MacrosPage extends Mixins(AuthMixin) {
}
</script>

<template>
  <v-dialog v-model="isOpen" persistent max-width="360">
    <v-card>
      <v-card-text class="text-body card-text">
      {{ ui.title }}
    </v-card-text>
        <v-card-actions class="justify-center">
      <v-btn
        variant="flat"
        :style="{ backgroundColor: 'rgb(218,227,243)', color: '#000' }"
        @click="close"
      >
        {{ t('common.OK') }}
      </v-btn>
    </v-card-actions>
    </v-card>
    
  </v-dialog>
</template>


<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotFoundScreenProps } from '../composables/NotFoundScreen'

const { t } = useI18n()
const { isOpen, close, code, errorCode, payload } = useNotFoundScreenProps()

const ui = computed(() => {
  const c = code.value ?? 503
  const e = (errorCode.value || '').toUpperCase()

  const baseByStatus: Record<number, { title: string }> = {
    503: { title: t('error.E0038')}, 
    504: { title: t('error.E0039') }, 
    404: { title: t('error.E0034') }, 
    0: { title: t('error.E0038')}
  }

  let specificTitle: string | undefined
  if (c === 404) {
    if (e === 'E0048') {
      specificTitle = t('error.E0048') 
    } else if (e === 'E0034') {
      specificTitle = t('error.E0034') 
    }
  }
  const base = baseByStatus[c] ?? baseByStatus[503]

  return {
   title: payload.value?.title ?? specificTitle ?? base!.title ?? t('error.E0038'),
  }
})
</script>

<style scoped>
.v-card-text {
  padding-top: 18px;
  padding-bottom: 6px;
}
.v-card.v-theme--light.v-card--density-default.elevation-2.v-card--variant-elevated {
    opacity: .9;
    box-shadow: 0px 4px 50px 20px rgba(0, 0, 0, 0.1) !important;
    border-radius: 2%;
}

.v-card-text {
    padding: 2rem !important;
}
.v-card-actions {
  padding: 12px 16px 16px 16px;
}
.v-card-text.text-body {
    text-align: center;
  }
.v-dialog > .v-overlay__content > .v-card, .v-dialog > .v-overlay__content > form > .v-card {
    border-radius: 20px;
    font-size: 0.875rem;
}
.v-card-text.text-body {
    text-align: center;
}
.v-dialog > .v-overlay__content > .v-card, .v-dialog > .v-overlay__content > form > .v-card {
  border-radius: 16px;
}
</style>
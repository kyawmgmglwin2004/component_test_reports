<template>
  <div class="error-screen">
    <div class="error-card">
      <v-icon class="error-icon" size="84" color="#e53935">mdi-alert-circle-outline</v-icon>

      <h1 class="title">{{t('popUp.somethingWentWrong')}}</h1>
      <p class="subtitle">{{t('popUp.tryAgain')}}</p>

      <div class="actions">
        <v-btn class="home-btn" color="primary" size="large" @click="onReturn">
          {{ t('common.home') || 'Home' }}
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCommonErrorScreen, type CommonErrorScreenProps } from '../composables/CommonErrorScreen'

const props = defineProps<CommonErrorScreenProps>()
const { onReturn, t } = useCommonErrorScreen(props)
</script>

<style scoped>
/* Full page center layout */
.error-screen {
  height: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #f8fafc; /* light background */
}

/* Card-like container */
.error-card {
  text-align: center;
  background: white;
  padding: 32px 24px 28px;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(2, 6, 23, 0.06);
  max-width: 520px;
  width: 100%;
}

/* Icon + text */
.error-icon {
  margin-bottom: 12px;
}

.title {
  font-size: clamp(22px, 3.8vw, 28px);
  margin: 0 0 6px;
  font-weight: 800;
  color: #0f172a; /* slate-900 */
}

.subtitle {
  color: #6b7280; /* slate-500 */
  font-size: 15px;
  margin: 0 0 16px;
}

/* Button */
.actions {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.home-btn {
  border-radius: 999px;
  padding: 0 24px;
  font-weight: 700;
}
</style>
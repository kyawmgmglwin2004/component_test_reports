<template>
  <div class="error-screen">
    <div class="error-card">
      <v-icon class="error-icon" size="84" :color="ui.color">mdi-alert-circle-outline</v-icon>

      <h1 class="title">{{ui.title}}</h1>
      <p class="subtitle">{{ui.subtitle}}</p>


    </div>
  </div>
</template>

<script setup lang="ts">
import { useCommonErrorScreenProps } from '../composables/CommonErrorScreenVisual'

const { ui } = useCommonErrorScreenProps();

</script>

<style scoped>
.error-screen {
  height: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #f8fafc;
}

.error-card {
  text-align: center;
  background: white;
  padding: 32px 24px 28px;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(2, 6, 23, 0.06);
  max-width: 520px;
  width: 100%;
}

.error-icon {
  margin-bottom: 12px;
}

.title {
  font-size: clamp(22px, 3.8vw, 28px);
  margin: 0 0 6px;
  font-weight: 800;
  color: #0f172a; 
}

.subtitle {
  color: #6b7280;
  font-size: 15px;
  margin: 0 0 16px;
}

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
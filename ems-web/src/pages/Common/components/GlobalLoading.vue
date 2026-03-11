<template>
  <!-- Vuetify overlay dialog -->
  <v-dialog v-model="open" persistent :scrim="true" max-width="360">
    <v-card class="loading-card">
      <div class="stack">
        <v-progress-circular
          :size="56"
          :width="5"
          color="primary"
          indeterminate
        />
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useGlobalLoading } from '../composables/GlobalLoading'
const { open} = useGlobalLoading()
// Refs are auto-unwrapped in templates when using <script setup>
</script>

<style scoped>
.loading-card {
  padding: 24px 20px;
  border-radius: 14px;
  text-align: center;
}
.stack {
  display: grid;
  gap: 10px;
  justify-items: center;
}
.msg {
  margin: 6px 0 2px;
  color: #475569; /* slate-600 */
  font-size: 14px;
}
</style>
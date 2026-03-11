<template>
  <router-view />
  <GlobalLoading /> 
</template>

<script setup lang="ts">
import GlobalLoading from './pages/Common/components/GlobalLoading.vue'
import { provideGlobalLoading } from './pages/Common/composables/GlobalLoading'

// Provide the service ONCE for the whole app tree:
provideGlobalLoading()

</script>

import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
//import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Fix for AWS Amplify/SDK in Vite: ensures browser-compatible versions are used
      './runtimeConfig': './runtimeConfig.browser',
    },
  },
  // Provides global variables that older Amplify versions expect
  define: {
    global: 'window',
    'process.env': {},
  },
})
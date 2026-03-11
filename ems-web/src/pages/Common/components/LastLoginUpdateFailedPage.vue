<template>
  <div class="error-screen">
    <div class="error-card">
      <v-icon class="error-icon" size="84" color="#e53935">mdi-alert-circle-outline</v-icon>

      <!-- Title & subtitle (Japanese) -->
      <h1 class="title">エラーが発生しました</h1>
      <p class="subtitle">前回ログイン日時の更新に失敗しました。</p>

      <div class="actions">
        <v-btn class="login-btn" color="primary" size="large" :loading="relaunching" @click="backToHostedUi">
          ログイン画面に戻る
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref } from 'vue'

const relaunching = ref(false)

async function backToHostedUi() {
  relaunching.value = true
  try {
    // 1) Remove OAuth junk from URL
    const clean = new URL(window.location.href)
    clean.search = ''
    window.history.replaceState({}, '', clean.toString())

    // 2) Hosted UI logout (clears Cognito session)
    const domainRaw = import.meta.env.VITE_COGNITO_DOMAIN
    const hostedDomain = domainRaw.startsWith('http') ? domainRaw : `https://${domainRaw}`
    const clientId = import.meta.env.VITE_COGNITO_APP_CLIENT_ID
    const logoutReturn = window.location.origin + '/'

    const logoutUrl = new URL('/logout', hostedDomain)
    logoutUrl.search = new URLSearchParams({
      client_id: clientId,
      logout_uri: logoutReturn,
    }).toString()

    // 🔥 The ONLY redirect!
    window.location.assign(logoutUrl.toString())
  } finally {
    relaunching.value = false
  }
}
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

.login-btn {
  border-radius: 999px;
  padding: 0 24px;
  font-weight: 700;
}
</style>

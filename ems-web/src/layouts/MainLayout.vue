<template>
  <v-app v-if="ready">
<v-app-bar
  color="primary"
  dark
  flat
  :height="smAndDown ? 100 : 64"
  :extension-height="smAndDown ? 70 : 0"
>
      <v-app-bar-nav-icon v-if="!smAndUp" @click="drawer = !drawer" />
      <v-row align="center" no-gutters>
        <v-col :cols= "smAndDown ? 2 : 1">
          <div class="logo-img">
            <v-img
            :src="iconImage"
            alt="Company Logo"
            />
          </div>
        </v-col>
        <v-col :cols= "smAndDown ? 10 : 11" v-if="!smAndUp">
              <v-row align="center" no-gutters>
                      <v-col cols="9" class="pl-3">
                        <v-row>
                        <div>{{ t('menuinfo.lastLoginDateTime') }}:
                        <template v-if="!loading && !error">{{ lastLoginDateTime }}</template>
                        <template v-else-if="loading">Loading…</template>
                        <template v-else><span class="text-error">Error: {{ error }}</span></template>
                       </div></v-row>
                        <v-row>
                        <div>{{ t('menuinfo.loginUserId') }}:
                        <template v-if="!loading && !error">{{ loginUserId }}</template>
                        <template v-else-if="loading">Loading…</template>
                        <template v-else><span class="text-error">Error: {{ error }}</span></template>
                       </div>
                        </v-row>
                      </v-col>
              <v-col cols="3">
             <v-btn :disabled = clickLoading :loading="clickLoading" class="text-caption text-white no-bg-hover" @click="logout">
              {{ t('common.logout') }}
            </v-btn>
          </v-col>
                    </v-row>
             </v-col>

        <v-col :cols= "smAndDown ? 10 : 11" v-else>
          <v-row align="center" no-gutters>
            <v-col :cols="mdAndUp ? 3 : 0">
            </v-col>
            <v-col :cols="mdAndUp ? 9 : 12">
              <v-row align="center" no-gutters v-if="lgAndUp">
                <v-col cols="10">
                    <v-row>
                      <v-col cols="2"></v-col>
                      <v-col cols="5">
                        <div>{{ t('menuinfo.lastLoginDateTime') }}:
                        <template v-if="!loading && !error">{{ lastLoginDateTime }}</template>
                        <template v-else-if="loading">Loading…</template>
                        <template v-else><span class="text-error">Error: {{ error }}</span></template>
                      </div>
                    </v-col>
                      <v-col cols="5">
                        <div>{{ t('menuinfo.loginUserId') }}:
                        <template v-if="!loading && !error">{{ loginUserId }}</template>
                        <template v-else-if="loading">Loading…</template>
                        <template v-else><span class="text-error">Error: {{ error }}</span></template>
                      </div>
                      </v-col>

                    </v-row>
              </v-col>
          <v-col cols="2">
             <v-btn :disabled = clickLoading :loading="clickLoading" class="text-caption text-white no-bg-hover" @click="logout">
              {{ t('common.logout') }}
            </v-btn>
          </v-col>
          </v-row>
              <v-row align="center" no-gutters v-else>
                <v-col cols="10">
                    <v-row>
                      <v-col cols="2"></v-col>

                      <v-col cols="5">
                        <div>{{ t('menuinfo.lastLoginDateTime') }}:
                        <template v-if="!loading && !error">{{ lastLoginDateTime }}</template>
                        <template v-else-if="loading">Loading…</template>
                        <template v-else><span class="text-error">Error: {{ error }}</span></template>
                      </div>
                    </v-col>
                      <v-col cols="5">
                        <div>{{ t('menuinfo.loginUserId') }}:
                        <template v-if="!loading && !error">{{ loginUserId }}</template>
                        <template v-else-if="loading">Loading…</template>
                        <template v-else><span class="text-error">Error: {{ error }}</span></template>
                      </div>
                      </v-col>

                    </v-row>
              </v-col>
          <v-col cols="2">
             <v-btn :disabled = clickLoading :loading="clickLoading" class="text-caption text-white no-bg-hover" @click="logout">
              {{ t('common.logout') }}
            </v-btn>
          </v-col>
          </v-row>
          </v-col>
          </v-row>
        </v-col>
      </v-row>
    </v-app-bar>


    <v-navigation-drawer
      v-model="drawer"
      app
      class="drawer-fluid"
      location="left"
      :width="drawerWidthPx"
      color="lightblue"
      :permanent="smAndUp"
      :temporary="!smAndUp"
      elevation="2"
    >
    <v-list nav density="comfortable" class="nav-hover">

    <v-list-item
      color="#3397E8"
      :title="t('title.facilityList')"
      :active="$route.path === '/'"
      role="button"
      tabindex="0"
      :link="false"
      @click.stop.prevent="confirmNav('/')"
      @keyup.enter.stop.prevent="confirmNav('/')"
      @keyup.space.stop.prevent="confirmNav('/')"

    />

    <v-list-item
      color="#3397E8"
      :title="t('title.facilityRegister')"
      :active="$route.path === '/FacilityRegister'"
      role="button"
      tabindex="0"
      :link="false"
      @click.stop.prevent="confirmNav('/FacilityRegister')"
      @keyup.enter.stop.prevent="confirmNav('/FacilityRegister')"
      @keyup.space.stop.prevent="confirmNav('/FacilityRegister')"

    />


      </v-list>
    </v-navigation-drawer>

<v-dialog v-model="showConfirm" max-width="360" persistent>
  <v-card class="confirm-card">
    <v-card-text class="text-body card-text no-wrap">
      {{ t('common.title') }}
    </v-card-text>

    <v-card-actions class="justify-center">
      <v-btn
        variant="flat"
        color="grey"
        class="mr-2"
        :disabled="loadingConfirm"
        @click="onCancelNav"
      >
        {{ t('common.cancel') }}
      </v-btn>

      <v-btn
        variant="flat"
        :style="{ backgroundColor: 'rgb(218,227,243)', color: '#000' }"
        :loading="loadingConfirm"
        @click="onOkNav"
      >
        {{ t('common.OK') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>

    <v-main class="main-width-pad">
      <router-view :key="$route.fullPath" />
    </v-main>
        <v-footer app :inset="false" elevation="6" class="footer-over-drawer" color="primary">
      <span class="mx-auto">© 2026 NTT EAST, Inc.</span>
    </v-footer>
</v-app>
</template>

<script setup lang="ts">
/**
 * ルーティング・国際化・レスポンシブ・認証情報の取得などをまとめたスクリプト。
 * Amplify v6 の auth API を使用し、Cognito からユーザーIDと最終ログイン日時（前回ログイン）を解決。
 * ポイント:
 * - IDトークンの custom:last_login を表示（なければ初回ログインのプレースホルダー）
 * - auth_time（現在のサインイン時刻）にはフォールバックしない
 * - localStorage には ISO を保存し、表示時のみフォーマット
 */

import { useI18n } from 'vue-i18n'
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import { useDisplay } from 'vuetify'
import { signOut, fetchAuthSession, getCurrentUser } from 'aws-amplify/auth'
import iconImage from '../assets/images/ems-logo.png'
import { useRouter, useRoute } from 'vue-router'

/** Vuetify breakpoints */
const { smAndDown, smAndUp, lgAndUp, mdAndUp, width } = useDisplay()
const { t } = useI18n()

/** Local storage key */
const STORAGE_KEY = 'auth:lastLogin'

/** First-login placeholder (use i18n if preferred) */
const FIRST_LOGIN_PLACEHOLDER = '—'

/** UI State */
const loading = ref(false)
const clickLoading = ref(false)
const error = ref<string>('')
const loginUserId = ref<string>('')
const lastLoginDateTime = ref<string>('')

/** Router */
const router = useRouter()
const route = useRoute()

/** Drawer / nav confirmation */
const sameRoute = ref(false)
const showConfirm = ref(false)
const loadingConfirm = ref(false)
const pendingRoute = ref<string | null>(null)

/** Nav handlers */
function confirmNav(path: string) {
  sameRoute.value = (route.path === path)
  pendingRoute.value = path
  showConfirm.value = true
}
async function onOkNav() {
  showConfirm.value = false
  try {
    loadingConfirm.value = true
    if (!smAndUp.value) {
      drawer.value = false
    }
    if (sameRoute.value) {
      await router.replace({
        path: route.path,
        query: { ...route.query, _ts: Date.now().toString() },
      })
    } else if (pendingRoute.value) {
      await router.push(pendingRoute.value)
    }
  } finally {
    loadingConfirm.value = false
    pendingRoute.value = null
    sameRoute.value = false
  }
}
function onCancelNav() {
  showConfirm.value = false
  pendingRoute.value = null
  sameRoute.value = false
}

/** Drawer width */
const drawerWidthPx = computed(() =>{
  if (width.value < 768) return 120
  return Math.round(width.value * 0.15)
})

/** Helpers: zero-pad + YYYY/MM/DD HH:mm:ss formatter */
function pad2(n: number) { return n.toString().padStart(2, '0') }
function formatY_D_M_Hms(date: Date): string {
  const y = date.getFullYear(), mm = pad2(date.getMonth() + 1), dd = pad2(date.getDate())
  const hh = pad2(date.getHours()), mi = pad2(date.getMinutes()), ss = pad2(date.getSeconds())
  return `${y}/${mm}/${dd} ${hh}:${mi}:${ss}`
}

/** Normalize value to ISO string (Date | number(sec/ms) | string(ISO/UNIX)) or return null. */
function normalizeToISO(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString()
  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  if (typeof value === 'string') {
    if (/^\d+$/.test(value)) {
      const n = parseInt(value, 10)
      const ms = value.length <= 10 ? n * 1000 : n
      const d = new Date(ms)
      return isNaN(d.getTime()) ? null : d.toISOString()
    }
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  return null
}

/** Load cached last login (ISO -> formatted) */
function loadFromLocal() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try {
    const data = JSON.parse(raw) as { loginUserId?: string; lastLoginAt?: string | null | undefined }
    if (data.loginUserId) loginUserId.value = data.loginUserId

    if (data.lastLoginAt) {
      const iso = normalizeToISO(data.lastLoginAt)
      lastLoginDateTime.value = iso ? formatY_D_M_Hms(new Date(iso)) : FIRST_LOGIN_PLACEHOLDER
    } else {
      lastLoginDateTime.value = FIRST_LOGIN_PLACEHOLDER
    }
  } catch (e) {
    console.error('Bad local storage:', e)
    lastLoginDateTime.value = FIRST_LOGIN_PLACEHOLDER
  }
}

/** Signed-in check */
async function isSignedIn(): Promise<boolean> {
  try {
    await getCurrentUser()
    const { tokens } = await fetchAuthSession()
    return !!tokens?.idToken
  } catch {
    return false
  }
}

/**
 * Read values from ID token.
 * Preferred new claim:    last_login     (ISO, injected by Pre-Token Gen)
 * Legacy fallback claim:  custom:last_login (often epoch seconds string)
 */
async function readFromIdToken(): Promise<{ loginUserId?: string; lastLoginAt?: string } | null> {
  try {
    const session = await fetchAuthSession()
    const p = session.tokens?.idToken?.payload as Record<string, unknown> | undefined
    if (!p) return null

    const getStr = (k: string) => typeof p[k] === 'string' ? p[k] as string : undefined
    const derivedUserId = typeof p.email === 'string' ? (p.email as string) : undefined

    const preferred = getStr('last_login')          // ISO if your Lambda injects it
    const fallback  = getStr('custom:last_login')   // epoch seconds or ISO (legacy)
    const iso = normalizeToISO(preferred ?? fallback) ?? undefined

    return { loginUserId: derivedUserId, lastLoginAt: iso }
  } catch (e) {
    console.error('readFromIdToken error:', e)
    return null
  }
}

/** Resolve user info and persist */
async function resolveFromCognitoOnly() {
  loading.value = true
  error.value = ''
  try {
    const signedIn = await isSignedIn()
    if (!signedIn) {
      error.value = 'Not signed in'
      return
    }

    const tk = await readFromIdToken()

    if (tk?.loginUserId) loginUserId.value = tk.loginUserId
    lastLoginDateTime.value = tk?.lastLoginAt
      ? formatY_D_M_Hms(new Date(tk.lastLoginAt))
      : FIRST_LOGIN_PLACEHOLDER

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ loginUserId: loginUserId.value, lastLoginAt: tk?.lastLoginAt ?? null })
    )
  } catch (e) {
    console.error('Cognito resolve error:', e)
    error.value = 'Unable to resolve user info from Cognito'
  } finally {
    loading.value = false
  }
}

/** Mount */
const drawer = ref(true)
const ready = ref(false)
onMounted(async () => {
  await nextTick()
  drawer.value = smAndUp.value
  ready.value = true

  loadFromLocal()
  resolveFromCognitoOnly()
})

/** Toggle drawer on breakpoint changes */
watch(smAndUp, (isWide) => { drawer.value = isWide })

/** Logout (global sign-out + Hosted UI redirect) */
const loggingOut = ref(false)
async function logout() {
  clickLoading.value = true
  loggingOut.value = true
  try {
    await signOut({ global: true })

    const hostedDomainRaw = import.meta.env.VITE_COGNITO_DOMAIN
    const hostedDomain = hostedDomainRaw.startsWith('http')
      ? hostedDomainRaw
      : `https://${hostedDomainRaw}`

    const clientId = import.meta.env.VITE_COGNITO_APP_CLIENT_ID
    const logoutReturn = import.meta.env.VITE_COGNITO_REDIRECT_SIGN_OUT || `${window.location.origin}/`

    const url = new URL('/logout', hostedDomain)
    url.search = new URLSearchParams({
      client_id: clientId,
      logout_uri: logoutReturn,
    }).toString()

    window.location.replace(url.toString())
  } catch (e) {
    console.error('Sign out error:', e)
  } finally {
    localStorage.removeItem(STORAGE_KEY)
    clickLoading.value = false
  }
}
</script>

<style scoped>
.v-app, .v-app *{
  font-size: 1rem;
  font-family: "Noto Sans JP", sans-serif !important;
}
.v-app-bar,
.v-app-bar * {
  padding: 0 1px;
  font-size: 1rem;
  text-align: center;
  font-family: "Noto Sans JP", sans-serif;
}
.text-white { color: #1522d8 !important; }
.no-wrap{
  white-space: nowrap;
}

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
    padding: 2rem 20px;
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
:deep(.footer-over-drawer){
  z-index: 1200 !important;
  left:0 !important;
  right:0 !important;
  width:auto !important;
}

.no-bg-hover, .no-bg-hover .v-btn__content {
  opacity: 1 !important;
}
:deep(.v-list-item--nav .v-list-item-title ){
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: normal;
    line-height: 1rem;
}
.nav-hover .v-list-item:hover {
  background-color: #b3eaf9;
  color: #1522d8;
}

.nav-hover .v-list-item:hover .v-list-item-title {
  color: #1522d8;
}
 .logo-img{
  aspect-ratio : 1 / 1;
 }
 .logo-img .v-img {
  width: 100%;
  height: 100%;
}
.text-caption{
  background-color: #d1f0bb;
}

 @media (max-width: 700px){
  .text-caption .v-btn__content{
    font-size: 0.7rem;

  }
  .v-navigation-drawer{
    width: 110px;
  }
  .v-app-bar, .v-app-bar * {
    font-size: 0.64rem;
  }
 }
@media (min-width: 1900px) {
.v-navigation-drawer .v-list-item-title{
  font-size:medium;
}
.logo-img{
  width: 80%;
}
  .drawer-fluid {
    width: 20%;
  }

}
</style>

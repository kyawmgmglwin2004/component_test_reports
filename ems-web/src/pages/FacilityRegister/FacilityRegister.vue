
<template>
  <!-- 背景レイヤー -->
  <div class="page-bg" :style="{ backgroundImage: `url('${pageBgUrl}')` }"></div>

  <div class="page-content">
    <v-card-title class="title">
      {{ t('title.facilityRegister') }}
    </v-card-title>

    <v-container class="py-8">
      <v-card elevation="2">
        <v-card-text>
          <!-- 成功メッセージ -->
          <v-alert
            v-if="msg"
            type="success"
            class="mb-4"
            density="compact"
            variant="tonal"
          >
            {{ msg }}
          </v-alert>

          <!-- 入力フォーム -->
          <FacilityForm
            ref="formRef"
            v-model="formData"
            :facilityType="facilityType"
            :facilityStatus="facilityStatus"
            :rules="formRules"
            :serverErrors="serverErrors"
            @submit="onSubmit"
            @reset="onCancel"
            @open-image="onOpenImage"
            @clear-error="clearServerError"
          />

          <!-- 画像選択モーダル -->
          <PhotoUploadModal
            v-model="dialog"
            :title="`${t('facility.selectImage')}`"
            :closeText="t('common.close')"
            :loading="photoLoading"
            :error="dialogError"
            :images="images"
            :selectedSrc="selectedSrcForModal"  
            @select="onSelectImage"
          />
          
          <!-- 成功ダイアログ -->
          <v-dialog v-model="successDialog" max-width="420" persistent>
            <v-card class="pop_pup" elevation="8" rounded="xl" > 
              <v-card-text>
                <div>{{ t('message.facilityRegistered1') }}</div> 
                  <div>{{ t('message.facilityRegistered2') }}</div> 
              </v-card-text>
              <v-card-actions>
                <v-btn class="okBtn"  @click="onSuccessOk"> {{ t('common.OK') }}</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
                           
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import FacilityForm from './components/FacilityRegisterform.vue'
import PhotoUploadModal from './components/PhotoUploadModal.vue'

import { useFacilityRegistration } from './composables/useFacilityRegister'
import { usePhotoUpload } from './composables/usePhotoUpload'

import type { FacilityImage } from './FacilityRegister'
import type { RulesMap } from './composables/useFacilityRegister.ts'

const { t } = useI18n()
const router = useRouter()

// 入力系・状態系は composable から取得
const {
  msg,
  successDialog,
  formData,
  facilityType,
  facilityStatus,
  formRef,
  rules,
  serverErrors,
  clearServerError,
  pageBgUrl,
  normalizeCategory,
  fetchInit,
  onSubmit,
} = useFacilityRegistration()
const {
  dialog,
  loading: photoLoading,
  dialogError,
  images,
  open,
  close,
} = usePhotoUpload()


const formRules = computed<RulesMap>(() => ({
  facilityID: rules.facilityID ?? [],
  ecoCompanyID: rules.ecoCompanyID ?? [],
  ecoCompanyPassword: rules.ecoCompanyPassword ?? [],
  facilityName: rules.facilityName ?? [],
  facilityAddress: rules.facilityAddress ?? [],
  cityInfo: rules.cityInfo ?? [],
  imageFilename: rules.imageFilename ?? [],
  facilityManagerName: rules.facilityManagerName ?? [],
  facilityManagerMail: rules.facilityManagerMail ?? [],
}))


const selectedSrcForModal = computed<string>(() => {
  return (
    formData.value.facilityImage?.presignedUrl ||
    formData.value.facilityImageUrl ||
    ''
  )
})


async function onOpenImage(): Promise<void> {
  const cat = normalizeCategory(formData.value.facilityType)
  if (!cat) return
  await open(cat)
}


async function onCancel() {
  await fetchInit()
}


function fileNameFromImg(img: FacilityImage): string {
  if (img.displayName?.trim()) return img.displayName.trim()

  if (img.relativePath) {
    const parts = img.relativePath.split('/').filter(Boolean)
    const last = parts[parts.length - 1]
    if (last) return decodeURIComponent(last)
  }

  try {
    const u = new URL(img.presignedUrl, window.location.origin)
    const parts = u.pathname.split('/').filter(Boolean)
    return decodeURIComponent(parts[parts.length - 1] || 'image')
  } catch {
    return 'image'
  }
}


function onSelectImage(img: FacilityImage): void {

  formData.value.facilityImage = img              
  formData.value.imageFilename = fileNameFromImg(img)
  close()
}


function onSuccessOk(): void {
  router.push({
    name: 'facility-edit',
    params: {
      facilityID: formData.value.facilityID
    },
    query: {
      registerFlag: 1
    }
  })
}

</script>
<style scoped>
/* --- 背景 --- */
.page-bg {
  position: fixed;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
}

.page-content { position: relative; z-index: 1; }
v-container { width: 80%; }
.v-card {
  backdrop-filter: blur(4px);
  opacity: .9;
  box-shadow: 0px 4px 50px 20px rgba(0, 0, 0, 0.1) !important;
  border-radius: 3%;
}
.v-card-text { padding: 2rem !important; }

form.v-form { margin: 0 auto !important; width: 60%; }

:deep(.v-label) { text-wrap: nowrap; }
:deep(.v-field__prepend-inner) { display: none !important; }
:deep(.v-field__field) {
  padding-inline-start: 0 !important;
  padding-inline-end: 0 !important;
}
:deep(.v-input--density-default .v-field--variant-outlined,
      .v-input--density-default .v-field--single-line,
      .v-input--density-default .v-field--no-label) {
  --v-field-padding-bottom: 4px !important;
}

.cursor-pointer { cursor: pointer; }
.rounded { border-radius: 8px; }
.selectable { position: relative; border: 1px solid rgba(0,0,0,0.12); }

.selected-overlay {
  position: absolute; inset: 0;
  background: rgba(0, 0, 0, .35);
  display: flex; align-items: center; justify-content: center;
  border-radius: 8px;
}
.hover-overlay {
  position: absolute; inset: 0;
  background: rgba(0, 0, 0, .15);
  border-radius: 8px;
}

.text-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btn-position { justify-content: flex-end; }
.d-flex.gap-2.mt-4.btn-position { justify-content: end; }

.label-col { display: flex; align-items: center; font-weight: 500; white-space: nowrap; }

@media (max-width: 1272px) {
  form.v-form { width: 45%; margin: 0 auto !important; }
}

.v-container { max-width: unset !important; width: 90% !important; border-radius: 8px; }
.v-input--density-default {
  --v-input-control-height: 40px;
  --v-input-padding-top: 4px;
}

.label, .btn { font-family: 'Noto Sans JP'; font-weight: 300; }
.label { font-size: 16px; }
.btn { font-size: 16px; }
.title {   font-size: 1.25rem !important;
    font-weight: 500;
    line-height: 1.6;
    letter-spacing: 0.0125em !important;
    font-family: "Roboto", sans-serif;
    text-transform: none !important; }
.gap-2 { gap: 8px; }
.v-row { margin: 0 !important; }

:deep(.v-input--density-default) {
  --v-input-control-height: 50px !important;
  --v-input-padding-top: 7px !important;
}
:deep(.v-field) { --v-field-padding-bottom: 13px !important; }

:deep(.v-input__details), :deep(.v-messages) {
  min-height: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}
:deep(.v-row) { margin: 0 !important; }
:deep(.v-row + .v-row) { margin-top: 18px !important; }

:deep(.v-col), :deep([class^="v-col-"]), :deep([class*=" v-col-"]) {
  padding: 0 !important;
}
:deep(.v-input__details) {
  margin-top: 0px !important;
  padding-top: 2px !important;
}
.pop_pup {
  background: #ffffff;
  border-radius: 2%;
  box-shadow:
    0 6px 12px rgba(0, 0, 0, 0.08),
    0 16px 28px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  min-width: 360px;
}
.okBtn {
 background-color: rgb(218,227,243);
  margin: 0 auto;
  color: var(--btn-text) !important;
  font-weight: 500;
  border-radius: 4px;
  padding: 5px 5px;
  text-transform: none;
  letter-spacing: .4px;
}
</style>
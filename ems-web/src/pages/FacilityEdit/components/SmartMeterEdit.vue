<template>
  <!-- グローバルなローディングオーバーレイ（API 呼び出し中に全体を覆う） -->
  <GlobalLoading/>

  <!-- スマートメーター編集のモーダルダイアログ -->
  <v-dialog v-model="internalOpen" max-width="650" persistent>
    <v-card class="smartmeter_popup">

      <!-- ヘッダ（タイトル＋閉じるボタン） -->
      <v-card-title class="modal-header">
        <!-- タイトル：設備ID + ラベル -->
        <span class="title pt-2">{{ formData.deviceID }}_{{ t('smartMeter.label') }}</span>
        <!-- 右上の×ボタン：内部状態を false にして閉じる -->
        <v-btn icon="mdi-close" variant="text" size="small" @click="internalOpen=false" />
      </v-card-title>

      <!-- 本文 -->
      <v-card-text class="modal-body">

        <!-- 画面上部に並べるエラー（行単位で表示） -->
        <!-- ※ topErrorList は composable 側で配列として格納すること -->
        <div v-if="topErrorList.length" class="mb-4">
          <!-- 1件ずつアラートを積み重ねて表示 -->
          <v-alert
            v-for="(m, i) in topErrorList"
            :key="i"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-2"
            closable            
            @click:close="topErrorList.splice(i,1)" 
          >
            {{ m }}
          </v-alert>
        </div>

        <!-- Vuetify の v-form：入力ルールの実行対象 -->
        <!-- ※ 必ず各入力（v-text-field）をこの v-form の内側に置く -->
        <v-form ref="formRef">
          <div class="modal-body">
            <!-- 1行目：設備ID（表示のみ） -->
            <div class="first-form-row">
              <label>{{ t('device.deviceID') }}</label>
              <!-- 読み取り専用のテキストフィールド -->
              <v-text-field
                type="text"
                v-model="formData.deviceID"
                data-test="deviceID"
                variant="plain"
                density="compact"
                hide-details
                readonly
              />
            </div>

            <!-- メーカー名（必須 + 最大文字数） -->
            <div class="form-row">
              <label>
                {{ t('smartMeter.smartmeterManufacturerName') }}
                <span class="required">*</span>
              </label>
              <v-text-field
                type="text"
                v-model="formData.smartmeterManufacturerName"
                :rules="rules.smartmeterManufacturerName" 
                variant="outlined"
                density="compact"
                hide-details="auto"                       
                data-test="smartmeterManufacturerName"
                @update:modelValue="() => clearServerError('smartmeterManufacturerName')"  
              />
            </div>

            <!-- 型番（必須 + 最大文字数） -->
            <div class="form-row">
              <label>
                {{ t('smartMeter.smartmeterModelNumber') }}
                <span class="required">*</span>
              </label>
              <v-text-field
                type="text"
                v-model="formData.smartmeterModelNumber"
                :rules="rules.smartmeterModelNumber"
                variant="outlined"
                density="compact"
                hide-details="auto"
                data-test="smartmeterModelNumber"
                @update:modelValue="() => clearServerError('smartmeterModelNumber')"
              />
            </div>

            <!-- 設置場所（任意 + 最大文字数） -->
            <div class="form-row">
              <label>{{ t('smartMeter.smartmeterInstallLocation') }}</label>
              <v-text-field
                type="text"
                v-model="formData.smartmeterInstallLocation"
                :rules="rules.smartmeterInstallLocation"
                variant="outlined"
                density="compact"
                hide-details="auto"
                data-test="smartmeterInstallLocation"
                @update:modelValue="() => clearServerError('smartmeterInstallLocation')"
              />
            </div>

            <!-- 設置日（形式 + 最大文字数） -->
            <div class="form-row">
              <label>{{ t('smartMeter.smartmeterSetupDate') }}</label>
              <v-text-field
                type="text"
                v-model="formData.smartmeterSetupDate"
                :rules="rules.smartmeterSetupDate"
                variant="outlined"
                density="compact"
                hide-details="auto"
                data-test="smartmeterSetupDate"
                @update:modelValue="() => clearServerError('smartmeterSetupDate')"
              />
            </div>
          </div>
        </v-form>

        <!-- フッターボタン（キャンセル／更新） -->
        <div class="modal-footer d-flex gap-2 mt-4 btn-position" style="justify-content: end;">
          <!-- キャンセル：値を初期スナップショットへ戻す -->
          <v-btn
            type="button"
            variant="tonal"
            data-test="cancelButton"
            style="margin-right: 10px;"
            @click="onCancel"
          >
            {{ t('common.cancel') }}
          </v-btn>

          <!-- 更新：onSubmitInit 経由で composable の onSubmit を実行 -->
          <!-- ※ 無効条件（例：!isFormValid）を付けると UX 向上 -->
          <v-btn
            type="button"
            color="success"
            width="110"
            data-test="registerButton"
            :loading="submitting"
            :disabled="submitting"
            @click="onSubmitInit"
          >
            {{ t('common.update') }}
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSmartMeterEdit } from '../composables/SmartMeterEdit'
import GlobalLoading from '@/pages/Common/components/GlobalLoading.vue'

const { t } = useI18n()

/** 親からのプロパティ：ダイアログ開閉／対象の設備番号 */
const props = defineProps<{
  open: boolean
  deviceNumber: string | null
}>()

/** 親へイベントを返す：v-model(open) 同期／保存完了通知 */
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved', payload: { deviceNumber: string | null }): void
}>()

/** v-dialog の v-model を props とブリッジする計算プロパティ */
const internalOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

/** composable から必要な状態・関数を取得 */
const {
  // state
  submitting,
  formData,
  formRef,

  // rules (Vuetify のルール)
  rules,
  topErrorList,

  // actions
  onCancel,    // 入力を初期スナップショットへ戻す
  onSubmit,    // 更新処理（バリデーション→API→エラー反映）
  fetchInit,   // 初期化 API 取得
  clearServerError, // サーバエラーマップから項目別のエラーを除去
} = useSmartMeterEdit({
  deviceNumberRef: computed(() => props.deviceNumber), // ← 親の設備番号を composable へ渡す
})

/** ダイアログが開いた／deviceNumber が更新されたタイミングで初期取得する */
watch(
  [internalOpen, () => props.deviceNumber],
  async ([isOpen, dev]) => {
    if (isOpen && dev) {
      await fetchInit()  // composable 側で API → formData 反映
    }
  },
  { immediate: true }
)

/** 更新ボタンクリック時のハンドラ */
async function onSubmitInit() {
  const ok = await onSubmit()
  if (ok) {
    // 親へ保存完了を通知
    emit('saved', { deviceNumber: props.deviceNumber })
    // ダイアログを閉じる
    internalOpen.value = false
  }
}
</script>

<style>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 999;
}
 
.modal-window {
  position: fixed;
  top: 50%;
  left: 50%;
  width: 600px;
  background: white;
  border: 1px solid #333;
  border-radius: 4px;
  transform: translate(-50%, -50%);
  z-index: 1000;
}
 
.modal-header {
  background: #f2f2f2;
  padding: 10px 14px;
  border-bottom: 1px solid #ccc;
  display: flex;
  justify-content: space-between;
}
 
.modal-body {
  padding: 16px 24px;
}
 
.first-form-row{
  display: flex;
  align-items: center;
  margin-bottom: 12px;

}
.first-form-row label {
  width: 140px;
}
.first-form-row input{
   flex: 1;
  padding: 6px 10px;
  border-radius: 4px;
}

.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
.form-row label {
  width: 140px;
}
.form-row input {
  flex: 1;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid #bbb;
}
.required {
  color: red;
}
 
.modal-footer {
  padding: 10px 14px;
  border-top: 1px solid #ccc;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
 
.btn {
  padding: 8px 14px;
  border-radius: 4px;
  cursor: pointer;
  border: none;
}
.cancel {
  background: #ddd;
}
.update {
  background-color: #16a34a; 
  color: #fff;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.05) inset;
}
.update :hover {
background-color: #128a3c; 

}
</style>
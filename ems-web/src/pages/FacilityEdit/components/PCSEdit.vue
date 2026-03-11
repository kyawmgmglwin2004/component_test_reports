
<template>
   <!-- 共通ローディング（API 通信中の全画面オーバーレイ） -->
    <GlobalLoading/>
      <!-- 【注意】v-if-else というディレクティブは存在しません。
       条件付き描画をする場合は、v-if と v-else（または v-else-if）を使います。
       ここでは「200 のとき編集ダイアログを表示する」という意図だと仮定し、
       v-if に修正しています。必要なら下の「改善例」をご参照ください。 -->
  <v-dialog v-model="internalOpen" max-width="650" persistent>
    <v-card class="pcs_popup">
      <!-- タイトル行（左：タイトル、右：閉じるアイコン） -->
      <v-card-title class="modal-header">
        <!-- 設備ID + ラベル名 -->
        <span class="title pt-2">{{ formData.deviceID }}_{{t('PCSInfo.label') }}</span>
        <!-- ダイアログを閉じる（親と v-model 同期） -->
        <v-btn icon="mdi-close" variant="text" size="small" @click="internalOpen=false" />
      </v-card-title>
      <v-card-text class="modal-body">
       
        <div v-if="topErrorList.length" class="mb-4">
  <v-alert
    v-for="(m, i) in topErrorList"
    :key="i"
    type="error"
    variant="tonal"
    density="compact"
    class="mb-2"
    @click="topErrorList = []"
  >
    {{ m }}
  </v-alert>
</div>

        <v-form ref="formRef">
          <div class="modal-body">
            <div class="first-form-row">
              <label>{{ t('device.deviceID') }}</label>
              <v-text-field 
                type="text" 
                v-model="formData.deviceID"
                data-test="deviceID" 
                variant="plain"
                density="compact"
                hide-details
                readonly/>
            </div>

            <div class="form-row">
              <label>
                {{ t('PCSInfo.PCSID') }}
                <span class="required">*</span>
              </label>
              <v-text-field
                type="text"
                v-model="formData.PCSID"
                :rules="rules.PCSID"
                variant="outlined"
                data-test="PCSID"
                density="compact"
                hide-details="auto"
                @update:modelValue="() => clearServerError('PCSID')"
              />
            </div>

            <div class="form-row">
              <label>
                {{ t('PCSInfo.pcslManufacturerName') }}
                <span class="required">*</span>
              </label>
              <v-text-field
                type="text"
                v-model="formData.pcslManufacturerName"
                :rules="rules.pcslManufacturerName"
                variant="outlined"
                density="compact"
                hide-details="auto"
                data-test="pcslManufacturerName"
                @update:modelValue="() => clearServerError('pcslManufacturerName')"
              />
            </div>

            <div class="form-row">
              <label>
                {{ t('PCSInfo.PCSModelNumber') }}
                <span class="required">*</span>
              </label>
              <v-text-field
                type="text"
                v-model="formData.PCSModelNumber"
                :rules="rules.PCSModelNumber"
                variant="outlined"
                density="compact"
                hide-details="auto"
                data-test="PCSModelNumber"
                @update:modelValue="() => clearServerError('PCSModelNumber')"
              />
            </div>

            <div class="form-row">
              <label>{{ t('PCSInfo.PCSInstallLocation') }}</label>
              <v-text-field
                type="text"
                v-model="formData.PCSInstallLocation"
                :rules="rules.PCSInstallLocation"
                variant="outlined"
                density="compact"
                hide-details="auto"
                data-test="PCSInstallLocation"
                @update:modelValue="() => clearServerError('PCSInstallLocation')"
              />
            </div>

            <div class="form-row">
              <label>{{ t('PCSInfo.PCSSetupDate') }}</label>
              <v-text-field
                type="text"
                v-model="formData.PCSSetupDate"
                :rules="rules.PCSSetupDate"
                variant="outlined"
                density="compact"
                hide-details="auto"
                data-test="PCSSetupDate"
                @update:modelValue="() => clearServerError('PCSSetupDate')"
              />
            </div>
          </div>
        </v-form>

        <div class="modal-footer d-flex gap-2 mt-4 btn-position" style="justify-content: end;">
          <v-btn
            type="button"
            variant="tonal"
            data-test="cancelButton"
            style="margin-right: 10px;"
            @click="onCancel"
          >
            {{ t('common.cancel') }}
          </v-btn>

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
import { computed,watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePCSEdit } from '../composables/PCSEdit'
import GlobalLoading from '@/pages/Common/components/GlobalLoading.vue'
const { t } = useI18n()
/** 親からの受け取り：ダイアログ開閉・設備番号・PCS番号 */
const props = defineProps<{
  open: boolean
  deviceNumber: string | null
  pcsNumber: string | null
}>()

/** 親へ返すイベント：
 *  - update:open: v-model 同期用
 *  - saved: 保存完了通知（親側でリスト再読みなどに使用）
 */
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved', payload: { deviceNumber: string | null, pcsNumber: string | null}): void
}>()
/** v-dialog の v-model を props とブリッジ */
const internalOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
/** PCS 編集のコンポーザブルを利用 */
const {
    submitting,
    topErrorList,
    formData,
    formRef,
  
    rules,

    fetchInit,
    onCancel,
    onSubmit,
    clearServerError,
} = usePCSEdit({
  deviceNumberRef: computed(() => props.deviceNumber),
  pcsNumberRef: computed(() => props.pcsNumber),
})
/** ダイアログが開いた／deviceNumber, pcsNumber が変わった際に初期 API を叩く */
watch([internalOpen, () => props.deviceNumber, () => props.pcsNumber], async ([isOpen, dev, pcs]) => {
  if (isOpen && dev && pcs) {
    await fetchInit()
  }
}, { immediate: true })
/** 更新ボタンクリック時 */
async function onSubmitInit() {
  const ok = await onSubmit()
  if (ok) {
    emit('saved', { deviceNumber: props.deviceNumber , pcsNumber: props.pcsNumber})
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
 
.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
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
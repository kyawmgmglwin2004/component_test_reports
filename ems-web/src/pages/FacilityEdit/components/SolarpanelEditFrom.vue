<template>
  <v-dialog v-model="solarDialog" max-width="650" persistent>
    <v-card class="solar_popup">
      <v-card-title class="solar_popup__header">
        <span class="solar_popup__title">{{ formData.deviceID }}_{{ t('solarPanel.label') }}</span>
        <v-btn icon variant="text" class="solar_popup__close" @click="solarDialog = false">
          ✕
        </v-btn>
      </v-card-title>

      <v-card-text class="solar_popup__body">
        <div v-if="loading" class="mb-2">
          <v-progress-linear indeterminate />
        </div>

        <div v-if="error" class="mb-2" style="color: red;">
          {{ error }}
        </div>

        <!-- ✅ Optional: Top error list from server -->
        <div v-if="topErrorList.length" style="color:red; margin-bottom: 10px;">
          <div v-for="(m, i) in topErrorList" :key="i">{{ m }}</div>
        </div>

        <!-- ✅ IMPORTANT: v-form + validate-on input -->
        <v-form
          ref="formRef"
          validate-on="input"
          @submit.prevent="onSubmit"
        >
          <div class="form-grid">

            <!-- deviceID (optional) -->
            <div class="form-row">
              <label>{{ t('solarPanel.equitmentID') }}</label>
              <!-- read-only value text -->
        <div class="form-value" style="margin-left: 10px;">
        {{ formData.deviceID }}
        </div>

            </div>

            <!-- solarPanelID (required) -->
            <div class="form-row">
              <label>
                {{ t('solarPanel.panelID') }}
                <span class="required">*</span>
              </label>
              <v-text-field
                v-model="formData.solarPanelID"
                :rules="rules.solarPanelID"
                :error-messages="serverErrors.solarPanelID"
                variant="outlined"
                density="compact"
                hide-details="auto"
                @update:modelValue="() => clearServerError('solarPanelID')"
              />
            </div>

            <!-- panelManufacturerName (required) -->
            <div class="form-row">
              <label>
                {{ t('solarPanel.manufacturerName') }}
                <span class="required">*</span>
              </label>
              <v-text-field
                v-model="formData.panelManufacturerName"
                :rules="rules.panelManufacturerName"
                :error-messages="serverErrors.panelManufacturerName"
                variant="outlined"
                density="compact"
                hide-details="auto"
                @update:modelValue="() => clearServerError('panelManufacturerName')"
              />
            </div>
            <!-- panelModelNumber (optional) -->
            <div class="form-row">
              <label>{{ t('solarPanel.modelNumber') }}
                <span class="required">*</span>
              </label>
              <v-text-field
                v-model="formData.panelModelNumber"
                :rules="rules.panelModelNumber"
                :error-messages="serverErrors.panelModelNumber"
                variant="outlined"
                density="compact"
                hide-details="auto"
                @update:modelValue="() => clearServerError('panelModelNumber')"
              />
            </div>

            <!-- panelRatedPower (number) -->
            <div class="form-row">
              <label>{{ t('solarPanel.ratedOutput') }}
                <span class="required">*</span>
              </label>
              <v-text-field
             
                v-model="formData.panelRatedPower"
                :rules="rules.panelRatedPower"
                :error-messages="serverErrors.panelRatedPower"
                variant="outlined"
                density="compact"
                hide-details="auto"
                @update:modelValue="() => clearServerError('panelRatedPower')"
              />
            </div>

            <!-- panelTiltAngleDegree (number) -->
            <div class="form-row">
              <label>{{ t('solarPanel.inclinationangle') }}
                <span class="required">*</span>
              </label>
              <v-text-field
           
                v-model="formData.panelTiltAngleDegree"
                :rules="rules.panelTiltAngleDegree"
                :error-messages="serverErrors.panelTiltAngleDegree"
                variant="outlined"
                density="compact"
                hide-details="auto"
                @update:modelValue="() => clearServerError('panelTiltAngleDegree')"
              />
            </div>

            <!-- panelDirection (required) -->
            <div class="form-row">
              <label>
                {{ t('solarPanel.direction') }}
                <span class="required">*</span>
              </label>
              <v-text-field
                v-model="formData.panelDirection"
                :rules="rules.panelDirection"
                :error-messages="serverErrors.panelDirection"
                variant="outlined"
                density="compact"
                hide-details="auto"
                @update:modelValue="() => clearServerError('panelDirection')"
              />
            </div>

            <!-- panelSurfaceArea (number) -->
            <div class="form-row">
              <label>{{ t('solarPanel.aera') }}
                <span class="required">*</span>
              </label>
              <v-text-field
             
                v-model="formData.panelSurfaceArea"
                :rules="rules.panelSurfaceArea"
                :error-messages="serverErrors.panelSurfaceArea"
                variant="outlined"
                density="compact"
                hide-details="auto"
                @update:modelValue="() => clearServerError('panelSurfaceArea')"
              />
            </div>

            <!-- panleInstallLocation (optional) -->
            <div class="form-row">
              <label>{{ t('solarPanel.installationLocation') }}</label>
              <v-text-field
                v-model="formData.panleInstallLocation"
                :rules="rules.panleInstallLocation"
                :error-messages="serverErrors.panleInstallLocation"
                variant="outlined"
                density="compact"
                hide-details="auto"
                @update:modelValue="() => clearServerError('panleInstallLocation')"
              />
            </div>

            <!-- panelSetupDate (optional - add rule if needed) -->
            <div class="form-row">
              <label>{{ t('solarPanel.installationDate') }}</label>
              <v-text-field
                v-model="formData.panelSetupDate"
                 :rules="rules.panelSetupDate"
                :error-messages="serverErrors.panelSetupDate"
                variant="outlined"
                density="compact"
                hide-details="auto"
                @update:modelValue="() => clearServerError('panelSetupDate')"
              />
            </div>
          </div>

          <!-- Buttons -->
          <div class="d-flex gap-2 mt-4 btn-position btn-row" style="justify-content: end;">
            <v-btn
              type="button"
              variant="tonal"
              data-test="cancelButton"
              style="margin-right: 10px;"
              @click="resetToInitial"
              :disabled="submitLoading"
            >
              {{ t('common.cancel') }}
            </v-btn>

            <!-- ✅ Make it submit, so v-form runs validation -->
            <v-btn
              type="submit"
              color="success"
              width="110"
              data-test="registerButton"
              :loading="submitLoading"
              :disabled="submitLoading"
            >
              {{ t('common.update') }}
            </v-btn>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSolarPanelEdit } from '../composables/SolarPanelEdit'

const { t } = useI18n()
// const solarDialog = ref(true)
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
const solarDialog = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const {
  formRef,
  formData,
  loading,
  error,
  submitLoading,

  // rules + errors
  rules,
  serverErrors,
  topErrorList,
  clearServerError,
  resetToInitial,
  onSubmit,
} = useSolarPanelEdit()

// function onCancel() {
//   fetchInit()
// }
</script>


<style scoped>
.form-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.form-row label {
  width: 140px;
   flex-shrink: 0;
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
.field-error{
  color: red;
  font-size: 12px;
  margin: -8px 0 10px 140px; /* align under input */
}
/* .solar_popup__header{
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #dbd6d6;
}
.solar_popup{
  border-radius: 8px;
} */

/* adjust row  */
@media (max-width: 600px) {
  .form-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-row label {
    width: auto;
    margin-bottom: 4px;
  }

  .form-row .v-text-field,
  .form-row .form-value {
    width: 100%;
  }
}
.btn-row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

/* adjust btn responsive */
@media (max-width: 480px) {
  .btn-row {
    flex-direction: column;
    align-items: center;   /* center buttons */
    gap: 10px;
  }

  .btn-row .v-btn {
    width: auto !important;   /* ← FIX: don't stretch */
    min-width: 120px;         /* adjust as needed */
    color: white;
  }
}
/* adjust tilte */
.solar_popup__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

/* ✅ allow title to shrink/wrap inside flex */
.solar_popup__title {
 
 display: block;
  white-space: normal;       
  overflow-wrap: anywhere;   
  word-break: break-word;
  line-height: 1.25;
  font-weight: 600;
  /* wrap long strings */
  overflow-wrap: anywhere;  
  word-break: break-word;
}

/* keep close button fixed size */
.solar_popup__close {
  flex: 0 0 auto;
}

/* small screens: allow multi-line header */
@media (max-width: 480px) {
  .solar_popup__header {
    align-items: flex-start;   
    padding-top: 12px;
    padding-bottom: 12px;
  }

  .solar_popup__title {
    font-size: 14px;           
  }
}
</style>
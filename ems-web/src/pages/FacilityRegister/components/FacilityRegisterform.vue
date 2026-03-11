<template>
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

 
  <v-container fluid class="register-page">

    <v-form ref="innerFormRef" @submit.prevent="handleSubmit">

      <v-row dense>
        <v-col cols="12" md="5" class="d-flex align-center">
          <span class="mr-1">{{ t('facility.facilityType') }}</span>
        </v-col>
        <v-col cols="12" md="7">
          <v-select
            v-model="form.facilityType"
            :items="facilityType"
            item-title="label"    
            item-value="code"     
            variant="outlined"
            density="compact"
            hide-details="auto"   
            data-test="facilityType"
            style="height:45px;"
          />
        </v-col>
      </v-row>

     
      <v-row dense style="margin-top: 18px;">
        <v-col cols="12" md="5" class="d-flex align-center">
          <span class="mr-1">{{ t('facility.facilityID') }}</span>
        </v-col>
        <v-col cols="12" md="7">
          <v-text-field
            v-model="form.facilityID"
            variant="outlined"
            disabled            
            style="font-weight:bold;"
            density="compact"
          />
        </v-col>
      </v-row>

    
      <v-row dense>
        <v-col cols="12" md="5" class="d-flex align-center">
          <span class="mr-1">{{ t('facility.ecoCompanyID') }}</span><span class="text-red">*</span>
        </v-col>
        <v-col cols="12" md="7">
          <v-text-field
            v-model="form.ecoCompanyID"
            :rules="rules.ecoCompanyID"  
            variant="outlined"
            density="compact"
            @update:modelValue="emit('clear-error', 'ecoCompanyID')" 
          />
        </v-col>
      </v-row>
   
      <v-row dense>
        <v-col cols="12" md="5" class="d-flex align-center">
          <span class="mr-1">{{ t('facility.ecoCompanyPassword') }}</span><span class="text-red">*</span>
        </v-col>
        <v-col cols="12" md="7">
          <v-text-field
            v-model="form.ecoCompanyPassword"
            prepend-inner-icon="mdi-account"   
            :type="showEcoPwd ? 'text' : 'password'"  
            autocomplete="new-password"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            :rules="rules.ecoCompanyPassword"
            variant="outlined"
            density="compact"
            @update:modelValue="emit('clear-error', 'ecoCompanyPassword')"
          >
            <!-- パスワード可視化/不可視化のトグルボタン -->
            <template #append-inner>
              <v-btn
                :icon="showEcoPwd ? 'mdi-eye-off' : 'mdi-eye'"
                variant="text"
                density="compact"
                :aria-label="showEcoPwd"
                @click="showEcoPwd = !showEcoPwd"
              />
            </template>
          </v-text-field>
        </v-col>
      </v-row>
  
      <v-row dense>
        <v-col cols="12" md="5" class="d-flex align-center">
          <span class="mr-1">{{ t('facility.facilityName') }}</span><span class="text-red">*</span>
        </v-col>
        <v-col cols="12" md="7">
          <v-text-field
            v-model="form.facilityName"
            :rules="rules.facilityName"
            variant="outlined"
            density="compact"
            @update:modelValue="emit('clear-error', 'facilityName')"
          />
        </v-col>
      </v-row>

    
      <v-row dense>
        <v-col cols="12" md="5" class="d-flex align-center">
          <span class="mr-1">{{ t('facility.facilityAddress') }}</span><span class="text-red">*</span>
        </v-col>
        <v-col cols="12" md="7">
          <v-text-field
            v-model="form.facilityAddress"
            :rules="rules.facilityAddress"
            variant="outlined"
            density="compact"
            @update:modelValue="emit('clear-error', 'facilityAddress')"
          />
        </v-col>
      </v-row>

      <v-row dense>
        <v-col cols="12" md="5" class="d-flex align-center">
          <span class="mr-1">{{ t('facility.cityInformation') }}</span><span class="text-red">*</span>
        </v-col>
        <v-col cols="12" md="7">
          <v-text-field
            v-model="form.cityInfo"
            :rules="rules.cityInfo"
            variant="outlined"
            density="compact"
            @update:modelValue="emit('clear-error', 'cityInfo')"
          />
        </v-col>
      </v-row>

      <v-row dense>
        <v-col cols="12" md="5" class="d-flex align-center">
          <span class="mr-1">{{ t('facility.imageFilename') }}</span><span class="text-red">*</span>
        </v-col>
        <v-col cols="12" md="7">
          <v-text-field
            v-model="form.imageFilename"
            :rules="rules.imageFilename" 
            variant="outlined"
            density="compact"
            readonly                     
          >
            <template #append-inner>
              <v-btn icon variant="text" size="small" @click="emit('open-image')">
                <v-icon size="28" color="#4CAF50">mdi-image</v-icon>
              </v-btn>
            </template>
          </v-text-field>
        </v-col>
      </v-row>

      <v-row dense style="margin-top: 16px; margin-bottom: 16px;">
        <v-col cols="12" md="5" class="d-flex align-center">
          <span class="mr-1">{{ t('facility.facilityStatus') }}</span>
        </v-col>
        <v-col cols="12" md="7">
          <v-select
            v-model="form.facilityStatus"
            :items="facilityStatus"
            item-title="label"
            item-value="code"
            variant="outlined"
            density="compact"
            hide-details="auto"
            style="height:45px;"
          />
        </v-col>
      </v-row>
   
      <v-row dense>
        <v-col cols="12" md="5" class="d-flex align-center">
          <span class="mr-1">{{ t('facility.facilityManagerName') }}</span>
        </v-col>
        <v-col cols="12" md="7">
          <v-text-field
            v-model="form.facilityManagerName"
            :rules="rules.facilityManagerName"
            variant="outlined"
            density="compact"
            @update:modelValue="emit('clear-error', 'facilityManagerName')"
          />
        </v-col>
      </v-row>

      <v-row dense>
        <v-col cols="12" md="5" class="d-flex align-center">
          <span class="mr-1">{{ t('facility.facilityManagerContact') }}</span>
        </v-col>
        <v-col cols="12" md="7">
          <v-text-field
            v-model="form.facilityManagerMail"
            :rules="rules.facilityManagerMail"
            variant="outlined"
            density="compact"
            @update:modelValue="emit('clear-error', 'facilityManagerMail')"
          />
        </v-col> 
      </v-row>
      <div class="d-flex gap-2 mt-4 btn-position">
        <v-btn
          type="reset"
          variant="tonal"
          @click="handleCancel"
          style="margin-right:4px;"
        >
          {{ t('common.registercancel') }}
        </v-btn>
        <v-btn
          type="submit"
          color="success"
          width="110"
        >
          {{ t('common.register') }}
        </v-btn>
      </div>
    </v-form>
  </v-container>
</template>
<script setup lang="ts">
import { ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VForm } from 'vuetify/components'
import type { ListItem, RegisterFormData } from '@/pages/FacilityRegister/FacilityRegister'
import { useGlobalLoading, type GlobalLoadingService } from '@/pages/Common/composables/GlobalLoading'
import { topErrorList } from '../composables/useFacilityRegister.ts'

const showEcoPwd = ref(false)
type Rule = (value: unknown) => string | boolean
type RulesMap = Record<string, Rule[]>
const { t } = useI18n()
const innerFormRef = ref<InstanceType<typeof VForm> | null>(null)
const form = defineModel<RegisterFormData>({ required: true })
const formRef = form as unknown as Ref<RegisterFormData>

const props = defineProps<{
  facilityType: ListItem[]
  facilityStatus: ListItem[]
  rules: RulesMap
  serverErrors: Record<string, string[]>
  onSubmit: () => Promise<void>
  onCancel?: () => Promise<void>
}>()

const emit = defineEmits<{
  (e: 'reset'): void
  (e: 'open-image'): void
  (e: 'clear-error', field: string): void
}>()


const gl: GlobalLoadingService = useGlobalLoading()


const handleSubmit = async () => {
  gl.show(t('') ?? undefined)
  try {
    if (props.onSubmit) {
      await props.onSubmit()
    } else {
      emit('reset')
    }
  } finally {
    gl.hide()
  }
}


const handleCancel = async () => {
  gl.show(t('') ?? undefined)
  try {
    if (props.onCancel) {
      await props.onCancel()
    } else {
      emit('reset')
    }
  } finally {
    gl.hide()
  }
}

watch(
  () => formRef.value.facilityType,  
  () => {
    formRef.value.imageFilename = ''  
    innerFormRef.value?.resetValidation()  
  }
)


defineExpose({
  validate: () => innerFormRef.value?.validate(),
  resetValidation: () => innerFormRef.value?.resetValidation(),
})
</script>

<style scoped>
.btn-position { justify-content: flex-end; }

.gap-2 { gap: 6px; }

form.v-form {
  width: 100%;
  margin: 0 auto;
}

@media (min-width: 1200px) and (max-width: 1599px) {
  form.v-form {
    width: 85%;
  }
}

@media (min-width: 1600px) {
  form.v-form {
    width: 60%;
    margin: 0 auto;
  }
}

.mr-1{
  font-size: 0.875rem;
  font-weight: 400;
  text-transform: none;
}
</style>
// src/pages/SolarPanel/composables/useBatteryEdit.ts
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { applyErrorsToPage } from '../../Common/error/errorResolver'
import { useI18n } from 'vue-i18n'
import { apiGet, apiPut } from '@/services/http'

/** -------------------- Domain types -------------------- */
// Align with handler.ts BatteryApiPayload
export type ApiPayload = {
  deviceID: string
  deviceNumber: number
  storageBatteryManufactureName: string
  storageBatteryModelNumber: string
  storageCapacityKwhPerH: number | null
  charageKwhPerH: number | null
  dischargePerKwhH: number | null
  installationLocation: string
  storageBatterySetupDate: string
}

export type EditInitResponse = {
  Battery: ApiPayload
}

export const topErrorList = ref<string[]>([])

/** UI form data (strings because v-model uses string) */
export type BatteryFormData = {
  deviceID: string
  storageBatteryManufactureName: string
  storageBatteryModelNumber: string
  storageCapacityKwhPerH: string
  charageKwhPerH: string
  dischargePerKwhH: string
  installationLocation: string
  storageBatterySetupDate: string
}

/** -------------------- API error types -------------------- */
export type ApiErrorCode =
  | 'E0001'
  | 'E0002'
  | 'E0003'
  | 'E0015'
  | 'E0004'
  | 'ERR_FACILITY_INVALID_EMAIL'
  | string

export type ApiErrorMeta = {
  max?: number
  expected?: unknown
  char?: unknown
  [key: string]: unknown
}

export type ApiErrorItem = {
  field: string
  code: ApiErrorCode
  meta?: ApiErrorMeta
  message?: string
}

export type ApiErrorResponse = {
  status: '400' | '404'
  code: string
  errors: ApiErrorItem[]
  meta?: { requestId: string; serverTime: string }
}

/** -------------------- Helpers -------------------- */
function toMessage(e: unknown, fallback = 'Something went wrong'): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  return fallback
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

// Convert empty -> null so server can truly detect "required"
function toNumberOrNull(s: string): number | null {
  const v = String(s ?? '').trim()
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function apiToForm(p: ApiPayload): BatteryFormData {
  return {
    deviceID: p.deviceID ?? '',
    storageBatteryManufactureName: p.storageBatteryManufactureName ?? '',
    storageBatteryModelNumber: p.storageBatteryModelNumber ?? '',
    storageCapacityKwhPerH: p.storageCapacityKwhPerH != null ? String(p.storageCapacityKwhPerH) : '',
    charageKwhPerH: p.charageKwhPerH != null ? String(p.charageKwhPerH) : '',
    dischargePerKwhH: p.dischargePerKwhH != null ? String(p.dischargePerKwhH) : '',
    installationLocation: p.installationLocation ?? '',
    storageBatterySetupDate: p.storageBatterySetupDate ?? '',
  }
}

function formToApi(
  f: BatteryFormData,
  deviceNumber: number
): ApiPayload {
  return {
    deviceNumber,
    deviceID: f.deviceID,
    storageBatteryManufactureName: f.storageBatteryManufactureName,
    storageBatteryModelNumber: f.storageBatteryModelNumber,
    storageCapacityKwhPerH: toNumberOrNull(f.storageCapacityKwhPerH),
    charageKwhPerH: toNumberOrNull(f.charageKwhPerH),
    dischargePerKwhH: toNumberOrNull(f.dischargePerKwhH),
    installationLocation: f.installationLocation,
    storageBatterySetupDate: f.storageBatterySetupDate,
  }
}

/** -------------------- i18n mapping (MATCH YOUR JSON) -------------------- */
// keys here must match API field names for error mapping/watchers
const fieldI18nKey: Record<string, string> = {
  deviceID: 'battery.equitmentID',
  storageBatteryManufactureName: 'battery.storageBatteryManufactureName',
  storageBatteryModelNumber: 'battery.storageBatteryModelNumber',
  storageCapacityKwhPerH: 'battery.storageCapacityKwhPerH',
  charageKwhPerH: 'battery.charageKwhPerH',
  dischargePerKwhH: 'battery.dischargePerKwhH',
  installationLocation: 'battery.installationLocation',
  storageBatterySetupDate: 'battery.installationDate',
}

type HttpErrorLike = { status: number; message: string; data?: unknown; name?: string }
function toHttpError(e: unknown): HttpErrorLike {
  if (e && typeof e === 'object') {
    const m = e as { status?: unknown; message?: unknown; data?: unknown }
    if (typeof m.status === 'number' && typeof m.message === 'string') {
      return { status: m.status, message: m.message, data: m.data }
    }
  }
  const msg = e instanceof Error ? e.message : 'Unknown error'
  return { status: 0, message: msg, data: undefined }
}

/** -------------------- Vuetify v-form ref type -------------------- */
type VFormRef = {
  validate: () => Promise<{ valid: boolean } | boolean>
  resetValidation?: () => void
}

export type Rule = (value: unknown) => string | boolean
export type RulesMap = Record<string, Rule[]>

/** -------------------- Composable -------------------- */
export function useBatteryEdit() {
  const router = useRouter()
  const route = useRoute()
  const { t } = useI18n()
  // const ERROR_PATH = '/error'
  const loading = ref(false)
  const submitLoading = ref(false)
  const error = ref<string | null>(null)
  const status = ref<number | null>(null)

  const msg = ref('')
  const successDialog = ref(false)
  const dialogMessage = ref('')

  // Vuetify form
  const formRef = ref<VFormRef | null>(null)

  // errors from server
  const serverErrors = ref<Record<string, string[]>>({})

  const formData = ref<BatteryFormData>({
    deviceID: '',
    storageBatteryManufactureName: '',
    storageBatteryModelNumber: '',
    storageCapacityKwhPerH: '',
    charageKwhPerH: '',
    dischargePerKwhH: '',
    installationLocation: '',
    storageBatterySetupDate: '',
  })
  const initialFormData = ref<BatteryFormData | null>(null)

  const allFieldErrors = computed(() => serverErrors.value)
  const allTopErrors = computed(() => topErrorList.value)

  function clearServerError(field: string) {
    if (serverErrors.value[field]) {
      const rest = { ...serverErrors.value }
      delete rest[field]
      serverErrors.value = rest
    }
  }

  function clearAllServerErrors() {
    serverErrors.value = {}
    topErrorList.value = []
  }

  function getRouteNumbers(): { deviceNumber: number } {
    const dn = Number(route.params.deviceNumber ?? 1)
    return { deviceNumber: Number.isFinite(dn) ? dn : 1 }
  }

  /** -------------------- Rules -------------------- */
  const requiredRule = (fieldKey: string): Rule => (value: unknown) => {
    const ok = asString(value).trim().length > 0
    return ok || t('error.E0001', [ t(fieldKey) ])
  }

  const maxRule = (fieldKey: string, max: number): Rule => (value: unknown) => {
    const v = asString(value).trim()
    const ok = v.length === 0 || v.length <= max
    return ok || t('error.E0002', [ t(fieldKey), String(max), '文字' ])
  }

  const numberRule = (fieldKey: string): Rule => (value: unknown) => {
    const v = String(value ?? '').trim()
    if (!v) return true // empty OK unless required separately
    const ok = /^\d+(\.\d+)?$/.test(v)
    return ok || t('error.E0003', { field: t(fieldKey) })
  }

  const stringRule = (fieldKey: string): Rule => (value: unknown) => {
    const v = String(value ?? '').trim()
    if (!v) return true
    const ok = !/^\d+(\.\d+)?$/.test(v)
    return ok || t('error.E0003', [ t(fieldKey), '文字列' ])
  }

  /** YYYY/MM/DD format + real date check */
  type DateRuleOptions = { required?: boolean }
  const dateYmdRule = (
    fieldKey: string,
    options: DateRuleOptions = {}
  ): Rule => (value: unknown) => {
    const s = String(value ?? '').trim()
    const required = options.required ?? false
    if (!s) {
      return required ? t('error.E0001', [ t(fieldKey) ]) : true
    }
    const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(s)
    if (!m) {
      return t('error.E0004', { field: t(fieldKey), char: 'YYYY/MM/DD' })
    }
    const month = Number(m[2])
    const day = Number(m[3])
    if (month < 1 || month > 12) {
      return t('error.E0004', { field: t(fieldKey), char: 'YYYY/MM/DD' })
    }
    return (day >= 1  ) || t('error.E0004', { field: t(fieldKey), char: 'YYYY/MM/DD' })
  }
  const rules: RulesMap = {
    storageBatteryManufactureName: [
      requiredRule('battery.storageBatteryManufactureName'),
      maxRule('battery.storageBatteryManufactureName', 30),
      stringRule('battery.storageBatteryManufactureName'),
    ],
    storageBatteryModelNumber: [
      requiredRule('battery.storageBatteryModelNumber'),
      maxRule('battery.storageBatteryModelNumber', 30),
      stringRule('battery.storageBatteryModelNumber'),
    ],
    storageCapacityKwhPerH: [
      requiredRule('battery.storageCapacityKwhPerH'),
      numberRule('battery.storageCapacityKwhPerH'),
    ],
    charageKwhPerH: [
      requiredRule('battery.charageKwhPerH'),
      numberRule('battery.charageKwhPerH'),
    ],
    dischargePerKwhH: [
      requiredRule('battery.dischargePerKwhH'),
      numberRule('battery.dischargePerKwhH'),
    ],
    installationLocation: [
      stringRule('battery.installationLocation'),
      maxRule('battery.installationLocation', 20),
    ],
    storageBatterySetupDate: [
      dateYmdRule('battery.installationDate', { required: true }),
    ],
  }

  /** -------------------- API: init + submit -------------------- */
  async function fetchInit() {
    loading.value = true
    error.value = null
    msg.value = ''
    clearAllServerErrors()

    try {
      const { deviceNumber } = getRouteNumbers()
      const url = `/batteries/${deviceNumber}/init`

      const data = await apiGet<EditInitResponse>(url, {
        headers: { Authorization: 'Bearer mock-token' },
      })

      const mapped = apiToForm(data.Battery)
      formData.value = mapped
      initialFormData.value = { ...mapped }
    } catch (e: unknown) {
      error.value = toMessage(e, 'Init load failed')
    } finally {
      loading.value = false
    }
  }

  async function resetToInitial() {
    msg.value = ''
    error.value = null
    clearAllServerErrors()
    if (initialFormData.value) {
      formData.value = { ...initialFormData.value }
    }
    formRef.value?.resetValidation?.()
  }

  async function onSubmit() {
    msg.value = ''
    error.value = null
    clearAllServerErrors()

    const vr = await formRef.value?.validate?.()
    const isValid = typeof vr === 'boolean' ? vr : vr?.valid === true
    if (!isValid) {
      error.value = t('message.error')
      return
    }

    submitLoading.value = true
    try {
      const { deviceNumber } = getRouteNumbers()
      const payloadBody = formToApi(formData.value, deviceNumber)

      await apiPut(`/batteries/${deviceNumber}`, payloadBody, {
        headers: { Authorization: 'Bearer mock-token' },
      })

      msg.value = t('message.success')
      dialogMessage.value = t('message.success')
      successDialog.value = true
    } catch (e: unknown) {
      const he = toHttpError(e)
      if (he.status === 400) {
        const res = he.data as ApiErrorResponse
        applyErrorsToPage(res, {
          topList: topErrorList,
          fieldMap: serverErrors,
          reset: true,
        })
        return
      }
      if (he.status === 500) {
        // FYI: your handler returns 500 on "success"; this triggers navigation
        await router.replace('/error')
        return
      }
      // default fallback message
      error.value = toMessage(e, '')
      if (!topErrorList.value.length) {
        topErrorList.value = [t('error.ERR_UNKNOWN')]
      }
    } finally {
      submitLoading.value = false
    }
  }

  /** -------------------- Clear field errors when user edits -------------------- */
  const fields = Object.keys(fieldI18nKey)
  for (const f of fields) {
    watch(
      () => (formData.value as Record<string, unknown>)[f],
      () => clearServerError(f)
    )
  }

  onMounted(fetchInit)

  return {
    loading,
    submitLoading,
    error,
    status,
    msg,
    successDialog,
    dialogMessage,
    formRef,
    formData,
    initialFormData,
    rules,
    serverErrors,
    topErrorList,
    allFieldErrors,
    allTopErrors,
    clearServerError,
    clearAllServerErrors,
    fetchInit,
    resetToInitial,
    onSubmit,
  }
}

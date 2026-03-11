// src/pages/SolarPanel/composables/useSolarPanelEdit.ts
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { apiGet, apiPut, HttpError } from '@/services/http'
const base = import.meta.env.VITE_API_BASE_URL;

/** -------------------- ドメイン型定義 -------------------- */
export type ApiPayload = {
  solarPanelNumber: number
  deviceNumber: number
  deviceID: string
  solarPanelID?: string
  panelManufacturerName: string
  panelModelNumber: string
  panelRatedPower: number
  panelTiltAngleDegree: number
  panelDirection: string
  panelSurfaceArea: number
  panleInstallLocation: string
  panelSetupDate: string
}

export type EditInitResponse = {
  Solarpanel: ApiPayload
}

/** -------------------- UIフォーム用データ（v-modelは文字列になるためstring） -------------------- */
export type SolarPanelFormData = {
  deviceID: string
  solarPanelID: string
  panelManufacturerName: string
  panelModelNumber: string
  panelRatedPower: string
  panelTiltAngleDegree: string
  panelDirection: string
  panelSurfaceArea: string
  /** NOTE: API側の項目名に合わせて維持 */
  panleInstallLocation: string
  panelSetupDate: string
}

/** -------------------- APIエラー型定義 -------------------- */
export type ApiErrorCode =
  | 'E0001'
  | 'E0002'
  | 'ERR_FACILITY_INVALID_EMAIL'
  | 'E0003'
  | 'E0015'
  | 'E0004'
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
  status: '400' | '404' | '409' | '500'
  code: string
  errors: ApiErrorItem[]
  meta?: { requestId: string; serverTime: string }
}

/** -------------------- ヘルパー関数（anyは使用しない） -------------------- */



/** エラーをメッセージ文字列に変換（fallbackは汎用文言） */
function toMessage(e: unknown, fallback = 'Something went wrong'): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  return fallback
}

/** 値をstring化（null/undefined→''） */
function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

/** 数値文字列→number（不正時は0） */
function toNumberOrZero(s: string): number {
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/** API→フォーム値へマッピング（数値は文字列化） */
function apiToForm(p: ApiPayload): SolarPanelFormData {
  return {
    deviceID: p.deviceID ?? '',
    solarPanelID: p.solarPanelID ?? '',
    panelManufacturerName: p.panelManufacturerName ?? '',
    panelModelNumber: p.panelModelNumber ?? '',
    panelRatedPower: p.panelRatedPower != null ? String(p.panelRatedPower) : '',
    panelTiltAngleDegree: p.panelTiltAngleDegree != null ? String(p.panelTiltAngleDegree) : '',
    panelDirection: p.panelDirection ?? '',
    panelSurfaceArea: p.panelSurfaceArea != null ? String(p.panelSurfaceArea) : '',
    // NOTE: API側のフィールド名はスペルミスだが互換性のため維持
    panleInstallLocation: p.panleInstallLocation ?? '',
    panelSetupDate: p.panelSetupDate ?? '',
  }
}
/** フォーム→APIペイロードへ変換（数値はNumber化） */
function formToApi(
  p: SolarPanelFormData,
  solarPanelNumber: number,
  deviceNumber: number
): ApiPayload {
  return {
    solarPanelNumber,
    deviceNumber,
    deviceID: p.deviceID,
    solarPanelID: p.solarPanelID ? p.solarPanelID : undefined,
    panelManufacturerName: p.panelManufacturerName,
    panelModelNumber: p.panelModelNumber,
    panelRatedPower: toNumberOrZero(p.panelRatedPower),
    panelTiltAngleDegree: toNumberOrZero(p.panelTiltAngleDegree),
    panelDirection: p.panelDirection,
    panelSurfaceArea: toNumberOrZero(p.panelSurfaceArea),
    // NOTE: API側のフィールド名はスペルミスだが互換性のため維持
    panleInstallLocation: p.panleInstallLocation,
    panelSetupDate: p.panelSetupDate,
  }
}
/** -------------------- i18n用フィールドマッピング -------------------- */
const fieldI18nKey: Record<string, string> = {
  deviceID: 'solarPanel.equitmentID',
  solarPanelID: 'solarPanel.panelID',
  panelManufacturerName: 'solarPanel.manufacturerName',
  panelModelNumber: 'solarPanel.modelNumber',
  panelRatedPower: 'solarPanel.ratedOutput',
  panelTiltAngleDegree: 'solarPanel.inclinationangle',
  panelDirection: 'solarPanel.direction',
  panelSurfaceArea: 'solarPanel.aera', // NOTE: 辞書側キーのタイポに合わせる
  panleInstallLocation: 'solarPanel.installationLocation',
  panelSetupDate: 'solarPanel.installationDate',
}

/** -------------------- Vuetify v-form の参照型 -------------------- */
type VFormRef = {
  validate: () => Promise<{ valid: boolean } | boolean>
  resetValidation?: () => void
}
export function isHttpError(e: unknown): e is HttpError {
    if (e instanceof HttpError) return true;
    if (typeof e === 'object' && e !== null) {
      const m = e as { statusCode?: unknown; message?: unknown; name?: unknown };
      const hasStatus = typeof m.statusCode === 'number';
      const hasMsg = typeof m.message === 'string';
      const isNamed = typeof m.name === 'string' ? m.name === 'HttpError' : true;
      return hasStatus && hasMsg && isNamed;
    }
    return false;
  }
export type Rule = (value: unknown) => string | boolean
export type RulesMap = Record<string, Rule[]>

/** -------------------- コンポーザブル本体 -------------------- */
export function useSolarPanelEdit() {
  // ✅ composable内（またはsetup()）でのみ使用
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()

  // ---- UIステート ----
  const loading = ref(false)
  const submitLoading = ref(false)
  const error = ref<string | null>(null)
  const status = ref<number | null>(null)

  const msg = ref('')
  const successDialog = ref(false)
  const dialogMessage = ref('')
  const ERROR_PATH = '/error'
  // Vuetify v-form の参照
  const formRef = ref<VFormRef | null>(null)

  // サーバーからのエラー（フィールド別 / 上部リスト）
  const serverErrors = ref<Record<string, string[]>>({})
  const topErrorList = ref<string[]>([])

  // 入力フォーム値
  const formData = ref<SolarPanelFormData>({
    deviceID: '',
    solarPanelID: '',
    panelManufacturerName: '',
    panelModelNumber: '',
    panelRatedPower: '',
    panelTiltAngleDegree: '',
    panelDirection: '',
    panelSurfaceArea: '',
    panleInstallLocation: '',
    panelSetupDate: '',
  })
  const initialFormData = ref<SolarPanelFormData | null>(null)

  /** テンプレート側でまとめて参照したい場合 */
  const allFieldErrors = computed(() => serverErrors.value)
  const allTopErrors = computed(() => topErrorList.value)

  /** 指定フィールドのサーバーエラーをクリア */
  function clearServerError(field: string) {
    if (serverErrors.value[field]) {
      const rest = { ...serverErrors.value }
      delete rest[field]
      serverErrors.value = rest
    }
  }

  /** すべてのサーバーエラーをクリア */
  function clearAllServerErrors() {
    serverErrors.value = {}
    topErrorList.value = []
  }

  /** ルートパラメータから番号を取得（不正時は既定値にフォールバック） */
  function getRouteNumbers(): { solarPanelNumber: number; deviceNumber: number } {
    const sp = Number(route.params.solarPanelNumber ?? 2)
    const dn = Number(route.params.deviceNumber ?? 1)

    return {
      solarPanelNumber: Number.isFinite(sp) ? sp : 2,
      deviceNumber: Number.isFinite(dn) ? dn : 1,
    }
  }

  /** -------------------- 入力チェックルール（FacilityRegisterと同形式） -------------------- */

  /** 必須チェック */
  const requiredRule = (fieldKey: string): Rule => (value: unknown) => {
    const ok = asString(value).trim().length > 0
    return ok || t('error.E0001', { field: t(fieldKey) })
  }

  /** 最大文字数チェック */
  const maxRule = (fieldKey: string, max: number): Rule => (value: unknown) => {
    const v = asString(value).trim()
    const ok = v.length === 0 || v.length <= max
    return ok || t('error.E0002', { field: t(fieldKey), max })
  }

  /** 整数チェック（数字のみ） */
  const integerRule = (fieldKey: string): Rule => (value: unknown) => {
    const v = String(value ?? '').trim()
    if (!v) return true
    const ok = /^\d+$/.test(v)
    return ok || t('error.E0003', { field: t(fieldKey), expected: '数字' })
  }

  /** 純粋な数値のみは不可（文字列を期待） */
  const StringRule = (fieldKey: string): Rule => (value: unknown) => {
    const v = String(value ?? '').trim()
    if (!v) return true
    const ok = !/^\d+(\.\d+)?$/.test(v)
    return ok || t('error.E0003', { field: t(fieldKey), expected: '文字列' })
  }

  /** 半角英数字とハイフンのみ許可 */
  const nothalfwidthRule = (fieldKey: string): Rule => (value: unknown) => {
    const v = String(value ?? '').trim()
    if (!v) return true
    const ok = /^[A-Za-z0-9-]+$/.test(v)
    return ok || t('error.E0003', {
      field: t(fieldKey),
      expected: '半角英数字',
    })
  }

  // -------------------- ルール内・共通ユーティリティ --------------------
  const toTrimmedString = (v: unknown) => String(v ?? '').trim()

  const toIntOrNull = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
    const s = toTrimmedString(v)
    if (!/^\d+$/.test(s)) return null
    return Number(s)
  }

  /** 桁数最大チェック（数字のみ許可） */
  const maxDigitsRule = (fieldKey: string, max: number): Rule => (value: unknown) => {
    const s = toTrimmedString(value)
    if (!s) return true
    if (!/^\d+$/.test(s)) {
      return t('error.E0003', { field: t(fieldKey), expected: '数字' })
    }
    const ok = s.length <= max
    return ok || t('error.E0002', { field: t(fieldKey), max })
  }

  /** 角度（0〜90）チェック */
  const angle0to90Rule = (fieldKey: string): Rule => (value: unknown) => {
    const s = toTrimmedString(value)
    if (!s) return true
    const n = toIntOrNull(value)
    if (n == null) {
      return t('error.E0003', { field: t(fieldKey), expected: '数字' })
    }
    const ok = n >= 0 && n <= 90
    return ok || t('error.E0015', { field: t(fieldKey), min: 0, max: 90, char: '0〜90' })
  }
  
  // yyyy/mm/dd 形式チェック
  type DateRuleOptions = { required?: boolean }

  /** YYYY/MM/DD形式 + 実在日付チェック */
  const dateYmdRule = (
    fieldKey: string,
    options: DateRuleOptions = {}
  ): Rule => (value: unknown) => {
    const s = String(value ?? '').trim()
    const required = options.required ?? false
    if (!s) {
      return required ? t('error.E0001', { field: t(fieldKey) }) : true
    }
    const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(s)
    if (!m) {
      return t('error.E0004', { field: t(fieldKey), char: 'YYYY/MM/DD' })
    }
    const year = Number(m[1])
    const month = Number(m[2])
    const day = Number(m[3])
    if (month < 1 || month > 12) {
      return t('error.E0004', { field: t(fieldKey), char: 'YYYY/MM/DD' })
    }
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
    const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    const maxDay = daysInMonth[month - 1]
    if (maxDay === undefined) {
      return t('error.E0004', { field: t(fieldKey), char: 'YYYY/MM/DD' })
    }
    return (day >= 1 && day <= maxDay) || t('error.E0004', { field: t(fieldKey), char: 'YYYY/MM/DD' })
  }

  /** 入力チェックルール定義 */
  const rules: RulesMap = {
    solarPanelID: [
      requiredRule('solarPanel.panelID'),
      maxRule('solarPanel.panelID', 10),
      StringRule('solarPanel.panelID'),
    ],
    panelManufacturerName: [
      requiredRule('solarPanel.manufacturerName'),
      maxRule('solarPanel.manufacturerName', 30),
      StringRule('solarPanel.manufacturerName'),
    ],
    panelDirection: [
      requiredRule('solarPanel.direction'),
      maxRule('solarPanel.direction', 10),
      StringRule('solarPanel.direction'),
    ],
    panelModelNumber: [
      maxRule('solarPanel.modelNumber', 10),
      requiredRule('solarPanel.modelNumber'),
      nothalfwidthRule('solarPanel.modelNumber'),
    ],
    panelRatedPower: [
      requiredRule('solarPanel.ratedOutput'),
      integerRule('solarPanel.ratedOutput'),
      maxDigitsRule('solarPanel.ratedOutput', 3),
    ],
    panelTiltAngleDegree: [
      requiredRule('solarPanel.inclinationangle'),
      integerRule('solarPanel.inclinationangle'),
      angle0to90Rule('solarPanel.inclinationangle'),
      // FIX: i18nキーの不整合を修正（panelTiltAngleDegree → inclinationangle）
      maxRule('solarPanel.inclinationangle', 2),
    ],
    panelSurfaceArea: [
      integerRule('solarPanel.aera'),
      // FIX: 誤参照修正（inclinationangle → aera）
      requiredRule('solarPanel.aera'),
      maxRule('solarPanel.aera', 10),
    ],
    panleInstallLocation: [
      maxRule('solarPanel.installationLocation', 20),
      StringRule('solarPanel.installationLocation'),
    ],
    panelSetupDate: [
      maxRule('solarPanel.installationDate', 10),
      dateYmdRule('solarPanel.installationDate'),
    ],
  }
  /** -------------------- API処理：初期表示 + 送信 -------------------- */

  /** 初期データ読込（/init） */
  async function fetchInit() {
    loading.value = true
    error.value = null
    msg.value = ''
    clearAllServerErrors()
    try {
      const { solarPanelNumber, deviceNumber } = getRouteNumbers()
      const url =  `${base.replace(/\/+$/, '')}` + `/solar-panels/${solarPanelNumber}/${deviceNumber}/init`
      const data = await apiGet<EditInitResponse>(url, {
        headers: { Authorization: 'Bearer mock-token' },
      })
      const mapped = apiToForm(data.Solarpanel)
      formData.value = mapped
      initialFormData.value = { ...mapped }
    } catch (e: unknown) {
      error.value = toMessage(e, 'Init load failed')
    } finally {
      loading.value = false
    }
  }
  /** 初期値へリセット（バリデーションもリセット） */
  async function resetToInitial() {
    msg.value = ''
    error.value = null
    clearAllServerErrors()
    if (initialFormData.value) {
      formData.value = { ...initialFormData.value }
    }
    formRef.value?.resetValidation?.()
  }

  /** 送信処理（PUT） */
  async function onSubmit() {
    msg.value = ''
    error.value = null
    clearAllServerErrors()

    // クライアント側バリデーション
    const vr = await formRef.value?.validate?.()
    const isValid = typeof vr === 'boolean' ? vr : vr?.valid === true
    if (!isValid) {
      error.value = t('message.error')
      return
    }

    submitLoading.value = true
    try {
      const { solarPanelNumber, deviceNumber } = getRouteNumbers()
      const payload = formToApi(formData.value, solarPanelNumber, deviceNumber)

      // 成功時：2xx
      await apiPut(`${base.replace(/\/+$/, '')}` +`/solar-panels/${solarPanelNumber}/${deviceNumber}`, payload)

      // 成功後の画面遷移（必要に応じて有効化）
      // await router.push({ name: 'FacilityEdit' })
      return
    } catch (e: unknown) {
        if (isHttpError(e)) {
            if (e.statusCode === 500) {
              await router.replace(ERROR_PATH)
              return
            }
          }
   {
        // 通信外例外
        error.value = toMessage(e, 'Submit failed')
      }
    } finally {
      submitLoading.value = false
    }
  }

  /** -------------------- 編集時のサーバーエラークリア（フィールド単位） -------------------- */
  const fields = Object.keys(fieldI18nKey)
  for (const f of fields) {
    watch(
      () => (formData.value as Record<string, unknown>)[f],
      () => clearServerError(f)
    )
  }

  // マウント時に初期データ取得
  onMounted(fetchInit)

  return {
    // UI状態
    loading,
    submitLoading,
    error,
    status,
    msg,

    // ダイアログ
    successDialog,
    dialogMessage,

    // フォーム
    formRef,
    formData,
    initialFormData,

    // ルール
    rules,
    // エラー
    serverErrors,
    topErrorList,
    allFieldErrors,
    allTopErrors,
    clearServerError,
    clearAllServerErrors,

    // アクション
    fetchInit,
    resetToInitial,
    onSubmit,
  }
}

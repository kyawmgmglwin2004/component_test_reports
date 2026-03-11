import { ref, type Ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { apiGet, apiPut } from '@/services/http'
import { useI18n } from 'vue-i18n'
import { applyErrorsToPage } from '@/pages/Common/error/errorResolver';
import { useGlobalLoading } from '@/pages/Common/composables/GlobalLoading';
import { useRouter } from 'vue-router'
/** 初期表示API（/init）が返すデータの型 */
export type ApiPayload = {
  deviceNumber: number
  PCSNumber: number
  deviceID: string
  PCSID: string
  pcslManufacturerName: string
  PCSModelNumber: string
  PCSInstallLocation: string
  PCSSetupDate: string
}
const base=import.meta.env.VITE_API_BASE_URL;
/** 親コンポーネントから受け取る参照（設備番号 / PCS番号） */
type Options = {
  deviceNumberRef?: Ref<string | null | undefined>
  pcsNumberRef?: Ref<string | null | undefined>
}
/** /init レスポンス型 */
export type EditInitResponse = {
  PCSInfo: ApiPayload
}

/** 画面フォーム用の型（v-model と相性を合わせ、すべて文字列） */
export type PCSInfoFormData = {
  deviceID: string
  PCSID: string
  pcslManufacturerName?: string
  PCSModelNumber: string
  PCSInstallLocation: string
  PCSSetupDate: string
}

/** HTTPエラーの最小表現（status と任意の data） */
type HttpErrorLike = {
  status: number
  data?: unknown
}

/** 型ガード：引数が HttpErrorLike かどうか */
function isHttpError(e: unknown): e is HttpErrorLike {
  if (typeof e !== 'object' || e === null) return false
  return 'status' in e && typeof (e as { status?: unknown }).status === 'number'
}

/** PCS編集用コンポーザブルの本体 */
type VFormMethods = { validate: () => Promise<{ valid: boolean }>; reset: () => void; resetValidation: () => void }

export function usePCSEdit(options: Options = {}) {
  const { t } = useI18n()
  const route = useRoute()
const router = useRouter()
  const formRef = ref<VFormMethods | null>(null)
  const gl = useGlobalLoading();

  const loading = ref(false)
  const error = ref<string | null>(null) 
  const submitting = ref(false)
  const success = ref<string | null>(null) 
  const statusCode = ref<number | null>(null)

  const serverErrors = ref<Record<string, string[]>>({})
  const topErrorList = ref<string[]>([])

  const formData = ref<PCSInfoFormData>({
    deviceID: '',
    PCSID: '',
    pcslManufacturerName: '',
    PCSModelNumber: '',
    PCSInstallLocation: '',
    PCSSetupDate: '',
  })

  /** 初期スナップショット（キャンセル用に保持） */
  const initialForm = ref<PCSInfoFormData>({
    deviceID: '',
    PCSID: '',
    pcslManufacturerName: '',
    PCSModelNumber: '',
    PCSInstallLocation: '',
    PCSSetupDate: '',
  })

  function apiToForm(p: ApiPayload): PCSInfoFormData {
    return {
      deviceID: p.deviceID ?? '',
      PCSID: p.PCSID ?? '',
      pcslManufacturerName: p.pcslManufacturerName ?? '',
      PCSModelNumber: p.PCSModelNumber ?? '',
      PCSInstallLocation: p.PCSInstallLocation ?? '',
      PCSSetupDate: p.PCSSetupDate ?? '',
    }
  }

  function snapshotInitial() {
    initialForm.value = { ...formData.value }
  }

  function clearServerError(field: string): void {
    if (serverErrors.value[field]) {
      const rest = { ...serverErrors.value }
      delete rest[field]
      serverErrors.value = rest
    }
  }

  function clearAllServerErrors(): void {
    serverErrors.value = {}
    topErrorList.value = []
  }

/** 日付（YYYY/MM/DD）チェック。required=true で必須化も可能 */
  const dateYmdRule =
    (fieldKey: string, { required = false } = {}) =>
    (v: string) => {
      if (!v || !String(v).trim().length) {
        if (required) {
          return t('error.E0001', [ t(fieldKey) ])
        }
        return true
      }

      const s = String(v).trim()
      const m = s.match(/^(\d{4})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/)
      if (!m) {
        return t('error.E0004', [t(fieldKey),'YYYY/MM/DD' ])
      }

      const year = Number(m[1])
      const month = Number(m[2])
      const day = Number(m[3])

      const d = new Date(year, month - 1, day)
      const isValid =
        d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
        return (isValid || t('error.E0004', [ t(fieldKey), 'YYYY/MM/DD' ]))
    }

  /** 必須チェック（文字列 or boolean の true を期待） */
  const requiredRule =
    (fieldKey: string) =>
    (v: string | boolean) => {
      const ok = typeof v === 'boolean' ? v === true : !!(v && String(v).trim().length)
      return ok || t('error.E0001', [t(fieldKey) ])
    }
  /** 最大長チェック。第3引数の unit で「文字列／半角文字列」等を表示 */
  const maxRule =
    (fieldKey: string, max: number, unit: string) =>
    (v: string) => {
      const ok = !v || v.trim().length <= max
      return ok || t('error.E0002', [t(fieldKey),String(max), String(unit) ])
    }
/** 各項目の rules セット（Vuetify の :rules に渡す） */
  const rules = {
    PCSID: [requiredRule('PCSInfo.PCSID'), maxRule('PCSInfo.PCSID', 10,'文字列')],
    pcslManufacturerName: [
      requiredRule('PCSInfo.pcslManufacturerName'),
      maxRule('PCSInfo.pcslManufacturerName', 30,'文字列'),
    ],
    PCSModelNumber: [requiredRule('PCSInfo.PCSModelNumber'), maxRule('PCSInfo.PCSModelNumber', 10,'半角文字列')],
    PCSInstallLocation: [maxRule('PCSInfo.PCSInstallLocation', 20,'文字列')],
    PCSSetupDate: [dateYmdRule('PCSInfo.PCSSetupDate'), maxRule('PCSInfo.PCSSetupDate', 10,'半角文字列')],
  }

  /** 上部に出す簡易チェック（必須漏れを行単位メッセージで通知） */
  function validate(): string[] {
    const errs: string[] = []
    if (!formData.value.PCSID?.trim())
      errs.push(t('error.E0001', [ t('PCSInfo.PCSID') ]))
    if (!formData.value.pcslManufacturerName?.trim())
      errs.push(t('error.E0001', [ t('PCSInfo.pcslManufacturerName') ]))
    if (!formData.value.PCSModelNumber?.trim())
      errs.push(t('error.E0001', [ t('PCSInfo.PCSModelNumber') ]))
    return errs
  }

/** キャンセル：初期スナップショットへ戻し、エラー類も初期化 */
  function resetToInitialState() {
    Object.assign(formData.value, initialForm.value)
    formRef.value?.resetValidation?.()
    error.value = null
    success.value = null
    submitting.value = false
    clearAllServerErrors()
  }

  function onCancel() {
    resetToInitialState()
  }
    type HttpErrorLike = { status: number; message: string; data?: unknown; name?: string }
  function toHttpError(e: unknown): HttpErrorLike {
    if (e && typeof e === 'object') {
      const m = e as { status?: unknown; message?: unknown; data?: unknown }
      if (typeof m.status === 'number' && typeof m.message === 'string') {
        return { status: m.status, message: m.message, data: m.data }
      }
    }
    // This path should never happen if http.ts always throws HttpError
    // but still return a consistent shape (status 0) just in case
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return { status: 0, message: msg, data: undefined }
  }
  function toNetworkMessage(e: unknown, fallback: string): string {
    const he = toHttpError(e) // your existing normalizer: { status, message, data }
    const msg = (he.message ?? '').trim()

    // Treat status 0 (or undefined) as network error; 503/504 are also reasonable candidates
    const looksLikeNetwork =
      typeof he.status !== 'number' ||
      he.status === 0 ||
      he.status === 503 ||
      he.status === 504

    // Also override well-known generic browser messages
    const isGenericBrowserMsg =
      /^failed to fetch$/i.test(msg) ||
      /network\s*error/i.test(msg) ||
      /load failed/i.test(msg)

    if (looksLikeNetwork || isGenericBrowserMsg || msg.length === 0) {
      return fallback
    }
    return msg
  }
const effectiveDeviceNumber = computed<string | null>(() => {
    if (options.deviceNumberRef?.value) return options.deviceNumberRef.value
    const p = route.params.deviceNumber
    return (typeof p === 'string' && p) ? p : null
  })
  const effectivePcsNumber = computed<string | null>(() => {
    if (options.pcsNumberRef?.value) return options.pcsNumberRef.value
    const p = route.params.PCSNumber || route.params.pcsNumber // depends on your route key
    return (typeof p === 'string' && p) ? p : null
  })

  const toNum = (val: string, label: string) => {
    const n = Number(val)
    if (!Number.isFinite(n)) throw new Error(`Invalid ${label}`)
    return n
  }
  // ---- 初期取得（/init） ----
  async function fetchInit() {
    loading.value = true
    error.value = null
    success.value = null
    clearAllServerErrors()
    gl.show();

    try {
     
const dev = effectiveDeviceNumber.value
      const pcs = effectivePcsNumber.value
      if (!dev || !pcs) throw new Error('Missing deviceNumber or pcsNumber')

      const devId = toNum(dev, 'deviceNumber')
      const pcsId = toNum(pcs, 'pcsNumber')
      const url = `${base.replace(/\/+$/, '')}/devices/${devId}/pcs/${pcsId}/init`

      const data = await apiGet<EditInitResponse>(url, {
        headers: { Authorization: 'Bearer mock-token' },
      })

      const uiModel = apiToForm(data.PCSInfo)
      Object.assign(formData.value, uiModel)
      snapshotInitial()
      formRef.value?.resetValidation?.()
    } catch (e: unknown) {
    if (isHttpError(e)) {
      if (e.status === 500) {
        router.push({ name: 'CommonError', query: { returnTo: route.fullPath } });
        return;                     
        }
    const raw = e.data; 
    applyErrorsToPage(raw, {
      topList: topErrorList,
      fieldMap: serverErrors,
      reset: true,
    });
    error.value = topErrorList.value[0] ?? '不明なエラーが発生しました。';
    return false;
  }
    const hasNoPageErrors =
        topErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0

      if (hasNoPageErrors) {
        const message = toNetworkMessage(e, t('error.E0038'))
        topErrorList.value = [message]
      }
      error.value = ''
    }finally {
      gl.hide();
      loading.value = false
    }
  }
  // ---- 更新（PUT） ----
  async function onSubmit() {
    clearAllServerErrors()
    error.value = null
    success.value = null
    serverErrors.value = {}
    topErrorList.value = []


    if (!formRef.value?.validate) {
      error.value = (t('message.error') as string) || 'エラーを修正して、もう一度お試しください。'
      return false
    }

    const { valid } = await formRef.value.validate()
    if (!valid) {
      error.value = (t('message.error') as string) || 'エラーを修正して、もう一度お試しください。'
      return false 
    }

    const errs = validate()
      if (errs.length) {
    topErrorList.value = errs;
    error.value = null
    return false
  }
    
 if (formRef.value?.validate) {
    const { valid } = await formRef.value.validate()
    if (!valid) {
      error.value = t('message.error') as string || 'エラーを修正して、もう一度お試しください。'
      return false                          
    }
  }

    submitting.value = true
    gl.show();
    try {
      const dev = effectiveDeviceNumber.value
      const pcs = effectivePcsNumber.value
      if (!dev || !pcs) throw new Error('Missing deviceNumber or pcsNumber')

      const devId = toNum(dev, 'deviceNumber')
      const pcsId = toNum(pcs, 'pcsNumber')
      const url = `${base.replace(/\/+$/, '')}/devices/${devId}/pcs/${pcsId}`


      const res = await apiPut(url, formData.value, {
        headers: { Authorization: 'Bearer mock-token' },
      })

    if (res instanceof Response) {
  if (!res.ok) {
    if (res.status === 500) {
        router.push({ name: 'CommonError', query: { returnTo: route.fullPath } });
        return;                       
        }
    const bodyText = await res.text()           
    applyErrorsToPage(bodyText, {                
      topList: topErrorList,
      fieldMap: serverErrors,
      reset: true,
    })
    error.value = topErrorList.value[0] ?? '更新に失敗しました。'
    return false
  }
  const data = await res.json() as { message?: string }
  success.value = data?.message ?? '更新しました。'
  return true
}

    return true;
    } catch (e: unknown) {
  if (isHttpError(e)) {
    if (e.status === 500) {
        router.push({ name: 'CommonError', query: { returnTo: route.fullPath } });
        return;                      
        }
    const raw = e.data; 
    applyErrorsToPage(raw, {
      topList: topErrorList,
      fieldMap: serverErrors,
      reset: true,
    });
    error.value = topErrorList.value[0] ?? '不明なエラーが発生しました。';
    return false;
  }
    const hasNoPageErrors =
        topErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0

      if (hasNoPageErrors) {
        const message = toNetworkMessage(e, t('error.E0038'))
        topErrorList.value = [message]
      }
    error.value = ''

    } finally {
      gl.hide();
      submitting.value = false
    }
  }

  return {

    formData,
    loading,
    error,
    success,
    submitting,
    serverErrors,
    topErrorList,

    rules,
    formRef,
    statusCode,

    fetchInit,
    onCancel,
    onSubmit,
    clearServerError,
  }
}
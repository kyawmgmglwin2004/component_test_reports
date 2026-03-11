import { ref, type Ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiGet, apiPut } from '@/services/http'
import { useI18n } from 'vue-i18n'
import { applyErrorsToPage } from '@/pages/Common/error/errorResolver'
import { useGlobalLoading } from '@/pages/Common/composables/GlobalLoading'

/** API 初期表示で返却されるペイロード型 */
export type ApiPayload = {
  deviceNumber: number
  deviceID: string
  smartmeterManufacturerName: string
  smartmeterModelNumber: string
  smartmeterInstallLocation: string
  smartmeterSetupDate: string
  updatedAt: string
}

const base = import.meta.env.VITE_API_BASE_URL

/** 初期化 API のレスポンス型 */
export type EditInitResponse = {
  SmartMeterInfo: ApiPayload
}

/** 画面のフォームデータ（すべて文字列。v-model と相性を合わせるため） */
export type SmartMeterInfoFormData = {
  deviceID: string
  smartmeterManufacturerName: string
  smartmeterModelNumber: string
  smartmeterInstallLocation: string
  smartmeterSetupDate: string
  updatedAt: string
}

/** オプション（親から参照値や共通エラー切替などを注入したい場合に使用） */
type Options = {
  deviceNumberRef?: Ref<string | null | undefined>
  setCommonErrorVisible?: (v: boolean) => void   // 共通エラーページ表示切替（未使用なら不要）
  setReturnToPath?: (p: string) => void          // 戻り先パスの指定（未使用なら不要）
}

/** HTTP エラーの最小表現 */
type HttpErrorLike = {
  status: number
  data?: unknown
}

/** 型ガード：上記の HTTP エラーかどうか */
function isHttpError(e: unknown): e is HttpErrorLike {
  if (typeof e !== 'object' || e === null) return false
  return 'status' in e && typeof (e as { status?: unknown }).status === 'number'
}

/** Vuetify v3 の <v-form> メソッド型 */
type VFormMethods = {
  validate: () => Promise<{ valid: boolean }>
  reset: () => void
  resetValidation: () => void
}

/** メインのコンポーザブル */
export function useSmartMeterEdit(options: Options = {}) {
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()

  // ---- Refs / 状態管理 ----
  const formRef = ref<VFormMethods | null>(null)            // v-form 参照
  const gl = useGlobalLoading()                              // 共通ローディング

  const loading = ref(false)                                 // 初期取得中のローディング
  const error = ref<string | null>(null)                     // 上部バナー用のエラーメッセージ
  const submitting = ref(false)                              // 更新中フラグ
  const success = ref<string | null>(null)                   // 成功メッセージ
  const serverErrors = ref<Record<string, string[]>>({})     // 項目ごとのサーバエラー
  const topErrorList = ref<string[]>([])                     // 画面上部に並べるエラー一覧
  const isFormValid = ref<boolean>(false)                    // v-form の妥当性（ボタン制御用）

  // ---- 画面フォームの実体 ----
  const formData = ref<SmartMeterInfoFormData>({
    deviceID: '',
    smartmeterManufacturerName: '',
    smartmeterModelNumber: '',
    smartmeterInstallLocation: '',
    smartmeterSetupDate: '',
    updatedAt: '',
  })

  // 初期スナップショット（キャンセル時に戻すため）
  const initialForm = ref<SmartMeterInfoFormData>({
    deviceID: '',
    smartmeterManufacturerName: '',
    smartmeterModelNumber: '',
    smartmeterInstallLocation: '',
    smartmeterSetupDate: '',
    updatedAt: '',
  })

  /** API → 画面フォームへのマッピング */
  function apiToForm(p: ApiPayload): SmartMeterInfoFormData {
    return {
      deviceID: p.deviceID ?? '',
      smartmeterManufacturerName: p.smartmeterManufacturerName ?? '',
      smartmeterModelNumber: p.smartmeterModelNumber ?? '',
      smartmeterInstallLocation: p.smartmeterInstallLocation ?? '',
      smartmeterSetupDate: p.smartmeterSetupDate ?? '',
      updatedAt: p.updatedAt ?? '',
    }
  }

  /** 現在のフォーム値をスナップショットに保存（キャンセル用） */
  function snapshotInitial() {
    initialForm.value = { ...formData.value }
  }

  /** サーバエラー（項目単位）を個別にクリア */
  function clearServerError(field: string): void {
    if (serverErrors.value[field]) {
      const rest = { ...serverErrors.value }
      delete rest[field]
      serverErrors.value = rest
    }
  }

  /** サーバエラーを全クリア */
  function clearAllServerErrors(): void {
    serverErrors.value = {}
    topErrorList.value = []
  }

  // ---- 入力ルール（Vuetify rules） ----

  /** 日付（YYYY/MM/DD）チェック。required=true のとき必須も兼ねる */
  const dateYmdRule =
    (fieldKey: string, { required = false } = {}) =>
    (v: string) => {
      if (!v || !String(v).trim().length) {
        if (required) return t('error.E0001', [t(fieldKey)])
        return true
      }
      const s = String(v).trim()
      const m = s.match(/^(\d{4})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/)
      if (!m) return t('error.E0004', [t(fieldKey), 'YYYY/MM/DD'])
      const year = Number(m[1])
      const month = Number(m[2])
      const day = Number(m[3])
      const d = new Date(year, month - 1, day)
      const isValid = d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
      return isValid || t('error.E0004', [t(fieldKey), 'YYYY/MM/DD'])
    }

  /** 必須チェック */
  const requiredRule =
    (fieldKey: string) =>
    (v: string | boolean) => {
      const ok = typeof v === 'boolean' ? v === true : !!(v && String(v).trim().length)
      return ok || t('error.E0001', [t(fieldKey)])
    }

  /** 最大文字数チェック（第3引数 unit で「文字」「半角文字列」などを表示調整） */
  const maxRule =
    (fieldKey: string, max: number, unit: string) =>
    (v: string) => {
      const ok = !v || v.trim().length <= max
      return ok || t('error.E0002', [t(fieldKey), String(max), String(unit)])
    }

  /** フィールドごとの rules 定義（Vuetify に渡す） */
  const rules = {
    smartmeterManufacturerName: [
      requiredRule('smartMeter.smartmeterManufacturerName'),
      maxRule('smartMeter.smartmeterManufacturerName', 30, '文字列'),
    ],
    smartmeterModelNumber: [
      requiredRule('smartMeter.smartmeterModelNumber'),
      maxRule('smartMeter.smartmeterModelNumber', 10, '半角文字列'),
    ],
    smartmeterInstallLocation: [maxRule('smartMeter.smartmeterInstallLocation', 20, '文字列')],
    smartmeterSetupDate: [
      dateYmdRule('smartMeter.smartmeterSetupDate'),
      maxRule('smartMeter.smartmeterSetupDate', 10, '半角文字列'),
    ],
  }

  /** 簡易バリデーション（上部に行単位で出すメッセージリストを作成） */
  function validate(): string[] {
    const errs: string[] = []
    if (!formData.value.smartmeterManufacturerName?.trim())
      errs.push(t('error.E0001', [t('smartMeter.smartmeterManufacturerName')]))
    if (!formData.value.smartmeterModelNumber?.trim())
      errs.push(t('error.E0001', [t('smartMeter.smartmeterModelNumber')]))
    return errs
  }

  /** キャンセル：初期状態へ戻し、エラー類もクリア */
  function resetToInitialState() {
    Object.assign(formData.value, initialForm.value)
    formRef.value?.resetValidation?.()
    error.value = null
    success.value = null
    submitting.value = false
    clearAllServerErrors()
  }

  /** デバイス番号の有効化（props or ルートパラメータ） */
  const effectiveDeviceNumber = computed<string | null>(() => {
    if (options.deviceNumberRef?.value) return options.deviceNumberRef.value
    const p = route.params.deviceNumber
    return typeof p === 'string' && p ? p : null
  })

  /** 文字列 → 数値（不正なら例外） */
  function toNumericIdOrThrow(id: string): number {
    const n = Number(id)
    if (!Number.isFinite(n)) throw new Error('Invalid deviceNumber')
    return n
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
  /** 初期表示：API 呼び出し → 画面へ反映。500 は共通エラーページへ遷移 */
  async function fetchInit(): Promise<boolean> {
    loading.value = true
    error.value = null
    success.value = null
    clearAllServerErrors()
    gl.show()

    try {
      const id = effectiveDeviceNumber.value
      if (!id) throw new Error('Invalid deviceNumber (missing in props and route)')

      const deviceNo = toNumericIdOrThrow(id)
      const url = `${base.replace(/\/+$/, '')}/smart-meters/${deviceNo}/init`

      const data = await apiGet<EditInitResponse>(url, {
        headers: { Authorization: 'Bearer mock-token' },
      })

      Object.assign(formData.value, apiToForm(data.SmartMeterInfo))
      snapshotInitial()
      formRef.value?.resetValidation?.()
      return true
    } catch (e: unknown) {
      if (isHttpError(e) && e.status === 500) {
        // 重大系は共通エラーページへ
        router.push({ name: 'CommonError', query: { returnTo: route.fullPath } })
        return false
      }
      // 400 等のバリデーションは画面上部や項目に適用
      if (isHttpError(e)) {
        applyErrorsToPage(e.data, { topList: topErrorList, fieldMap: serverErrors, reset: true })
        error.value = topErrorList.value[0] ?? (t('error.ERR_UNKNOWN') as string)
      } else {
        error.value = e instanceof Error ? e.message : (t('error.ERR_UNKNOWN') as string)
      }
          const hasNoPageErrors =
        topErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0

      if (hasNoPageErrors) {
        const message = toNetworkMessage(e, t('error.E0038'))
        topErrorList.value = [message]
      }
      error.value=''
      return false
    } finally {
      gl.hide()
      loading.value = false
    }
  }
  const status  = ref<number | null>(null)
  /** 登録/更新：クライアント妥当性 → API → 成功/失敗反映。500 は共通エラーへ遷移 */
  async function onSubmit() {
    clearAllServerErrors()
    topErrorList.value = []
    serverErrors.value = {}
    error.value = null
    success.value = null

    // 1) v-form の参照がない場合は安全側でブロック
    if (!formRef.value?.validate) {
      error.value = (t('message.error') as string) || 'エラーを修正して、もう一度お試しください。'
      return false
    }

    // 2) Vuetify rules による妥当性チェック（×なら API へ進まない）
    {
      const { valid } = await formRef.value.validate()
      if (!valid) {
        error.value = (t('message.error') as string) || 'エラーを修正して、もう一度お試しください。'
        return false
      }
    }

    // 3) 上部に出す行単位のメッセージ（任意）
    {
      const errs = validate()
      if (errs.length) {
        topErrorList.value = errs
        error.value = null
        return false
      }
    }

    submitting.value = true
    gl.show()

    try {
      const id = effectiveDeviceNumber.value
      if (!id) throw new Error('Invalid deviceNumber (missing in props and route)')

      const deviceNo = toNumericIdOrThrow(id)
      const url = `${base.replace(/\/+$/, '')}/smart-meters/${deviceNo}`

      const res = await apiPut(url, formData.value, {
        headers: { Authorization: 'Bearer mock-token' },
      })

      // fetch Response の場合の扱い
      if (res instanceof Response) {
        if (!res.ok) {
          if (res.status === 500) {
            router.push({ name: 'CommonError', query: { returnTo: route.fullPath } })
            return false
          }
          const bodyText = await res.text()
          applyErrorsToPage(bodyText, { topList: topErrorList, fieldMap: serverErrors, reset: true })
          error.value = topErrorList.value[0] ?? '更新に失敗しました。'
          return false
        }
        const data = (await res.json()) as { message?: string }
        success.value = data?.message ?? '更新しました。'
        return true
      }

      // http クライアントがパース済みオブジェクトを返す場合
      success.value = (res as { message?: string }).message ?? '更新しました。'
      return true
    } catch (e: unknown) {
            const he = toHttpError(e);
            status.value = he.status;
 
        if (he.status === 500) {
          router.push({ name: 'CommonError', query: { returnTo: route.fullPath } })
          return false
        }
        applyErrorsToPage(he.data, { topList: topErrorList, fieldMap: serverErrors, reset: true })
        
                const hasNoPageErrors =
        topErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0

      if (hasNoPageErrors) {
        const message = toNetworkMessage(e, t('error.E0038'))
        topErrorList.value = [message]
      }
      error.value =''
      //return false
    } finally {
      gl.hide()
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
    isFormValid,


    rules,
    formRef,

    fetchInit,
    onCancel: resetToInitialState,
    onSubmit,
    clearServerError,
  }
}
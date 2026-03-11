import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { applyErrorsToPage } from '../../Common/error/errorResolver'
import { apiGet, apiPost } from '@/services/http'
import type {
  RegisterFormData,
  ListItem,
  facilityType as FacilityTypeCode, 
} from '@/pages/FacilityRegister/FacilityRegister.ts'

type VFormRef = {
  validate: () => Promise<{ valid: boolean }> | boolean
  resetValidation?: () => void
}

export type Rule = (value: unknown) => string | boolean
export type RulesMap = Record<string, Rule[]>


export const topErrorList = ref<string[]>([])
export const __test__ = { isHalfWidth }

function isHalfWidth(input: unknown, allowEmpty = false): boolean {
  const s = String(input ?? '')
  if (s.length === 0) return !!allowEmpty
  const halfWidthRegex = /^[\x20-\x7E\uFF61-\uFF9F]+$/u
  return halfWidthRegex.test(s)
}

type HttpErrorLike = { statusCode: number; message: string; data?: unknown; name?: string }
export function toHttpError(e: unknown): HttpErrorLike {
  if (e && typeof e === 'object') {
    const m = e as { statusCode?: unknown; message?: unknown; data?: unknown }
    if (typeof m.statusCode === 'number' && typeof m.message === 'string') {
      return { statusCode: m.statusCode, message: m.message, data: m.data }
    }
  }
  const msg = e instanceof Error ? e.message : 'Unknown error'
  return { statusCode: 0, message: msg, data: undefined }
}

export function toNetworkMessage(e: unknown, fallback: string): string {
  const he = toHttpError(e)
  const msg = (he.message ?? '').trim()

  const looksLikeNetwork =
    typeof he.statusCode !== 'number' ||
    he.statusCode === 0 ||
     he.statusCode === 503

  const isGenericBrowserMsg =
    /^failed to fetch$/i.test(msg) ||
    /network\s*error/i.test(msg) ||
    /load failed/i.test(msg)

  if (looksLikeNetwork || isGenericBrowserMsg || msg.length === 0) {
    return fallback
  }
  return msg
}

function safeJson(v: unknown): unknown {
  if (typeof v !== 'string') return v
  const s = v.trim()
  if (!s) return s
  try {
    return JSON.parse(s)
  } catch {
    return v
  }
}

function isRecordLike(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function toHttpStatus(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isInteger(n)) return n
  }
  return null
}


export type ProxyEnvelope<T> = {
  statusCode?: number | string
  headers?: Record<string, string>
  body?: string | T 
}

export type BodyEnvelope<T> = {
  code?: string
  data?: T
  meta?: Record<string, string> | undefined
  errors?: Array<{ field?: string; code?: string; message?: string; args?: (string | number)[] }>
  status?: number | string         
  statusCode?: number | string     
}

function hasLambdaProxyShape(x: unknown): x is ProxyEnvelope<unknown> {
  if (!isRecordLike(x)) return false
  const r = x as Record<string, unknown>
  const sc = r['statusCode']
  const bd = r['body']
  const scOk = toHttpStatus(sc) !== null
  const bodyOk = typeof bd === 'string' || isRecordLike(bd)
  return scOk && bodyOk
}

function hasBodyStringLocal(x: unknown): x is { body: string } {
  return isRecordLike(x) && typeof (x as Record<string, unknown>).body === 'string'
}

export function unwrapLambdaProxy<T>(
  raw: unknown
): { httpStatus: number; headers?: Record<string, string>; envelope: BodyEnvelope<T> | T } {
  let httpStatus = 200
  let headers: Record<string, string> | undefined
  let body: unknown = raw

  if (typeof raw === 'string') {
    const parsed = safeJson(raw)
    if (hasLambdaProxyShape(parsed)) {
      const p = parsed as ProxyEnvelope<BodyEnvelope<T> | T>
      httpStatus = toHttpStatus(p.statusCode) ?? 200
      headers = p.headers
      body = p.body
    } else {
      body = parsed
    }
  } else if (hasLambdaProxyShape(raw)) {
    const p = raw as ProxyEnvelope<BodyEnvelope<T> | T>
    httpStatus = toHttpStatus(p.statusCode) ?? 200
    headers = p.headers
    body = p.body
  } else if (hasBodyStringLocal(raw)) {
    const r = raw as { body: string; statusCode?: unknown; headers?: unknown }
    httpStatus = toHttpStatus(r.statusCode) ?? httpStatus
    headers = isRecordLike(r.headers)
      ? Object.entries(r.headers as Record<string, unknown>).reduce<Record<string, string>>(
          (acc, [k, v]) => {
            if (typeof v === 'string') acc[k] = v
            return acc
          },
          {}
        )
      : headers
    body = r.body
  }

  const inner = typeof body === 'string' ? safeJson(body) : body

  if (isRecordLike(inner)) {
    const innerStatus =
      (inner as Record<string, unknown>)['status'] ??
      (inner as Record<string, unknown>)['statusCode']
    const innerStatusNum = toHttpStatus(innerStatus)
    if (httpStatus === 200 && innerStatusNum !== null) {
      httpStatus = innerStatusNum
    }
  }

  return { httpStatus, headers, envelope: inner as BodyEnvelope<T> | T }
}

export function getDomainFromEnvelope<T>(envelope: BodyEnvelope<T> | T): T {
  if (isRecordLike(envelope) && 'data' in envelope) {
    return (envelope as BodyEnvelope<T>).data as T
  }
  return envelope as T
}


function hasStringMessage(v: unknown): v is { message: string } {
  return isRecordLike(v) && 'message' in v && typeof (v as Record<string, unknown>).message === 'string'
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

function getConflictIds(item: { field?: string; args?: (string | number)[] }) {
  if (Array.isArray(item.args) && item.args.length >= 2) {
    return [String(item.args[0]), String(item.args[1])]
  }
 
  if (typeof item.field === 'string' && item.field.includes(',')) {
    const [currentId, nextId] = item.field.split(',').map((s) => s.trim())
    return [currentId, nextId]
  }
  return [undefined, undefined] as const
}

export function useFacilityRegistration() {
  const { t } = useI18n()
  const router = useRouter()
  const ERROR_PATH = '/error'
  const msg = ref('')                       
  const loading = ref(false)                
  const error = ref<string | null>(null)     
  const statusCode = ref<number | null>(null) 
  const successDialog = ref(false)           
  const dialogMessage = ref('')              
  const facilityStatus = ref<ListItem[]>([])
  const facilityType = ref<ListItem[]>([])
  const formRef = ref<VFormRef | null>(null)

  const formData = ref<RegisterFormData>({
    facilityType: '',
    facilityID: '',
    ecoCompanyID: '',
    ecoCompanyPassword: '',
    facilityName: '',
    facilityAddress: '',
    cityInfo: '',
    facilityImage: null,
    facilityImageUrl: '',
    imageFilename: '',
    facilityStatus: '',
    facilityManagerName: '',
    facilityManagerMail: '',
  })

  const serverErrors = ref<Record<string, string[]>>({})

  type FacilityRegisterSuccessBody = {
    statusCode?: 200 | 201
    message?: string
    facility?: unknown
  }

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

  const { t: tI18n } = useI18n()
  const requiredRule = (fieldKey: string): Rule => (value: unknown) => {
    const ok =
      typeof value === 'boolean' ? value === true : asString(value).trim().length > 0
    return ok || tI18n('error.E0001', [tI18n(fieldKey)])
  }

  const maxRule = (fieldKey: string, max: number): Rule => (value: unknown) => {
    const v = asString(value).trim()
    const ok = v.length === 0 || v.length <= max
    return ok || tI18n('error.E0002', [tI18n(fieldKey), String(max), '文字'])
  }
 const emailmaxRule = (fieldKey: string, max: number): Rule => (value: unknown) => {
    const v = asString(value).trim()
    const ok = v.length === 0 || v.length <= max
    return ok || tI18n('error.E0002', [tI18n(fieldKey), String(max), '半角文字'])
  }
  const atEmailLikeRule = (fieldKey: string): Rule => (value: unknown) => {
    const v = asString(value).trim()
    if (!v) return true
    const ok = /^[^\s@]+@[^\s@]+$/.test(v)
    return ok || tI18n('error.E0008',  [tI18n(fieldKey)])
  }
  const StringRule = (fieldKey: string): Rule => (value: unknown) => {
    const v = String(value ?? '').trim()
    if (!v) return true
    const ok = !/^\d+(\.\d+)?$/.test(v) 
    return ok || tI18n('error.E0003', [tI18n(fieldKey), '文字列'])
  }

  const mustBeHalfWidthRule = (fieldKey: string): Rule => (value: unknown) => {
    const v = String(value ?? '').trim()
    if (!v) return true
    const ok = isHalfWidth(v)
    return ok || tI18n('error.E0003', [tI18n(fieldKey),'半角文字'])
  }

  const rules: Record<string, Rule[]> = {
    ecoCompanyID: [requiredRule('facility.ecoCompanyID'), StringRule('facility.ecoCompanyID'), maxRule('facility.ecoCompanyID', 8)],
    ecoCompanyPassword: [requiredRule('facility.ecoCompanyPassword'), StringRule('facility.ecoCompanyPassword'), maxRule('facility.ecoCompanyPassword', 16)],
    facilityName: [requiredRule('facility.facilityName'), StringRule('facility.facilityName'), maxRule('facility.facilityName', 30)],
    facilityAddress: [requiredRule('facility.facilityAddress'), StringRule('facility.facilityAddress'), maxRule('facility.facilityAddress', 40)],
    cityInfo: [requiredRule('facility.cityInformation'), StringRule('facility.cityInformation'), maxRule('facility.cityInformation', 50)],
    imageFilename: [requiredRule('facility.imageFilename'), StringRule('facility.imageFilename')],
    facilityManagerName: [maxRule('facility.facilityManagerName', 20), StringRule('facility.facilityManagerName')],
    facilityManagerMail: [emailmaxRule('facility.facilityManagerContact', 254),mustBeHalfWidthRule('facility.facilityManagerContact'), atEmailLikeRule('facility.facilityManagerContact')],
  }

  const defaultImage = '' 

  function resolveUrl(u?: string): string {
    if (!u) return defaultImage
    if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u
    const baseUrl = import.meta.env.BASE_URL
    return `${baseUrl.replace(/\/$/, '')}/${u.startsWith('/') ? u.slice(1) : u}`
  }

  const selectedImageUrl = computed(() => {
    const objectUrl = formData.value.facilityImage?.presignedUrl
    if (objectUrl) return objectUrl
    const legacy = formData.value.facilityImageUrl
    return resolveUrl(legacy)
  })
  const pageBgUrl = computed(() => selectedImageUrl.value || '')

  async function fetchInit() {
    try {
      
      clearAllServerErrors()
      error.value = ''
      statusCode.value = null

      const raw = await apiGet<unknown>('/facilities/register/init')

      const { httpStatus, envelope } = unwrapLambdaProxy<
        | {
            code?: string
            data?: {
              facilityId?: string
              facilityType?: Record<string, string>
              facilityStatus?: Record<string, string>
              defaultFacilityType?: string
              defaultFacilityStatus?: string
            }
            meta?: Record<string, unknown>
            status?: number | string
            statusCode?: number | string
            errors?: unknown
          }
        | {
      
            code?: string
            meta?: Record<string, unknown>
            status?: number | string
            statusCode?: number | string
            errors?: unknown
          }
      >(raw)

      statusCode.value = httpStatus ?? 200

      const payload =
        typeof envelope === 'string'
          ? (safeJson(envelope) as Record<string, unknown>)
          : (envelope as Record<string, unknown>)

      const hasErrors =
        typeof payload === 'object' &&
        payload !== null &&
        Array.isArray((payload as { errors?: unknown }).errors)

      if (hasErrors) {
        applyErrorsToPage(payload, {
          topList: topErrorList,
          fieldMap: serverErrors,
          reset: true,
        })
        error.value = ''
        return
      }
      const data =
        typeof payload === 'object' &&
        payload !== null &&
        'data' in payload &&
        isRecordLike((payload as { data?: unknown }).data)
          ? ((payload as { data: Record<string, unknown> }).data as {
              facilityId?: string
              facilityType?: Record<string, string>
              facilityStatus?: Record<string, string>
              defaultFacilityType?: string
              defaultFacilityStatus?: string
            })
          : (payload as {
              facilityId?: string
              facilityType?: Record<string, string>
              facilityStatus?: Record<string, string>
              defaultFacilityType?: string
              defaultFacilityStatus?: string
            })
      const facilityId = data?.facilityId ?? ''
      const facilityTypeMap = data?.facilityType ?? {}
      const facilityStatusMap = data?.facilityStatus ?? {}
      const defaultFacilityType = data?.defaultFacilityType ?? ''
      const defaultFacilityStatus = data?.defaultFacilityStatus ?? ''

      const ft = Object.entries(facilityTypeMap).map(([code, label]) => ({ code, label }))
      const fs = Object.entries(facilityStatusMap).map(([code, label]) => ({ code, label }))
      facilityType.value = ft
      facilityStatus.value = fs
      formData.value.facilityType =
        ft.find(i => i.code === defaultFacilityType)?.code ?? ft[0]?.code ?? ''

      formData.value.facilityStatus =
        fs.find(i => i.code === defaultFacilityStatus)?.code ?? fs[0]?.code ?? ''
      formData.value.facilityID = facilityId
    } catch (e: unknown) {

      const he = toHttpError(e)
      statusCode.value = he.statusCode
   
      if (he.statusCode === 500) {
        await router.replace(ERROR_PATH)
        return
      }
      if (he.statusCode === 404 || he.statusCode === 504) {
        applyErrorsToPage('', {
          topList: topErrorList,
          fieldMap: serverErrors,
          reset: true,
        })
        error.value = ''
        return
      }
      const isNetworkLike =
        !he.statusCode || he.statusCode === 0 || topErrorList.value.length === 0

      if (isNetworkLike) {
        const fallback = t('error.E0038')
        const message = toNetworkMessage(e, fallback)
        topErrorList.value = [message]
        serverErrors.value = {}
        error.value = ''
        return
      }
    }
  }

  function normalizeCategory(v: unknown): FacilityTypeCode | undefined {
    if (v === '0') return '0'
    if (v === '1') return '1'
    return undefined
  }

  async function resetForm() {
    msg.value = ''
    error.value = null
    clearAllServerErrors()
    formData.value = {
      facilityType: '',
      facilityID: '',
      ecoCompanyID: '',
      ecoCompanyPassword: '',
      facilityName: '',
      facilityAddress: '',
      cityInfo: '',
      facilityImage: null,   
      facilityImageUrl: '', 
      imageFilename: '',     
      facilityStatus: '',
      facilityManagerName: '',
      facilityManagerMail: '',
    }
    formRef.value?.resetValidation?.()
  }

  async function onSubmit() {
    msg.value = ''
    error.value = ''
    clearAllServerErrors()
    topErrorList.value = []
    serverErrors.value = {}
    const vr = await formRef.value?.validate?.()
    const isValid = typeof vr === 'boolean' ? vr : vr?.valid === true
    if (!isValid) {
      error.value = t('message.error')
      return
    }

    loading.value = true
    try {
    
      const payload = {
        facilityType: formData.value.facilityType,
        facilityID: formData.value.facilityID,
        ecoCompanyID: formData.value.ecoCompanyID,
        ecoCompanyPassword: formData.value.ecoCompanyPassword,
        facilityName: formData.value.facilityName,
        facilityAddress: formData.value.facilityAddress,
        cityInfo: formData.value.cityInfo,

        
        imageFilename:
          formData.value.facilityImage?.relativePath ??
          formData.value.imageFilename ??
          '',

        facilityStatus: formData.value.facilityStatus,
        facilityManagerName: formData.value.facilityManagerName,
        facilityManagerMail: formData.value.facilityManagerMail,
      }
      const url = `/facilities`
      const res = await apiPost(url, payload)
      const { httpStatus, envelope } = unwrapLambdaProxy<unknown>(res)
      statusCode.value = httpStatus

      const payloadEnv =
        (typeof envelope === 'string' ? safeJson(envelope) : envelope) as
          BodyEnvelope<FacilityRegisterSuccessBody> | FacilityRegisterSuccessBody

      const successData = getDomainFromEnvelope<FacilityRegisterSuccessBody>(payloadEnv)
      const maybeMsg =
        (hasStringMessage(payloadEnv) ? payloadEnv.message : undefined) ||
        successData?.message ||
        ''

      msg.value = (maybeMsg && maybeMsg.trim().length > 0) ? maybeMsg : ''
      dialogMessage.value = msg.value || '登録が完了しました。'
      successDialog.value = true
    } catch (e: unknown) {
      const he = toHttpError(e)
      statusCode.value = he.statusCode

      if (he.statusCode === 400 || he.statusCode === 504) {
        applyErrorsToPage(
          (he.data as unknown) ?? { code: '', errors: [] },
          { topList: topErrorList, fieldMap: serverErrors, reset: true }
        )
        error.value = ''
        return
      }

      if (he.statusCode === 500) {
        await router.replace(ERROR_PATH)
        return
      }

      if (he.statusCode === 409) {
        const data =
          (he.data as { errors?: Array<{ code: string; field?: string; args?: (string | number)[] }> }) ??
          { errors: [] }
        const errs = Array.isArray(data.errors) ? data.errors : []
        topErrorList.value = []
        serverErrors.value = {}
        let switchedId = false

        errs.forEach((item) => {
          if (item.code === 'E0009') {
            const [currentId, nextId] = getConflictIds(item)
            const params = nextId ? [currentId ?? '', nextId] : []
            const text = params.length ? t(`error.${item.code}`, params) : t(`error.${item.code}`)
            topErrorList.value.push(text)
            if (nextId) {
              formData.value.facilityID = nextId
              switchedId = true
            }
          } else {
            applyErrorsToPage(
              { code: '', errors: [item] },
              { topList: topErrorList, fieldMap: serverErrors }
            )
          }
        })

        if (switchedId) {
          await formRef.value?.validate?.()
        }
        error.value = ''
        return
      }
      const isNetworkLike =
        !he.statusCode || he.statusCode === 0 || topErrorList.value.length === 0

      if (isNetworkLike) {
        const fallback = t('error.E0038')
        const message = toNetworkMessage(e, fallback)
        topErrorList.value = [message]
        serverErrors.value = {}
        error.value = ''
        return 
      }

      applyErrorsToPage(
        (he.data as unknown) ?? { code: '', errors: [] },
        { topList: topErrorList, fieldMap: serverErrors, reset: true }
      )
      error.value = ''
    } finally {
      loading.value = false
    }
  }
  watch(
    () => formData.value.facilityType,
    () => {
      formData.value.facilityImage = null     
      formData.value.facilityImageUrl = ''   
      formData.value.imageFilename = ''      
    },
    { immediate: true }
  )

  onMounted(fetchInit)
  return {
    msg,
    loading,
    error,
    statusCode,
    successDialog,
    dialogMessage,
    facilityStatus,
    facilityType,
    formRef,
    formData,
    rules,
    serverErrors,
    topErrorList,
    selectedImageUrl,
    pageBgUrl,
    toNetworkMessage,
    clearServerError,
    clearAllServerErrors,
    normalizeCategory,
    resolveUrl,
    resetForm,
    onSubmit,
    fetchInit,
    toHttpError,
  }
}
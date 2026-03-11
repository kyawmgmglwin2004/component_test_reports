import { ref, watch } from 'vue'
import type { facilityType, FacilityImage } from '@/pages/FacilityRegister/FacilityRegister.ts'
import { apiGet } from '@/services/http'
import { useRouter } from 'vue-router'
import { toHttpError, toNetworkMessage } from '../composables/useFacilityRegister'
import { applyErrorsToPage } from '../../Common/error/errorResolver'
import { useI18n } from 'vue-i18n'
import { useGlobalLoading, type GlobalLoadingService } from '../../Common/composables/GlobalLoading'
export const getPhotoErrorList = ref<string[]>([])
export const topErrorList = ref<string[]>([])
export function isRecordLike(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null
  }

  export function safeJson(v: unknown): unknown {
    if (typeof v !== 'string') return v
    const s = v.trim()
    if (!s) return s
    try { return JSON.parse(s) } catch { return v }
  }

  export function toStatus(n: unknown): number | null {
    if (typeof n === 'number' && Number.isInteger(n)) return n
    if (typeof n === 'string') {
      const v = Number(n)
      if (Number.isInteger(v)) return v
    }
    return null
  }

  type ProxyEnvelope = {
    statusCode?: number | string
    headers?: Record<string, string>
    body?: string | unknown
  }

  export function hasLambdaProxy(x: unknown): x is ProxyEnvelope {
    if (!isRecordLike(x)) return false
    const r = x as Record<string, unknown>
    return toStatus(r['statusCode']) !== null &&
      (typeof r['body'] === 'string' || isRecordLike(r['body']))
  }
  export function unwrapLambda<T>(raw: unknown): { httpStatus: number; envelope: T | Record<string, unknown> } {
    let httpStatus = 200
    let body: unknown = raw

    if (typeof raw === 'string') {
      const parsed = safeJson(raw)
      if (hasLambdaProxy(parsed)) {
        const p = parsed as ProxyEnvelope
        httpStatus = toStatus(p.statusCode)!
        body = p.body
      } else {
        body = parsed
      }
    } else if (hasLambdaProxy(raw)) {
      const p = raw as ProxyEnvelope
      httpStatus = toStatus(p.statusCode)!
      body = p.body
    }

    const inner = typeof body === 'string' ? safeJson(body) : body
    return { httpStatus, envelope: inner as T | Record<string, unknown> }
  }

  type Meta = { requestId: string; serverTime: string }

  type PhotosSuccessInnerFlat = {
    code: 'MSG0006'
    data: FacilityImage[]
    meta: Meta
  }

  type PhotosSuccessInnerNested = {
    code: 'MSG0006'
    data: { photos: FacilityImage[] }
    meta: Meta
  }

  type PhotosSuccessInner = PhotosSuccessInnerFlat | PhotosSuccessInnerNested

  type ErrorItem = {
    field?: string
    code: string
    message?: string
    args?: (string | number)[]
  }

  type ErrorInner = {
    code: string
    errors: ErrorItem[]
    meta: Meta
  }

 export function isFacilityImageArray(v: unknown): v is FacilityImage[] {
    return Array.isArray(v) && v.every(i => {
      if (!isRecordLike(i)) return false
      const hasDisplayName = 'displayName' in i && typeof (i as { displayName: unknown }).displayName === 'string'
      const hasRelativePath = 'relativePath' in i && typeof (i as { relativePath: unknown }).relativePath === 'string'
      const hasPresignedUrl = 'presignedUrl' in i && typeof (i as { presignedUrl: unknown }).presignedUrl === 'string'
      return hasDisplayName && hasRelativePath && hasPresignedUrl
    })
  }

  export function isPhotosSuccessInnerFlat(v: unknown): v is PhotosSuccessInnerFlat {
    if (!isRecordLike(v)) return false
    const obj = v as { code?: unknown; data?: unknown }
    return obj.code === 'MSG0006' && isFacilityImageArray(obj.data)
  }

  export function isPhotosSuccessInnerNested(v: unknown): v is PhotosSuccessInnerNested {
    if (!isRecordLike(v)) return false
    const obj = v as { code?: unknown; data?: unknown }
    if (obj.code !== 'MSG0006') return false
    if (!isRecordLike(obj.data)) return false
    const dataObj = obj.data as { photos?: unknown }
    return isFacilityImageArray(dataObj.photos)
  }

  export function isErrorInner(v: unknown): v is ErrorInner {
    if (!isRecordLike(v)) return false
    const obj = v as { code?: unknown; errors?: unknown }
    return typeof obj.code === 'string' && Array.isArray(obj.errors)
  }

  export function isNetworkLike(err: unknown, statusCode?: number) {
    return statusCode == null || statusCode === 0 || err instanceof TypeError
  }

  export function resolveUrl(u?: string): string {
    if (!u) return ''
    if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u
    const baseUrl = import.meta.env.BASE_URL
    return `${baseUrl.replace(/\/$/, '')}${u.startsWith('/') ? '' : '/'}${u}`
  }
export function usePhotoUpload() {
  const { t } = useI18n()
  const dialog = ref(false)
  const loading = ref(false)
  const dialogError = ref<string | null>(null)
  const images = ref<FacilityImage[]>([])
  const router = useRouter()
  const ERROR_PATH = '/error'
  const lastStatus = ref<number | undefined>(undefined)
  const category = ref<facilityType | undefined>(undefined)

   const gl: GlobalLoadingService = useGlobalLoading()
  
  async function fetchFacilityImages(fType: facilityType): Promise<FacilityImage[]> {
    const url = `https://2k79mckbm4.execute-api.ap-northeast-1.amazonaws.com/v1/facilities/photos?facilityType=${encodeURIComponent(String(fType))}`
    try {
      const raw = await apiGet<unknown>(url)
      const { httpStatus, envelope } = unwrapLambda<PhotosSuccessInner | ErrorInner>(raw)
      lastStatus.value = httpStatus

      const body: unknown = typeof envelope === 'string' ? safeJson(envelope) : envelope


      if (isErrorInner(body) && body.code !== 'MSG0006') {
        return []
      }

      let list: FacilityImage[] = []

      if (isPhotosSuccessInnerFlat(body)) {
        list = body.data
      } else if (isPhotosSuccessInnerNested(body)) {
        list = body.data.photos
      } else {
       
        list = []
      }

      return list.map(img => ({
        ...img,
        presignedUrl: resolveUrl(img.presignedUrl),
      }))
    } catch (e: unknown) {
      throw e
    }
  }

  async function load() {
    if (!category.value) {
      images.value = []
      return
    }
    gl.show()
    loading.value = true
    dialogError.value = null
    getPhotoErrorList.value = []

    try {
      images.value = await fetchFacilityImages(category.value)
    } catch (e: unknown) {
      const he = toHttpError(e)
      lastStatus.value = he.statusCode

      if (he.statusCode === 500) {
        await router.replace(ERROR_PATH)
        return
      }
      if (he.statusCode === 503) {
        applyErrorsToPage(
          he.data ?? { code: '', errors: [] },
          { topList: topErrorList, reset: true }
        )
      }
      if (he.statusCode === 404) {
        applyErrorsToPage(
          he.data ?? { code: '', errors: [] },
          { topList: getPhotoErrorList, reset: true }
        )
        images.value = []
        return
      }
      if (isNetworkLike(e, he.statusCode)) {
        const message = toNetworkMessage(e, t('error.E0036'))
        topErrorList.value = [message]
        dialogError.value = message
        images.value = []
        return
      }
      images.value = []
    } finally {
      loading.value = false
      gl.hide()
    }
  }

  async function open(cat: facilityType) {
    category.value = cat
    await load()
    dialog.value = true
  }

  function close() { dialog.value = false }

  watch(category, () => { if (dialog.value) void load() })

  return {
    dialog,
    loading,
    dialogError,
    images,
    category,
    lastStatus,
    open,
    close,
    reload: load,
  }
}
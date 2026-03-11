
import { ref, watch } from 'vue'
import {
  type Facilitylist,
  type FacilityListSearchState,
  safeJson,
  toNetworkMessage,
  resetTopErrors,
  pushTopErrors,
  topErrorList,
  toHttpError,
  unwrapLambdaProxy
} from '../composables/FacilityListSearch'
import { useI18n } from 'vue-i18n'
import { apiGet, apiDelete, apiPostBlob } from '@/services/http'
import { useRouter } from 'vue-router'
import { applyErrorsToPage } from '../../Common/error/errorResolver'

const base = import.meta.env.VITE_API_BASE_URL
type SortDir = 'asc' | 'desc'
type SortableKey =
  | 'facilityAddress'
  | 'facilityID'
  | 'facilityName'
  | 'facilityType'
  | 'facilityStatus'
  | 'deviceCount'
  | 'measuredTime'
  | 'generatedEnergy'
  | 'soldEnergy'
  | 'boughtEnergy'
  | ''


export type FacilitySearchResponse = {
  data: Facilitylist[]
  searchresult: number
}
type HeadersFetchLike = { get(name: string): string | null }
type HeadersAxiosLike = Record<string, string | undefined>
type HeadersLike = HeadersFetchLike | HeadersAxiosLike | undefined

type HttpWrapper = {
  statusCode: number
  body?: unknown
  data?: unknown
  headers?: HeadersLike
}


export const csvErrorList = ref<string[]>([])

export function isRecordLike(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function isHttpWrapper(v: unknown): v is HttpWrapper {
  return isRecordLike(v) && typeof (v as Record<string, unknown>).statusCode === 'number'
}

export function getHttpStatusFromError(e: unknown): number | null {
  if (!(e instanceof Error)) return null
  const m = e.message.match(/HTTP\s*(\d{3})/i)
  return m ? Number(m[1]) : null
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
  errors?: Array<{ field?: string; code?: string; message?: string }>
  status?: number | string
  statusCode?: number | string
}


export function getDomainFromEnvelope<T>(envelope: BodyEnvelope<T> | T): T {
  if (isRecordLike(envelope) && 'data' in envelope) {
    return (envelope as BodyEnvelope<T>).data as T
  }
  return envelope as T
}


async function blobToJsonSafe(v: unknown): Promise<unknown> {
  if (typeof Blob !== 'undefined' && v instanceof Blob) {
    try {
      const ct = v.type || ''
      const text = await v.text()
      const looksJson = /json/i.test(ct) || (text && (text.trim().startsWith('{') || text.trim().startsWith('[')))
      if (looksJson) {
        return JSON.parse(text)
      }
      return text
    } catch {
      return v
    }
  }
  return v
}


export function Csvfilename(disposition: string | null | undefined): string | null {
  if (!disposition) return null
  {
    const m = /filename\*\s*=\s*UTF-8''([^";\r\n]+)/i.exec(disposition)
    if (m?.[1]) {
      const raw = m[1].trim()
      try {
        return decodeURIComponent(raw)
      } catch {
        return raw
      }
    }
  }
  {
    const m = /filename\*\s*=\s*"UTF-8''([^"]+)"/i.exec(disposition)
    if (m?.[1]) {
      const raw = m[1].trim()
      try {
        return decodeURIComponent(raw)
      } catch {
        return raw
      }
    }
  }
  {
    const m = /filename\s*=\s*"([^"]+)"/i.exec(disposition)
    if (m?.[1]) return m[1]
  }
  {
    const m = /filename\s*=\s*([^;]+)/i.exec(disposition)
    if (m?.[1]) return m[1].trim()
  }
  return null
}


export function useFacilityListTable(searchState: FacilityListSearchState) {
  const router = useRouter()
  const {
    FacilityList,
    pageNumber,
    limit,
    totalPages,
    loading,
    filterlength,
    keyword,
    facilityType,
    facilityStatus,
    fetchSearch,
  } = searchState
  const { t } = useI18n()
  const errorMessage = ref<string>('')
  const isloading = ref(false)
  const confirmDialog = ref(false)
  const deleteId = ref('')
  const deleting = ref(false)
  const selected = ref<Facilitylist[]>([])
  const currentSortKey = ref<SortableKey | null>(null)
  const currentSortOrder = ref<SortDir>('asc')
  const serverErrors = ref<Record<string, string[]>>({})
 
  function showApiErrors(raw: unknown) {
    const norm = typeof raw === 'string' ? safeJson(raw) : raw
    applyErrorsToPage(
      norm ?? { code: 'ERR_UNKNOWN', errors: [] },
      { topList: csvErrorList, fieldMap: serverErrors, reset: true }
    )
  }

  function clearError() {
    errorMessage.value = ''
  }
  function clearSelected() {
    selected.value = []
  }
  function clearSelections() {
    
  }

  watch(
    () => searchState.searchNonce.value,
    () => {
      clearSelected()
      clearSelections()
    }
  )

  function buildParams() {
    const params = new URLSearchParams()
    params.set('page', String(pageNumber.value))
    if (keyword.value) params.set('keyword', keyword.value)
    if (facilityType.value && facilityType.value !== 'all') params.set('facilityType', facilityType.value)
    if (facilityStatus.value && facilityStatus.value !== 'all') params.set('facilityStatus', facilityStatus.value)
    if (currentSortKey.value) {
      params.set('sortItemName', currentSortKey.value)
      params.set('sortOrder', currentSortOrder.value)
    }
    return params
  }

  type FacilitiesTopLevel = {
    facilities: Facilitylist[]
    searchResultCount: number
  }
  type FacilitiesDataWrapper = {
    data: FacilitiesTopLevel
  }
  function isFacilitiesTopLevel(v: unknown): v is FacilitiesTopLevel {
    if (!isRecordLike(v)) return false
    const r = v as Record<string, unknown>
    return Array.isArray(r.facilities) && typeof r.searchResultCount === 'number'
  }
  function isFacilitiesDataWrapper(v: unknown): v is FacilitiesDataWrapper {
    if (!isRecordLike(v)) return false
    const data = (v as { data?: unknown }).data
    return isFacilitiesTopLevel(data)
  }

  async function fetchSortFacilities() {
    loading.value = true
    try {
      const query = buildParams().toString()
      const currentLimit = Number(limit.value) || 10
      const url = `${base.replace(/\/+$/, '')}/facilities?${query}`

      const raw = await apiGet<unknown>(url)
      const { envelope } = unwrapLambdaProxy<unknown>(raw)
      const inner = typeof envelope === 'string' ? safeJson(envelope) : envelope

      if (isFacilitiesDataWrapper(inner)) {
        FacilityList.value = inner.data.facilities ?? []
        const totalItems = inner.data.searchResultCount ?? 0
        totalPages.value = totalItems > 0 ? Math.ceil(totalItems / currentLimit) : 0
        filterlength.value = totalItems
      } else if (isFacilitiesTopLevel(inner)) {
        FacilityList.value = inner.facilities ?? []
        const totalItems = inner.searchResultCount ?? 0
        totalPages.value = totalItems > 0 ? Math.ceil(totalItems / currentLimit) : 0
        filterlength.value = totalItems
      } else {
        const message = toNetworkMessage('', t('error.E0038'))
        resetTopErrors()
        pushTopErrors(message)
        FacilityList.value = []
        return
      }

      if (totalPages.value > 0 && pageNumber.value > totalPages.value) {
        pageNumber.value = totalPages.value
      }
      if (totalPages.value === 0) {
        pageNumber.value = 1
      }
    } catch (e: unknown) {
      const he = toHttpError(e)
      const statusCode = he.statusCode || getHttpStatusFromError(e)
      if (statusCode === 500) {
        await router.replace('/error')
        return
      }
      if (statusCode === 400 || statusCode === 404  || statusCode === 504) {
        const norm = typeof he.data === 'string' ? safeJson(he.data) : he.data
        applyErrorsToPage(norm ?? { code: 'ERR_UNKNOWN', errors: [] }, {
          topList: csvErrorList,
          fieldMap: serverErrors,
          reset: true,
        })
        return
      }
      const hasNoPageErrors =
        errorMessage.value.length === 0 && csvErrorList.value.length === 0
      if (hasNoPageErrors) {
        const message = toNetworkMessage(e, t('error.ERR_NETWORK'))
        errorMessage.value = message
      }
      errorMessage.value = e instanceof Error && e.message ? e.message : t('error.ERR_UNKNOWN')
    } finally {
      loading.value = false
    }
  }

  async function onPageChange(p: number) {
    pageNumber.value = p
    if (currentSortKey.value && currentSortOrder.value) {
      await fetchSortFacilities()
    } else {
      await fetchSearch()
    }
  }
 
  async function descHandleClick(sortItemName: string) {
    if (!FacilityList.value || FacilityList.value.length === 0) return
    currentSortKey.value = sortItemName as SortableKey
    currentSortOrder.value = 'desc'
    pageNumber.value = 1
    await fetchSortFacilities()
  }
 
  async function ascHandleClick(sortItemName: string) {
    if (!FacilityList.value || FacilityList.value.length === 0) return
    currentSortKey.value = sortItemName as SortableKey
    currentSortOrder.value = 'asc'
    pageNumber.value = 1
    await fetchSortFacilities()
  }

  function setSingleTopError(msg?: string) {
    topErrorList.value = msg ? [msg] : []
  }


async function csvDownload() {
  if (isloading.value) return;
  errorMessage.value = '';

  if (selected.value.length === 0) {
    setSingleTopError(t('error.E0006'));
    return;
  }

  
  const ids = selected.value
    .map(r => r.facilityID)
    .filter((v): v is string => typeof v === 'string');

  const idPattern = /^F\d{5}$/;
  const invalidId = ids.find(id => {
    if (!idPattern.test(id)) return true;
    const num = Number(id.slice(1));
    return Number.isNaN(num) || num < 0 || num > 99999;
  });
  if (invalidId) {
    pushTopErrors(t('error.E0004', ['施設ID', 'F00000～F99999']));
    return;
  }
  const uniqueIds = Array.from(new Set(ids));

  isloading.value = true;
  try {
    const body = { facilityID: uniqueIds, serverError: false };
    const url = `${base.replace(/\/+$/, '')}/facilities/download`;
    const res = await apiPostBlob(url, body /*, { headers: { Accept: 'text/csv' } }*/);

    if (res.status < 200 || res.status >= 300) {
      throw Object.assign(new Error(`HTTP ${res.status}`), {
        statusCode: res.status,
        payload: res.data,
      });
    }

    const disposition =
      res.headers.get('Content-Disposition') || res.headers.get('content-disposition') || null;

    const filename = Csvfilename(disposition) ?? 'facilities.csv';
    const blob = res.data instanceof Blob
      ? res.data
      : new Blob([res.data], { type: 'text/csv;charset=utf-8' });

    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);

  } catch (err: unknown) {
   
    const explicitStatus = (err as { statusCode?: number }).statusCode;
    const inferredStatus = getHttpStatusFromError(err);
    const he = toHttpError(err);
    const statusCode = explicitStatus ?? inferredStatus ?? he.statusCode ?? 0;
    const rawPayload = (err as { payload?: unknown }).payload ?? he.data;

    if (statusCode === 500) {
      await router.replace('/error');
      return;
    } else if (statusCode === 400 || statusCode === 404 || statusCode === 504) {
      const parsed = await blobToJsonSafe(rawPayload);
      showApiErrors(parsed);
    } else {
      showApiErrors(err);
    }

    const hasNoPageErrors =
      errorMessage.value.length === 0 && csvErrorList.value.length === 0;

    if (hasNoPageErrors) {
      const msg = toNetworkMessage(err, t('error.E0038'));
      resetTopErrors();
      pushTopErrors(msg);
      errorMessage.value = msg;
    }
  } finally {
    isloading.value = false;
    selected.value = [];
    clearSelections();
  }
}

  async function openConfirm(item: Facilitylist) {
    deleteId.value = item.facilityID
    confirmDialog.value = true
  }

  function cancel() {
    confirmDialog.value = false
  }

  async function ok() {
    if (!deleteId.value) {
      errorMessage.value = t('error.E0001', { field: '施設ID' })
      return
    }
    const id = deleteId.value
    deleting.value = true
    try {
      const raw = await apiDelete(`${base.replace(/\/+$/, '')}/facilities/${id}`)
      const { httpStatus, envelope } = unwrapLambdaProxy<unknown>(raw)

      if (httpStatus < 200 || httpStatus >= 300) {
        showApiErrors(envelope)
        return
      }

      const idx = FacilityList.value.findIndex(r => r.facilityID === id)
      if (idx !== -1) FacilityList.value.splice(idx, 1)

      confirmDialog.value = false
      await fetchSearch()
    } catch (e: unknown) {
      const he = toHttpError(e)
      const statusCode = he.statusCode ?? getHttpStatusFromError(e)
      if (statusCode === 500) {
        await router.replace('/error')
        return
      }
        if (statusCode === 400 || statusCode === 404  || statusCode === 504) {
        const norm = typeof he.data === 'string' ? safeJson(he.data) : he.data
        applyErrorsToPage(norm ?? { code: 'ERR_UNKNOWN', errors: [] }, {
          topList: csvErrorList,
          fieldMap: serverErrors,
          reset: true,
        })
        return
      }
      const hasNoPageErrors =
        errorMessage.value.length === 0 && csvErrorList.value.length === 0

      if (hasNoPageErrors) {
        const msg = toNetworkMessage('', t('error.E0038'))
        resetTopErrors()
        pushTopErrors(msg)
        errorMessage.value = msg
      }
      showApiErrors(e)
    } finally {
      deleting.value = false
      deleteId.value = ''
    }
  }

  return {
    errorMessage,
    isloading,
    confirmDialog,
    deleteId,
    deleting,
    selected,
    currentSortKey,
    currentSortOrder,
    clearError,
    clearSelected,
    clearSelections,
    buildParams,
    fetchSortFacilities,
    onPageChange,
    descHandleClick,
    ascHandleClick,
    csvDownload,
    openConfirm,
    cancel,
    ok,
    Csvfilename,
    FacilityList,
    totalPages,
    csvErrorList,
  }
}
export type FacilityListTableState = ReturnType<typeof useFacilityListTable>

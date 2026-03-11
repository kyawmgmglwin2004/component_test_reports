
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { apiGet ,HttpError} from '@/services/http'
import { applyErrorsToPage } from '../../Common/error/errorResolver'
const base = import.meta.env.VITE_API_BASE_URL

const selected = ref<Facilitylist[]>([])


export interface Facilitylist {
  facilityType: string
  facilityID: string
  facilityName: string
  facilityAddress: string
  deviceCount: number
  facilityStatus: string
  measuredTime: string
  generatedEnergy: number
  soldEnergy: number
  boughtEnergy: number
}

export interface facilityCategory { title: string; value: string | null }

export interface fcilityStatus { title: string; value: string | null }

function mapToItemsCategory(map: Record<string, string>): facilityCategory[] {
  return Object.entries(map)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([value, title]) => ({ title, value }))
}
function mapToItemsStatus(map: Record<string, string>): fcilityStatus[] {
  return Object.entries(map)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([value, title]) => ({ title, value }))
}


type ApiErrorItem = {
  field?: string
  code: string
  meta?: Record<string, unknown>
  message?: string
}

type ApiErrorResponse = {
  status?: number | string
  statusCode?: number | string
  code: string
  errors: ApiErrorItem[]
  meta: { requestId: string; serverTime: string }
}

export const topErrorList = ref<string[]>([])


export function resetTopErrors() {
  topErrorList.value = []
}
export function pushTopErrors(...msgs: string[]) {
  topErrorList.value.push(...msgs.filter(Boolean))
}

const serverErrors = ref<Record<string, string[]>>({})


export function isRecordLike(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}


export function isApiErrorItem(v: unknown): v is ApiErrorItem {
  return isRecordLike(v) && typeof v['code'] === 'string'
}

export function isApiErrorResponse(v: unknown): v is ApiErrorResponse {
  if (!isRecordLike(v)) return false
  const statusLike = (v as Record<string, unknown>)['status'] ?? (v as Record<string, unknown>)['statusCode']
  const statusNum = toHttpStatus(statusLike)
  const code = (v as Record<string, unknown>)['code']
  const errors = (v as Record<string, unknown>)['errors']
  const meta = (v as Record<string, unknown>)['meta']

  const statusOk = typeof statusNum === 'number' && statusNum >= 400 && statusNum < 500
  const codeOk = typeof code === 'string'
  const errorsOk = Array.isArray(errors) && errors.every((e) => isApiErrorItem(e))
  const metaOk =
    isRecordLike(meta) &&
    typeof (meta as Record<string, unknown>)['requestId'] === 'string' &&
    typeof (meta as Record<string, unknown>)['serverTime'] === 'string'

  return statusOk && codeOk && errorsOk && metaOk
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

export function toHttpStatus(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isInteger(n)) return n
  }
  return null
}
export function unwrapHttp(raw: unknown): { httpStatus: number; payload: unknown } {
  if (isHttpWrapper(raw)) {
    return { httpStatus: raw.statusCode, payload: safeJson(raw.body) }
  }
  const httpStatus =
    (raw && typeof raw === 'object' && 'statusCode' in (raw ))
      ? (toHttpStatus((raw as { statusCode?: unknown })?.statusCode) ?? 200)
      : 200
  return { httpStatus, payload: raw }
}

type HttpWrapper = { statusCode: number; body?: unknown }
function isHttpWrapper(v: unknown): v is HttpWrapper {
  return isRecordLike(v) && 'statusCode' in v && typeof (v as Record<string, unknown>).statusCode === 'number'
}

export function safeJson(v: unknown): unknown {
  if (typeof v !== 'string') return v
  try { return JSON.parse(v) } catch { return v }
}

export function normalizeParam(v: unknown): string {
  return String(v ?? '').trim()
}

type HttpErrorLike = {
  statusCode: number;
  message: string;
  data?: unknown;
  name?: string;
  headers?: unknown;
};


export function toHttpError(e: unknown): HttpErrorLike {
  
  if (e && typeof e === 'object') {
    const o = e as {
      statusCode?: unknown;
      payload?: unknown;
      data?: unknown;
      headers?: unknown;
      message?: unknown;
      name?: unknown;
    };
    if (typeof o.statusCode === 'number') {
      return {
        statusCode: o.statusCode,
        message: typeof o.message === 'string' ? o.message : `HTTP ${o.statusCode}`,
        data: o.payload ?? o.data,
        headers: o.headers,
        name: typeof o.name === 'string' ? o.name : undefined,
      };
    }
  }

  
  const ax = e as {
    response?: { status?: number; data?: unknown; headers?: unknown };
    message?: string;
    name?: string;
  };
  if (ax?.response && typeof ax.response.status === 'number') {
    return {
      statusCode: ax.response.status,
      message: ax.message ?? `HTTP ${ax.response.status}`,
      data: ax.response.data,
      headers: ax.response.headers,
      name: ax.name,
    };
  }

  
  const fr = e as {
    status?: number;
    headers?: unknown;
    body?: unknown;
    data?: unknown;
    payload?: unknown;
    message?: string;
    name?: string;
  };
  if (typeof fr?.status === 'number') {
    return {
      statusCode: fr.status,
      message: fr.message ?? `HTTP ${fr.status}`,
      data: fr.body ?? fr.data ?? fr.payload,
      headers: fr.headers,
      name: fr.name,
    };
  }

  
  if (e instanceof Error) {
    const m = e.message.match(/HTTP\s*(\d{3})/i);
    const code = m ? Number(m[1]) : 0;
    return { statusCode: code, message: e.message, name: e.name };
  }

  return { statusCode: 0, message: 'Unknown error' };
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
    }
 
    else if (hasLambdaProxyShape(raw)) {
      const p = raw as ProxyEnvelope<BodyEnvelope<T> | T>
      httpStatus = toHttpStatus(p.statusCode) ?? 200
      headers = p.headers
      body = p.body
    }
    else if (hasBodyStringLocal(raw)) {
      const r = raw as { body: string; statusCode?: unknown; headers?: unknown }
      httpStatus = toHttpStatus(r.statusCode) ?? httpStatus
      headers = isRecordLike(r.headers)
        ? Object.entries(r.headers as Record<string, unknown>)
            .reduce<Record<string, string>>((acc, [k, v]) => {
              if (typeof v === 'string') acc[k] = v
              return acc
            }, {})
        : headers
      body = r.body
    }

    const inner = typeof body === 'string' ? safeJson(body) : body

    if (isRecordLike(inner)) {
      const innerStatus = (inner as Record<string, unknown>)['status'] ?? (inner as Record<string, unknown>)['statusCode']
      const innerStatusNum = toHttpStatus(innerStatus)
      if (httpStatus === 200 && innerStatusNum !== null) {
        httpStatus = innerStatusNum
      }
    }

    return { httpStatus, headers, envelope: inner as BodyEnvelope<T> | T }
  }


  export function hasLambdaProxyShape(x: unknown): x is ProxyEnvelope<unknown> {
    if (!isRecordLike(x)) return false;
    const r = x as Record<string, unknown>;
    const sc = r['statusCode'];
    const bd = r['body'];
    const scOk = toHttpStatus(sc) !== null;
    const bodyOk = typeof bd === 'string' || isRecordLike(bd);
    return scOk && bodyOk;
  }


  export function hasBodyStringLocal(x: unknown): x is { body: string } {
    return isRecordLike(x) && typeof (x as Record<string, unknown>).body === 'string';
  }

  export function getDomainFromEnvelope<T>(envelope: BodyEnvelope<T> | T): T {
    if (isRecordLike(envelope) && 'data' in envelope) {
      return (envelope as BodyEnvelope<T>).data as T
    }
    return envelope as T
  }

  export type ProxyEnvelope<T> = {
    statusCode?: number | string;
    headers?: Record<string, string>;
    body?: string | T;
  };

  export type BodyEnvelope<T> = {
    code?: string;
    data?: T;
    meta?: Record<string, string> | undefined;
    errors?: Array<{ field?: string; code?: string; message?: string }>;
    status?: number | string;
    statusCode?: number | string;
  };

    type HasBodyString = { body: string };
 export  function hasBodyString(v: unknown): v is HasBodyString {
    return isRecordLike(v) && typeof (v as Record<string, unknown>).body === 'string';
  }

type FacilitiesResponse<T> = {
  data: {
    facilities: T[]
    searchResultCount: number
  }
}

export function useFacilityListSearch() {
  const { t } = useI18n()
  const router = useRouter()
  const ERROR_PATH = '/error'
  const statusCode = ref<number | null>(null)
  const CategoryItems = ref<facilityCategory[]>([])
  const StatusItems = ref<fcilityStatus[]>([])
  const FacilityList = ref<Facilitylist[]>([])
  const pageNumber = ref(0)
  const limit = ref(10)           
  const totalPages = ref(0)       

  const loading = ref(false)
  const filterlength = ref(0)    
  const facilityType = ref<string | null>(null)   
  const facilityStatus = ref<string | null>(null)
  const keyword = ref('')      
  const usedropdown = ref(false)  
  const searchNonce = ref(0)       
  const getSecondLine = (column: { secondLine?: string | number | null }): string =>
    column.secondLine == null ? '' : String(column.secondLine).trim()

  async function fetchInitial(): Promise<void> {
    loading.value = true

    try {
      const params = new URLSearchParams()
      params.set('searchFlag', '0')

      const url = `${base.replace(/\/+$/, '')}/facilities?${params.toString()}`
      const raw = await apiGet<unknown>(url)
      const { httpStatus, envelope } = unwrapLambdaProxy<Record<string, unknown>>(raw)

      if (httpStatus === 500) {
        await router.replace(ERROR_PATH)
        return
      }

      const domain = getDomainFromEnvelope<Record<string, unknown>>(envelope)
      if (!isRecordLike(domain)) return

      const facilityTypeMap =
        (domain as Record<string, unknown>)['facilityType'] ??
        (domain as Record<string, unknown>)['facilitytype']

      const facilityStatusMap =
        (domain as Record<string, unknown>)['facilityStatus'] ??
        (domain as Record<string, unknown>)['facilitystatus']

      const isStringMap = (obj: unknown): obj is Record<string, string> =>
        isRecordLike(obj) && Object.values(obj).every(v => typeof v === 'string')

      if (isStringMap(facilityTypeMap)) {
        CategoryItems.value = mapToItemsCategory(facilityTypeMap)
      }
      if (isStringMap(facilityStatusMap)) {
        StatusItems.value = mapToItemsStatus(facilityStatusMap)
      }
    } catch (e: unknown) {
      
  const he = toHttpError(e)          
  statusCode.value = he.statusCode
      if (isHttpError(e) && he.statusCode === 500) {
        await router.replace(ERROR_PATH)
        return
      }
         if (he.statusCode === 504) {
          applyErrorsToPage(
            (e as { data?: unknown }).data ?? { code: '', errors: [] },
            { topList: topErrorList, fieldMap: serverErrors, reset: true }
          );
          FacilityList.value = [];
          return;
        }
    
      const hasNoPageErrors =
        topErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0

      if (hasNoPageErrors) {
        const message = toNetworkMessage(e, t('error.E0038'))
        topErrorList.value = [message]
      }
    } finally {
      loading.value = false
    }
  }
  type FacilitiesTopLevel = {
    facilities: Facilitylist[];
    searchResultCount: number;
  };
  type FacilitiesDataWrapper = {
    data: FacilitiesTopLevel;
  };

  function isFacilitiesTopLevel(v: unknown): v is FacilitiesTopLevel {
    if (!isRecordLike(v)) return false;
    const r = v as Record<string, unknown>;
    return Array.isArray(r.facilities) && typeof r.searchResultCount === 'number';
  }
 
  function isFacilitiesDataWrapper(v: unknown): v is FacilitiesDataWrapper {
    if (!isRecordLike(v)) return false;
    const r = v as Record<string, unknown>;
    return isFacilitiesTopLevel(r.data);
  }


  async function fetchSearch(): Promise<void> {
    loading.value = true;
    try {
      
      const params = new URLSearchParams();
      params.set('searchFlag', '1');
      const currentLimit = 10;
      const currentPage = Math.max(1, Number(pageNumber.value) || 1);
      params.set('page', String(currentPage));
      const kw = normalizeParam(keyword.value);
      const category = normalizeParam(facilityType.value);
      const statusValue = normalizeParam(facilityStatus.value);
      const MAX_LEN = 40;
      if (kw && kw.length > MAX_LEN) {
        const type = '文字列';
        pushTopErrors(t('error.E0002', ['キーワード検索項目', MAX_LEN, type]));
        FacilityList.value = [];
        return;
      }

      
      if (kw && kw.toLowerCase() !== 'all') params.set('keyword', kw);

      if (category == null || category === '2') {
        params.set('facilityType', '');
      } else if (category && category.toLowerCase() !== 'all') {
        params.set('facilityType', category);
      }

      if (statusValue == null || statusValue === '3') {
        params.set('facilityStatus', '');
      } else if (statusValue && statusValue.toLowerCase() !== 'all') {
        params.set('facilityStatus', statusValue);
      }
      const urlBase = (base ?? '').toString().trim();
      const url = `${urlBase.replace(/\/+$/, '')}/facilities?${params.toString()}`;
      if (import.meta.env.DEV) console.debug('[fetchSearch] GET', url);

      const raw = await apiGet<unknown>(url);
      const { httpStatus, envelope } = unwrapLambdaProxy<
        FacilitiesResponse<Facilitylist> | ApiErrorResponse | Record<string, unknown>
      >(raw);
      if (httpStatus === 500) {
        await router.replace(ERROR_PATH);
        return;
      }
      let normalized: unknown = envelope;

      if (typeof normalized === 'string') {
        normalized = safeJson(normalized);
      }
      if (hasBodyString(normalized)) {
        const parsed = safeJson(normalized.body);
        normalized = parsed;
      }

      if (isApiErrorResponse(normalized)) {
        applyErrorsToPage(
          normalized,
          { topList: topErrorList, fieldMap: serverErrors, reset: true }
        );
        FacilityList.value = [];
        return;
      }
      let domain: FacilitiesResponse<Facilitylist> | ApiErrorResponse | Record<string, unknown>;
      if (isFacilitiesDataWrapper(normalized)) {
        domain = normalized;
      } else {

        if (isFacilitiesTopLevel(normalized)) {
          domain = { data: normalized };
        } else {
          pushTopErrors(t('error.E0038'));
          FacilityList.value = [];
          return;
        }
      }

      const ok = domain as FacilitiesResponse<Facilitylist>;
      FacilityList.value = ok.data.facilities ?? [];

      const totalItems = ok.data.searchResultCount ?? 0;
      totalPages.value = totalItems > 0 ? Math.ceil(totalItems / currentLimit) : 0;

      if (totalPages.value > 0 && pageNumber.value > totalPages.value) {
        pageNumber.value = totalPages.value;
      }
      if (totalPages.value === 0) {
        pageNumber.value = 1;
      }
      filterlength.value = totalItems;

    } catch (e: unknown) {
      if (isHttpError(e)) {
 
        if (e.statusCode === 500) {
          await router.replace(ERROR_PATH);
          return;
        }
        if (e.statusCode === 404 || e.statusCode === 400 || e.statusCode === 504) {
          applyErrorsToPage(
            (e as { data?: unknown }).data ?? { code: '', errors: [] },
            { topList: topErrorList, fieldMap: serverErrors, reset: true }
          );
          FacilityList.value = [];
          filterlength.value = 0;   
          totalPages.value = 0; 
          return;
        }
      }
      const hasNoPageErrors =
        topErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0;

      if (hasNoPageErrors) {
        const message = toNetworkMessage(e, t('error.E0038'));
        topErrorList.value = [message];
      }
    } finally {
      loading.value = false;
    }
  }
  async function search() { 
    resetTopErrors();
    serverErrors.value = {}; 
    const statusNorm = normalizeParam(facilityStatus.value)
    const typeNorm = normalizeParam(facilityType.value)
    const keywordNorm = normalizeParam(keyword.value)
    
    const hasDropdownSelection =
      (!!statusNorm && statusNorm.toLowerCase() !== 'all') ||
      (!!typeNorm && typeNorm.toLowerCase() !== 'all')

    const hasKeyword = !!keywordNorm && keywordNorm.toLowerCase() !== 'all'
    usedropdown.value = hasDropdownSelection || hasKeyword
    pageNumber.value = 1
    searchNonce.value++
    await fetchSearch()
  }
  function keyclearError() {
    keyword.value = ''
  }
  return {
    CategoryItems,
    StatusItems,
    FacilityList,
    pageNumber,
    limit,
    totalPages,
    loading,
    filterlength,
    facilityType,
    facilityStatus,
    keyword,
    usedropdown,
    searchNonce,
    selected,
    topErrorList,
    fetchInitial,
    hasBodyString,
    toNetworkMessage,
    toHttpError,
    fetchSearch,
    search,
    keyclearError,
    getSecondLine,
    resetTopErrors,
    pushTopErrors,
    toHttpStatus,
    safeJson,
    unwrapHttp,
    unwrapLambdaProxy,
    isRecordLike,
    isApiErrorItem,
    isApiErrorResponse,
    isHttpError
  }
}
export type FacilityListSearchState = ReturnType<typeof useFacilityListSearch>
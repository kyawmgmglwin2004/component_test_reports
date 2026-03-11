// ---------------------------------------------
// このファイルは施設編集画面の Composable。
// モック・ハンドラからの import を削除し、初期表示は GET /facilities/:id で取得します。
// コメントはすべて日本語です。
// ---------------------------------------------

import { ref, computed, watch, onMounted, type Ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiGet, apiPost,apiPut} from '@/services/http'
import { useRoute, useRouter } from 'vue-router'
import { useGlobalLoading, type GlobalLoadingService } from "../Common/composables/GlobalLoading"
import type { VForm } from 'vuetify/components'
import { applyErrorsToPage } from '../Common/error/errorResolver';

// =============================================
// 型定義（ローカル定義：モックからの import は使用しない）
// =============================================

/** 施設画像（UI が期待するオブジェクト） */
export type FacilityImage = {
  relativePath: string   
  displayName: string    
  presignedUrl: string   
}

/** サーバーのワイヤ型（{ errorCode } のみのケースを含む） */
export type FacilityImageWire = FacilityImage | { errorCode: string }

/** 文字列かどうか */
function isString(v: unknown): v is string {
  return typeof v === 'string'
}

/** FacilityImage かどうか（UI 想定の3フィールドのいずれかが string なら OK とみなす） */
function isFacilityImage(v: unknown): v is FacilityImage {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return isString(o['relativePath']) || isString(o['presignedUrl']) || isString(o['displayName'])
}

/** ワイヤ型を UI 安全な FacilityImage に正規化（{ errorCode } の場合は空値へ） */
function coerceFacilityImage(v: unknown): FacilityImage {
  if (isFacilityImage(v)) {
    const o = v
    return {
      relativePath: isString(o.relativePath) ? o.relativePath : '',
      displayName:  isString(o.displayName) ? o.displayName : '',
      presignedUrl: isString(o.presignedUrl) ? o.presignedUrl : '',
    }
  }
  return { relativePath: '', displayName: '', presignedUrl: '' }
}
/** エラー型 FacilityImageProblem かどうか */
function isFacilityImageError(v: unknown): v is { errorCode: string } {
  return (
    !!v &&
    typeof v === 'object' &&
    'errorCode' in (v as Record<string, unknown>) &&
    typeof (v as Record<string, unknown>).errorCode === 'string'
  );
}

/** パネル/PCS の最小単位 */
export type SolarPanel = { panelNumber: string }
export type PCS       = { pcsNumber: string }

/** 機器（API/画面共通の最低限のプロパティ） */
export type PayloadSolarPanel = { panelNumber: string }
export type PayloadPcsUnit    = { pcsNumber: string }
export type PayloadDevice = {
  deviceNumber: string
  deviceID: string
  productID: string
  updatedAt: string
  solarPanels?: PayloadSolarPanel[]
  pcs?: PayloadPcsUnit[]
}

/** UI で使うテーブル行の型（表示用整形） */
export type UISolarPanel = { panelNumber: string }
export type UIPcsUnit    = { pcsNumber: string }
export type UIDevice = {
  deviceNumber: string
  deviceID: string
  productID: string
  solarPanels: UISolarPanel[]
  pcs: UIPcsUnit[]
}

// 追加する共通型
export type CodeLabelMap = Record<string, string>

/** 施設編集フォームの完全な型（初期表示の GET /facilities/:id が返す形） */
export type EditPayload = {
  facilityTypeSelected: string
  facilityID: string
  ecoCompanyID: string
  ecoCompanyPassword: string
  facilityName: string
  facilityAddress: string
  cityInformation: string
  facilityImage: FacilityImage
  facilityStatusSelected: string
  facilityManagerName: string
  facilityManagerContact: string
  updatedAt: string
  devices?: PayloadDevice[]
  facilityType?: CodeLabelMap
  facilityStatus?: CodeLabelMap
}

/** FacilityEdit POST 用（画像は flatten して imageFilename を送る） */
export type ApiPayload = {
  facilityType: string
  facilityID?: string
  ecoCompanyID: string
  ecoCompanyPassword: string
  facilityName: string
  facilityAddress: string
  cityInformation: string
  imageFilename: string
  facilityStatus: string
  facilityManagerName: string
  facilityManagerContact: string
  updatedAt: string
  devices?: PayloadDevice[]
}

/** API エラー型 */
export type ApiErrorItem = {
  field: string
  code: 'E0001' | 'E0002' | 'E0008' | string
  meta?: { max?: number }
  message?: string
}

/** FacilityEdit POST 結果型（サーバーバリエーションを許容） */
type FacilityEditSuccessBody = {
  statusCode?: 200
  message?: string
  facility?: unknown
}
type FacilityEditSuccessResponseWithStatus = FacilityEditSuccessBody & { statusCode: 200 }
type FacilityEditSuccessResponseWithoutStatus = FacilityEditSuccessBody
type FacilityEditErrorResponse = {
  code: string
  errors: ApiErrorItem[]
  meta: { requestId: string; serverTime: string }
  statusCode: '400' | '404' | '409' | '500'
}
type FacilityEditPostResult =
  | FacilityEditSuccessResponseWithStatus
  | FacilityEditSuccessResponseWithoutStatus
  | FacilityEditErrorResponse

/** 機器作成 API 型 */
export type NewDeviceNumber = { deviceNumber: string | number; updatedAt?: string }
export type EquipmentCreateWire = {
  code: string
  data?: { devices?: NewDeviceNumber }
  errors?: ApiErrorItem[]
  meta: { requestId: string; serverTime: string }
}

type EquipmentCreatePayload = { facilityID: string }

/** PCS 初期化（新規 PCS 番号払い出し） */
export type PCSInitBody = {
  statusCode: '200'
  code: 'PCS_INIT_SUCCESS'
  data: { pcs: Array<{ pcsNumber: string }> }
  meta: { requestId: string; serverTime: string }
}

const base=import.meta.env.VITE_API_BASE_URL;


type PendingChanges = Partial<Pick<
  EditPayload,
  | 'ecoCompanyID'
  | 'ecoCompanyPassword'
  | 'facilityName'
  | 'facilityAddress'
  | 'cityInformation'
  | 'facilityStatusSelected'
  | 'facilityImage'
>>

const pending: Ref<PendingChanges> = ref({})
// =============================================
// ユーティリティ
// =============================================

/** オブジェクトのディープコピー */
function deepClone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T
}
/** HTTP ステータス正規化（数値 or 文字列 → 数値） */
function toHttpStatus(s: unknown): number | null {
  if (s == null) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** 画像 URL の解決（相対 → BASE_URL 付き） */
const defaultImage = ''
function resolveUrl(u?: string): string {
  if (!u) return defaultImage
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u
  const base = import.meta.env?.BASE_URL ?? '/'
  return `${base.replace(/\/$/, '')}${u.startsWith('/') ? '' : '/'}${u}`
}

/** 送信用に EditPayload → ApiPayload（画像の relativePath を flatten） */
function mapEditToApi(p: EditPayload): ApiPayload {
  return {
    facilityType: p.facilityTypeSelected,
    facilityID: p.facilityID,
    ecoCompanyID: p.ecoCompanyID,
    ecoCompanyPassword: p.ecoCompanyPassword,
    facilityName: p.facilityName,
    facilityAddress: p.facilityAddress,
    cityInformation: p.cityInformation,
    imageFilename: p.facilityImage?.relativePath || '',
    facilityStatus: p.facilityStatusSelected,
    facilityManagerName: p.facilityManagerName,
    facilityManagerContact: p.facilityManagerContact,
    updatedAt: p.updatedAt,
  }
}
/** 真偽系クエリ文字列のパース（'true','1','yes' → true） */
function isQueryTrue(v: unknown): boolean {
  if (Array.isArray(v)) v = v[0]
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'true' || s === '1' || s === 'yes'
}

/** ID 接頭辞ヘルパー（"HSP912" → "HSP912-"） */
function buildIdPrefixFrom(v?: string | null): string {
  const s = String(v ?? '').trim()
  return s ? `${s}-` : ''
}
function splitOnDashKeepDashOrDefault(id: string | undefined, defaultPrefix: string): { prefix: string; suffix: string } {
  const src = String(id ?? '')
  const i = src.indexOf('-')
  if (i === -1) return { prefix: defaultPrefix, suffix: src }
  return { prefix: src.slice(0, i + 1), suffix: src.slice(i + 1) }
}
function recombineWithDash(prefix: string, suffix: string): string {
  return `${prefix}${suffix}`
}

// =============================================
// Composable 本体
// =============================================

export function useFacilityEdit() {
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const formRef = ref<InstanceType<typeof VForm> | null>(null)

  const emptyImage: FacilityImage = { relativePath: '', displayName: '', presignedUrl: '' }
  const emptyForm: EditPayload = {
    facilityTypeSelected: '0',
    facilityID: '',
    ecoCompanyID: '',
    ecoCompanyPassword: '',
    facilityName: '',
    facilityAddress: '',
    cityInformation: '',
    facilityImage: emptyImage,
    facilityStatusSelected: '0',
    facilityManagerName: '',
    facilityManagerContact: '',
    updatedAt: '',
    devices: [],
  }

  function clearFacilityImage(): void {
    if (suppressCategoryWatch.value) return
    formData.value.facilityImage = { relativePath: '', displayName: '', presignedUrl: '' }
    clearServerError('imageFilename')
  }

  // ---- フォーム状態 ----
  const formData: Ref<EditPayload> = ref<EditPayload>(deepClone(emptyForm))
  const initialData: Ref<EditPayload> = ref<EditPayload>(deepClone(emptyForm))

function splitProductIdSuffixWithFrozenPrefix(productId: string): string {
  const prefix = initialData.value.ecoCompanyID
    ? `${initialData.value.ecoCompanyID}-`
    : '';
  return splitOnDashKeepDashOrDefault(productId, prefix).suffix;
}
  // ---- UI 状態 ----
  const msg             = ref<string>('')
  const error           = ref<string | null>('')
  const dialogError     = ref<string | null>('')
  const dialog          = ref<boolean>(false)
  const loading         = ref<boolean>(false)
  const loadingCategory = ref<boolean>(false)
  const loadingStatus   = ref<boolean>(false)
  const loadingImages   = ref<boolean>(false) // 画像ダイアログのスピナー
  const statusCode          = ref<number | null>(null)

  // ---- ドロップダウン ----
  interface CategoryItem { title: string; value: string }
  interface StatusItem   { title: string; value: string }
  const CategoryItems = ref<CategoryItem[]>([])
  const StatusItems   = ref<StatusItem[]>([])

  // 既存の i18n による label 置換(categoryLabel/statusLabel)は使用しない方向に
  // フォールバック定数（ご提示値に準拠）
  const facilityTypeFallbackMap: CodeLabelMap  = {
    '0': '自治体',
    '1': '家庭',
  }

  const facilityStatusFallbackMap: CodeLabelMap  = {
    '0': '非運用',
    '1': '運用中',
    '2': 'メンテナンス',
  }
  
  function isMap(v: unknown): v is CodeLabelMap {
    return !!v && typeof v === 'object' && !Array.isArray(v)
  }
  function mapToItems(map: CodeLabelMap): { title: string; value: string }[] {
    return Object.entries(map).map(([code, label]) => ({
      value: String(code),
      title: String(label),
    }))
  }

  function hydrateCategoryItemsFromPayload(data: Partial<EditPayload>): void {
    if (isMap(data.facilityType)) {
      CategoryItems.value = mapToItems(data.facilityType)
    } else {
      CategoryItems.value = mapToItems(facilityTypeFallbackMap)
    }
  }

  function hydrateStatusItemsFromPayload(data: Partial<EditPayload>): void {
    if (isMap(data.facilityStatus)) {
      StatusItems.value = mapToItems(data.facilityStatus)
    } else {
      StatusItems.value = mapToItems(facilityStatusFallbackMap)
    }
  }

  // ---- サーバーエラー管理 ----
  const serverErrors = ref<Record<string, string[]>>({})
  const topErrorList = ref<string[]>([])
  const equipmentCreateErrorList = ref<string[]>([])
  const deviceIDErrorList = ref<string[]>([])
  const productIDErrorList = ref<string[]>([])
  const deviceDeleteErrorList = ref<string[]>([])
  // const addPanelErrorList = ref<string[]>([])
  // const addPcsErrorList = ref<string[]>([])
  // const panelsBulkDeleteErrorList = ref<string[]>([])
  // const pcsBulkDeleteErrorList = ref<string[]>([])

  /** クエリ (?registerFlag=true) の真偽判定 */
  const registerFlagFromQuery = computed<boolean>(() => isQueryTrue(route.query.registerFlag))

  /** 特定フィールドのサーバーエラー消去 */
  function clearServerError(field: string): void {
    if (serverErrors.value[field]) {
      const rest = { ...serverErrors.value }
      delete rest[field]
      serverErrors.value = rest
    }
  }
  /** サーバーエラー全消去 */
  function clearAllServerErrors(): void {
    serverErrors.value = {}
    topErrorList.value = []
    equipmentCreateErrorList.value = []
    deviceIDErrorList.value = []
    productIDErrorList.value = []
    deviceDeleteErrorList.value = []
    // addPanelErrorList.value = []
    // addPcsErrorList.value = []
    // panelsBulkDeleteErrorList.value = []
    // pcsBulkDeleteErrorList.value = []
  }
  function clearMessages() {
    msg.value = '';
    error.value = '';
    clearAllServerErrors();
    clearTableSuccess();
    clearRowErrors();
    // serverErrors.value = {};
  }

  // ---- 画像関連 ----
  const images = ref<FacilityImage[]>([])
  const selectedImageUrl = computed<string>(() => {
    const img = formData.value.facilityImage
    return (img?.presignedUrl && img.presignedUrl.length > 0)
      ? img.presignedUrl
      : resolveUrl(img?.relativePath || '')
  })
  const pageBgUrl = computed<string>(() => selectedImageUrl.value || '')
  const pageBgStyle = computed<Record<string, string>>(() => ({
    backgroundImage: pageBgUrl.value ? `url("${pageBgUrl.value}")` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  }))

  // ===== Lambda Proxy（API Gateway Proxy Integration）向けのワイヤ型 =====
  /** Lambda Proxy のトップレベル（statusCode / headers / body） */
  type ProxyEnvelope<T> = {
    statusCode?: number | string;
    headers?: Record<string, string>;
    body?: string | T; 
  };

  /** body 側が code/data/meta/errors を持つケース */
  type BodyEnvelope<T> = {
    code?: string;
    data?: T;
    meta?: Record<string, string> | undefined;
    errors?: Array<{ field?: string; code?: string; message?: string }>;
    statusCode?: number | string;
  };
  /** 成功レスポンスをドメイン型 T にアンラップ */
  // ===== 成功レスポンスをドメイン型 T にアンラップ（unknown/any を不使用）=====
  function unwrapToDomain<T>(
    raw: ProxyEnvelope<BodyEnvelope<T> | T> | BodyEnvelope<T> | T
  ): T {
    if (raw && typeof raw === 'object' && 'statusCode' in raw || (raw && typeof raw === 'object' && 'body' in raw)) {
      const env = raw as ProxyEnvelope<BodyEnvelope<T> | T>;
      const b = env.body;

      if (typeof b === 'string') {
        try {
          const parsed = JSON.parse(b) as BodyEnvelope<T> | T;
          if (parsed && typeof parsed === 'object' && 'data' in parsed) {
            return (parsed as BodyEnvelope<T>).data as T;
          }
          return parsed as T;
        } catch {
          return {} as T;
        }
      }

      if (b && typeof b === 'object' && 'data' in (b as BodyEnvelope<T>)) {
        return (b as BodyEnvelope<T>).data as T;
      }
      return b as T;
    }

    if (raw && typeof raw === 'object' && 'data' in (raw as BodyEnvelope<T>)) {
      return (raw as BodyEnvelope<T>).data as T;
    }

    return raw as T;
  }

  // ---- 入力バリデーション（簡易ルール） ----
  const requiredRule =(fieldKey: string) =>(v: string | boolean) => {
    const ok = typeof v === 'boolean' ? v === true : !!(v && String(v).trim().length)
    return ok || t('error.E0001', [ t(fieldKey) ])
  }
  const maxRule = (fieldKey: string, max: number) => (v: string) => {
    const ok = !v || v.trim().length <= max
    return ok || t('error.E0002', [ t(fieldKey), String(max), '文字' ])
  }
  const atEmailLikeRule = (fieldKey: string) => (v: string) => {
    const value = (v ?? '').toString().trim()
    if (!value) return true               // ← allow empty / null
    const ok = /^[^\s@]+@[^\s@]+$/.test(value)
    return ok || t('error.E0008', [ t(fieldKey) ])
  }
  const mustBeHalfWidthRule = (fieldKey: string) => (value: unknown) => {
    const v = String(value ?? '').trim()
    if (!v) return true
    const ok = isHalfWidth(v)
    return ok || t('error.E0013', [t(fieldKey),'半角文字'])
  }
  function isHalfWidth(input: unknown, allowEmpty = false): boolean {
    const s = String(input ?? '')
    if (s.length === 0) return !!allowEmpty
    const halfWidthRegex = /^[\x20-\x7E\uFF61-\uFF9F]+$/u
    return halfWidthRegex.test(s)
  }

  const mustBeStringRule  = (fieldKey: string) => {
    const re = /[\[\]\{\}"':,]/u
    return (v: unknown) => {
      const s = String(v ?? '')
      const ok = !re.test(s)
      return ok || t('error.E0047', [ t(fieldKey)])
    }
  }

  const SAFE_SUFFIX_REGEX = /^(?!_)[^ \-^]+$/u;

  function findDangerousToken(v: string): string | null {
    clearTableSuccess();
    const s = String(v ?? '');
    return SAFE_SUFFIX_REGEX.test(s) ? null : 'INVALID';
  }

  function dangerMessage(fieldKey: string): string {
    return t('error.E0047', [ t(fieldKey) ]) as string;
  }
  
  const rules = {
    ecoCompanyID: [requiredRule('facility.ecoCompanyID'),mustBeStringRule('facility.ecoCompanyID'),maxRule('facility.ecoCompanyID', 8)],
    ecoCompanyPassword: [requiredRule('facility.ecoCompanyPassword'), mustBeStringRule('facility.ecoCompanyPassword'),maxRule('facility.ecoCompanyPassword', 16)],
    facilityName: [requiredRule('facility.facilityName'), mustBeStringRule('facility.facilityName'),maxRule('facility.facilityName', 30)],
    facilityAddress: [requiredRule('facility.facilityAddress'), mustBeStringRule('facility.facilityAddress'),maxRule('facility.facilityAddress', 40)],
    cityInformation: [requiredRule('facility.cityInformation'), mustBeStringRule('facility.cityInformation'),maxRule('facility.cityInformation', 50)],
    imageFilename: [requiredRule('facility.imageFilename'),mustBeStringRule('facility.imageFilename')],
    managerName: [maxRule('facility.facilityManagerName', 20),mustBeStringRule('facility.facilityManagerName')],
    managerContact: [maxRule('facility.facilityManagerContact', 254), atEmailLikeRule('facility.facilityManagerContact'),mustBeHalfWidthRule('facility.facilityManagerContact')],
    deviceID: [requiredRule('device.deviceID'), maxRule('device.deviceID', 11) ],
    productID: [requiredRule('device.productID'), maxRule('device.productID', 11)],
  }
  const gl: GlobalLoadingService = useGlobalLoading()
  const updatingDeviceId = ref<Record<string, boolean>>({})
  const rowErrors        = ref<Record<string, string | null>>({})
  const showForDeviceNumber = ref<string | null>(null)

  function setUpdating(deviceNumber: string, v: boolean): void {
    updatingDeviceId.value = { ...updatingDeviceId.value, [deviceNumber]: v }
  }
  function isUpdating(deviceNumber: string): boolean {
    return !!updatingDeviceId.value[deviceNumber]
  }
  
  type RowFieldErrorMap = Record<string, { deviceID?: string | null; productID?: string | null }>;

  const rowFieldErrors = ref<RowFieldErrorMap>({});

  function setRowError(deviceNumber: string, message: string | null): void {
    rowErrors.value = { ...rowErrors.value, [deviceNumber]: message }
  }
    function setRowFieldError(
    deviceNumber: string,
    field: 'deviceID' | 'productID',
    message: string | null
  ): void {
    const dn = String(deviceNumber);
    const current = rowFieldErrors.value[dn] ?? {};
    rowFieldErrors.value = {
      ...rowFieldErrors.value,
      [dn]: { ...current, [field]: message },
    };
  }

  function hasAnyRowError(deviceNumber: string): boolean {
    const ent = rowFieldErrors.value[String(deviceNumber)];
    if (!ent) return false;
    return !!(ent.deviceID && ent.deviceID.trim()) || !!(ent.productID && ent.productID.trim());
  }


  function clearRowErrors(): void {
    rowErrors.value = {};
    rowFieldErrors.value = {};
  }
  
  const inlineRowErrorList = computed<string[]>(() => {
    const out: string[] = [];
    Object.values(rowFieldErrors.value).forEach((byField) => {
      if (byField.deviceID && byField.deviceID.trim()) out.push(byField.deviceID);
      if (byField.productID && byField.productID.trim()) out.push(byField.productID);
    });
    return out;
  });

  function canProceedUpdate(deviceNumber?: string | number): boolean {
    if (inlineRowErrorList.value.length > 0) {
      if (deviceNumber != null && !hasAnyRowError(String(deviceNumber))) {
      }
      return false;
    }
    if (deviceNumber != null && hasAnyRowError(String(deviceNumber))) return false;
    return true;
  }

  function extractMessageCode(raw: unknown): string | undefined {
    if (!raw) return undefined;

    if (typeof raw === 'object' && raw !== null && 'body' in (raw as Record<string, unknown>)) {
      const body = (raw as { body?: unknown }).body;
      if (typeof body === 'string') {
        try {
          const parsed = JSON.parse(body) as Record<string, unknown>;
          return (parsed?.code as string) ?? undefined;
        } catch {
          return undefined;
        }
      }
      if (typeof body === 'object' && body !== null) {
        return ((body as Record<string, unknown>).code as string) ?? undefined;
      }
    }

    if (typeof raw === 'object' && raw !== null) {
      return ((raw as Record<string, unknown>).code as string) ?? undefined;
    }

    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return (parsed?.code as string) ?? undefined;
      } catch {
      }
    }
    return undefined;
  }

  function toSuccessMessage(raw: unknown): string {
    const code = extractMessageCode(raw);
    if (!code) return ''; 
    const key = `message.${code}`;
    const translated = t(key) as string;
    return translated && translated !== key ? translated : '';
  }

  const tableSuccessList = ref<string[]>([]);

  function clearTableSuccess() {
    tableSuccessList.value = [];
  }
  function pushTableSuccess(m: string) {
    if (!m) return;
    tableSuccessList.value = [m];
  }
  // 表示用カラム定義（i18n ラベル）
  type Row = {
    col1?: string | number | null
    col2?: string | number | null
    col3?: string | number | null
    col4?: string | number | null
    col5?: string | number | null
    col6?: string | number | null
    col7?: string | number | null
  }
  const columns = computed(() => ([
    { key: 'col1', label: t('device.select') },
    { key: 'col2', label: t('device.deviceID') },
    { key: 'col3', label: t('device.productID') },
    { key: 'col4', label: t('device.solarPanelInfo') },
    { key: 'col5', label: t('device.pcsInfo') },
    { key: 'col6', label: t('device.batteryInfo') },
    { key: 'col7', label: t('device.smartMeterInfo') },
  ] as { key: keyof Row; label: string }[]))

  /** UI 表示用にデバイスを整形（空文字/undefined を除外） */
  const deviceRows = computed<UIDevice[]>(() => {
    const list: PayloadDevice[] = formData.value.devices ?? []
    return list.map((d) => ({
      deviceNumber: d.deviceNumber,
      deviceID: d.deviceID,
      productID: d.productID,
      solarPanels: (d.solarPanels ?? [])
        .filter(sp => sp && String(sp.panelNumber ?? '').trim().length > 0)
        .map(sp => ({ panelNumber: sp.panelNumber })),
      pcs: (d.pcs ?? [])
        .filter(u => u && String(u.pcsNumber ?? '').trim().length > 0)
        .map(u => ({ pcsNumber: u.pcsNumber })),
    }))
  })

  // ---- 行ごとの選択状態 ----
  const selectedDeviceNumbers = ref<Set<string>>(new Set())
  const selectedPanels        = ref<Record<string, Set<string>>>({})
  const selectedPcs           = ref<Record<string, Set<string>>>({})

  /** 設備行の削除可否（最低1件は残す、かつ全選択不可） */
  const canDeleteSelectedDevices = computed<boolean>(() => {
    const total = deviceRows.value.length
    const selected = selectedDeviceNumbers.value.size
    return total > 1 && selected > 0 && selected < total
  })
  function disableRowCheckbox(deviceNumber: string): boolean {
    const total = deviceRows.value.length
    if (total <= 1) return true
    const selectedCount = selectedDeviceNumbers.value.size
    const isAlreadySelected = selectedDeviceNumbers.value.has(deviceNumber)
    if (isAlreadySelected) return false
    return (selectedCount + 1) >= total
  }
  function onToggleRow(deviceNumber: string, checked: boolean): void {
    if (checked) selectedDeviceNumbers.value.add(deviceNumber)
    else selectedDeviceNumbers.value.delete(deviceNumber)
  }

  function ensureSet(store: Record<string, Set<string>>, deviceNumber: string): Set<string> {
    if (!store[deviceNumber]) store[deviceNumber] = new Set<string>()
    return store[deviceNumber]
  }
  function setInRecordSet(
    record: Record<string, Set<string>>,
    key: string,
    value: string,
    checked: boolean
  ): void {
    const s = ensureSet(record, key)
    if (checked) s.add(value)
    else s.delete(value)
  }
  function onTogglePanel(deviceNumber: string, panelNumber: string, checked: boolean): void {
    setInRecordSet(selectedPanels.value, deviceNumber, String(panelNumber), checked)
  }
  function onTogglePcs(deviceNumber: string, pcsNumber: string, checked: boolean): void {
    setInRecordSet(selectedPcs.value, deviceNumber, String(pcsNumber), checked)
  }
  /** 正の整数かどうか（1,2,3,... を許可。文字列値もOK） */
  function isValidPositiveInt(v: unknown): boolean {
    if (v == null) return false
    const s = String(v).trim()
    if (s.length === 0) return false
    // 「001」も許可するなら /^\d+$/、禁止するなら /^[1-9]\d*$/
    if (!/^\d+$/.test(s)) return false
    const n = Number(s)
    return Number.isInteger(n) && n > 0
  }

  /** deviceNumber が不正な時の表示メッセージ（i18n キーがあればそれを使用） */
  function invalidDeviceNumberMessage(): string {
    return t('error.E0037', { value: '' })
  }
  // ---- ID の接頭辞処理 ----
  function deviceIdPrefixGlobal(): string {
    return buildIdPrefixFrom(formData.value.facilityID)
  }
  function productIdPrefixGlobal(): string {
    return buildIdPrefixFrom(initialData.value.ecoCompanyID)
  }

  // ---- 列の表示条件 ----
  function hasAnyPanel(r: { solarPanels: { panelNumber: string }[] }): boolean {
    return (r.solarPanels ?? []).some(sp => String(sp?.panelNumber ?? '').trim().length > 0)
  }
  function hasAnyPcs(r: { pcs: { pcsNumber: string }[] }): boolean {
    return (r.pcs ?? []).some(pc => String(pc?.pcsNumber ?? '').trim().length > 0)
  }
  function showCols4to7ForDevice(deviceNumber: string): boolean {
    const row = deviceRows.value.find(x => x.deviceNumber === deviceNumber)
    if (!row) return false
    return hasAnyPanel(row) && hasAnyPcs(row)
  }
  function shouldShowColsForRow(deviceNumber: string): boolean {
    const row = deviceRows.value.find(x => x.deviceNumber === deviceNumber)
    if (!row) return false
    const hasPanels = (row.solarPanels ?? []).some(sp => String(sp?.panelNumber ?? '').trim().length > 0)
    const hasPcs    = (row.pcs ?? []).some(pc => String(pc?.pcsNumber ?? '').trim().length > 0)
    return String(deviceNumber) === String(showForDeviceNumber.value ?? '') && hasPanels && hasPcs
  }
  function gateCols4to7(deviceNumber: string): boolean {
    return showCols4to7ForDevice(deviceNumber) || shouldShowColsForRow(deviceNumber)
  }

  // ---- 接尾辞入力の反映（deviceID / productID） ----
  function onDeviceIdSuffixInput(deviceNumber: string, ev: Event): void {
    const suffix = (ev.target as HTMLInputElement).value
    const devices = formData.value.devices
    if (!devices) return
    const real = devices.find(d => d.deviceNumber === deviceNumber)
    if (!real) return
    real.deviceID = suffix
  }
  function onProductIdSuffixInput(deviceNumber: string, ev: Event): void {
    const suffix = (ev.target as HTMLInputElement).value
    const devices = formData.value.devices
    if (!devices) return
    const real = devices.find(d => d.deviceNumber === deviceNumber)
    if (!real) return
    real.productID = suffix
  }

  // ---- パネル追加 ----
  // async function addPanel(
  //   deviceNumber: string,
  //   gl: GlobalLoadingService
  // ): Promise<void> {
  //   if (loading.value) return;
  //   if (!isValidPositiveInt(deviceNumber)) {
  //     const msg = invalidDeviceNumberMessage()

  //     setRowError(String(deviceNumber), msg)

  //     addPanelErrorList.value = [msg]
  //     return
  //   }

  //   const list = formData.value.devices;
  //   if (!Array.isArray(list)) return;
  //   const row = list.find(d => String(d.deviceNumber) === String(deviceNumber));
  //   if (!row) return;

  //   setUpdating(deviceNumber, true);
  //   gl.show();
  //   loading.value = true;

  //   try {
  //     const resRaw = await createSolarPanel(deviceNumber);
  //     const res = unwrapToDomain<{ deviceNumber: number; statusCode?: number | string }>(resRaw);

  //     const newPanelNumber = String(
  //       (res as { deviceNumber?: unknown })?.deviceNumber ?? deviceNumber
  //     );
  //     if (!Array.isArray(row.solarPanels)) row.solarPanels = [];
  //     const exists = row.solarPanels.some(p => String(p.panelNumber) === newPanelNumber);
  //     if (!exists) {
  //       row.solarPanels.push({ panelNumber: newPanelNumber });
  //     }

  //     clearAllServerErrors?.();

  //   } catch (e: unknown) {
  //     const he = toHttpError(e);
  //     statusCode.value = he.statusCode;

  //     if (he.statusCode === 500) {
  //       router.push({ name: 'common-error', query: { returnTo: route.fullPath } });
  //       return;
  //     }

  //     applyErrorsToPage(
  //       (he.data as unknown) ?? { code: '', errors: [] },
  //       {
  //         topList: addPanelErrorList,
  //         fieldMap: serverErrors,
  //         reset: true,
  //       }
  //     );
  //     const hasNoPageErrors =
  //       addPanelErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0

  //     if (hasNoPageErrors) {
  //       const message = toNetworkMessage(e, t('error.E0038'))
  //       addPanelErrorList.value = [message]
  //     }

  //     error.value=''
  //   } finally {
  //     setUpdating(deviceNumber, false);
  //     loading.value = false;
  //     gl.hide();
  //   }
  // }

  // // ---- PCS 追加 ----
  // async function addPcs(
  //   deviceNumber: string,
  //   gl: GlobalLoadingService
  // ): Promise<void> {
  //   if (loading.value) return;
  //   if (!isValidPositiveInt(deviceNumber)) {
  //     const msg = invalidDeviceNumberMessage()

  //     setRowError(String(deviceNumber), msg)

  //     addPcsErrorList.value = [msg]
  //     return
  //   }

  //   gl.show();
  //   loading.value = true;

  //   try {
  //       const wire = await getPcsInit(deviceNumber);

  //       const dto = unwrapToDomain<PcsInitData>(wire);

  //       const row = formData.value.devices?.find(
  //         d => String(d.deviceNumber) === String(deviceNumber)
  //       );
  //       if (!row) return;

  //       if (!Array.isArray(row.pcs)) row.pcs = [];

  //       const newPCS = dto.pcs?.[0];
  //       if (!newPCS || newPCS.pcsNumber == null) {
  //         return;
  //       }

  //       const pcsNumber = String(newPCS.pcsNumber);
  //       const exists = row.pcs.some(p => String(p.pcsNumber) === pcsNumber);
  //       if (!exists) {
  //         row.pcs.push({ pcsNumber });
  //       }

  //       setRowError(String(deviceNumber), null);
  //       clearAllServerErrors?.();
  //   } catch (e: unknown) {
  //     const he = toHttpError(e);
  //     statusCode.value = he.statusCode;

  //     if (he.statusCode === 500) {
  //       router.push({ name: 'common-error', query: { returnTo: route.fullPath } });
  //       return;
  //     }

  //     applyErrorsToPage(
  //       (he.data as unknown) ?? { code: '', errors: [] },
  //       {
  //         topList: addPcsErrorList,
  //         fieldMap: serverErrors,
  //         reset: true,
  //       }
  //     );

  //     const hasNoPageErrors =
  //       addPcsErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0

  //     if (hasNoPageErrors) {
  //       const message = toNetworkMessage(e, t('error.E0038'))
  //       addPcsErrorList.value = [message]
  //     }

  //     error.value=''
  //   } finally {
  //     loading.value = false;
  //     gl.hide();
  //   }
  // }

  // ---- パネル／PCS の単体削除（UI のみ）----
  // function removePanel(deviceNumber: string, panelNumber: string): void {
  //   const list = formData.value.devices
  //   if (!list) return
  //   const row = list.find(d => d.deviceNumber === deviceNumber)
  //   if (!row || !row.solarPanels) return
  //   row.solarPanels = row.solarPanels.filter(p => String(p.panelNumber) !== String(panelNumber))
  //   ensureSet(selectedPanels.value, deviceNumber).delete(String(panelNumber))
  // }
  // function removePcs(deviceNumber: string, pcsNumber: string): void {
  //   const list = formData.value.devices
  //   if (!list) return
  //   const row = list.find(d => d.deviceNumber === deviceNumber)
  //   if (!row || !row.pcs) return
  //   row.pcs = row.pcs.filter(u => String(u.pcsNumber) !== String(pcsNumber))
  //   ensureSet(selectedPcs.value, deviceNumber).delete(String(pcsNumber))
  // }

  // ---- デバイス行の削除（UI のみ） ----
  function removeDevice(deviceNumber: string): void {
    const list = formData.value.devices
    if (!list) return
    const idx = list.findIndex(d => d.deviceNumber === deviceNumber)
    if (idx !== -1) list.splice(idx, 1)
    selectedDeviceNumbers.value.delete(String(deviceNumber))
    delete selectedPanels.value[deviceNumber]
    delete selectedPcs.value[deviceNumber]
  }

  // ---- 機器作成 / 一括削除 / 更新 ----
  function ensureDevices(): void {
    if (!formData.value.devices) formData.value.devices = []
  }
  function deviceIdPrefix(): string { return deviceIdPrefixGlobal() }
  function productIdPrefix(): string { return productIdPrefixGlobal() }

  type EquipmentCreateData = { devices?: NewDeviceNumber };

  type EquipmentCreateWire =
    | ProxyEnvelope<BodyEnvelope<EquipmentCreateData> | EquipmentCreateData>
    | BodyEnvelope<EquipmentCreateData>
    | EquipmentCreateData;
  async function createEquipments(payload: EquipmentCreatePayload): Promise<EquipmentCreateWire> {
    const path =
      `${base.replace(/\/+$/, '')}/facilities/${encodeURIComponent(formData.value.facilityID ?? '')}/equipments`;

    return await apiPost<EquipmentCreateWire>(path, payload);
  }

  const confirmOpen = ref<boolean>(false)
  function openConfirm(): void {
    if (loading.value) return

    const facilityOk = !!(formData.value.facilityID && formData.value.facilityID.trim())
    const ecoOk      = !!(formData.value.ecoCompanyID && formData.value.ecoCompanyID.trim())
    if (!facilityOk || !ecoOk) {
      error.value = t('message.error')
      return
    }
    confirmOpen.value = true
  }
  async function onConfirm(): Promise<void> {
    clearMessages();
    confirmOpen.value = false;

    try {
      gl.show();
      loading.value = true;

      const payload: EquipmentCreatePayload = {
        facilityID: formData.value.facilityID ?? '',
      };

      const wire = await createEquipments(payload);

      const dto = unwrapToDomain<EquipmentCreateData>(wire);

      const d = dto?.devices;

      if (d && d.deviceNumber != null) {
        ensureDevices();
        const deviceIdPref  = deviceIdPrefix();
        const productIdPref = productIdPrefix();

        const deviceNumber = String(d.deviceNumber);
        const existing = formData.value.devices!.find(
          x => String(x.deviceNumber) === deviceNumber
        );
        
        const serverUpdatedAt = (typeof d.updatedAt === 'string') ? d.updatedAt : undefined;
        const resolvedUpdatedAt = serverUpdatedAt ?? existing?.updatedAt ?? '';

        const newRow: PayloadDevice = {
          deviceNumber,
          deviceID: deviceIdPref,
          productID: productIdPref,
          updatedAt: resolvedUpdatedAt,
          solarPanels: [],
          pcs: [],
        };

        if (existing) {
          existing.deviceID  = newRow.deviceID;
          existing.productID = newRow.productID;
          existing.updatedAt = resolvedUpdatedAt;
          if (!Array.isArray(existing.solarPanels)) existing.solarPanels = [];
          if (!Array.isArray(existing.pcs))         existing.pcs         = [];
        } else {
          formData.value.devices!.push(newRow);
        }

        clearAllServerErrors?.();
        return;
      }

    } catch (e: unknown) {
      const he = toHttpError(e);
      statusCode.value = he.statusCode;

      if (he.statusCode === 500) {
        router.push({ name: 'common-error', query: { returnTo: route.fullPath } });
        return;
      }

      applyErrorsToPage(
        (he.data as unknown) ?? { code: '', errors: [] },
        {
          topList: equipmentCreateErrorList,
          fieldMap: serverErrors,
          reset: true,
        }
      );

      const hasNoPageErrors =
        equipmentCreateErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0;

      if (hasNoPageErrors) {
        const message = toNetworkMessage(e, t('error.E0038'));
        equipmentCreateErrorList.value = [message];
      }

      error.value = '';
    } finally {
      loading.value = false;
      gl.hide();
    }
  }
  // ---- 汎用チェックボックス無効化ロジック ----
  function shouldDisableCheckbox(
    opts: {
      idx: number
      total: number
      isChecked: boolean
      selectedCount: number
      disableWhenSingle: boolean
      maxSelectable?: number
    }
  ): boolean {
    const { total, isChecked, selectedCount, disableWhenSingle, maxSelectable } = opts
    if (disableWhenSingle && total === 1) return true
    if (typeof maxSelectable === 'number' && selectedCount >= maxSelectable && !isChecked) {
      return true
    }
    return false
  }

  /** パネル用（最大 selectable = total - 1） */
  function shouldDisablePanelCheckboxForRow(
    idx: number,
    total: number,
    deviceNumber: string,
    panelNumber: string
  ): boolean {
    const selectedSet = selectedPanels.value[deviceNumber] ?? new Set<string>()
    const isChecked = selectedSet.has(panelNumber)
    const selectedCount = selectedSet.size

    const maxSelectable = Math.max(0, total - 1)

    return shouldDisableCheckbox({
      idx,
      total,
      isChecked,
      selectedCount,
      disableWhenSingle: true, 
      maxSelectable,
    })
  }

  /** PCS 用（最大 selectable = total - 1） */
  function shouldDisablePcsCheckboxForRow(
    idx: number,
    total: number,
    deviceNumber: string,
    pcsNumber: string
  ): boolean {
    const selectedSet = selectedPcs.value[deviceNumber] ?? new Set<string>()
    const isChecked = selectedSet.has(pcsNumber)
    const selectedCount = selectedSet.size

    const maxSelectable = Math.max(0, total - 1)

    return shouldDisableCheckbox({
      idx,
      total,
      isChecked,
      selectedCount,
      disableWhenSingle: true, 
      maxSelectable,
    })
  }

  // ---- 設備の一括削除 ----
  type BulkDeleteResponse = {
    statusCode?: number | string
    deviceNumber?: number[]
    data?: { deviceNumber?: number[] } | null
    errors?: Array<{ message?: string }> | null
    code?: string | number
  }
  const bulkDeleteConfirmOpen = ref<boolean>(false)
  const deletingNow           = ref<boolean>(false)
  const tableLoadingLocal     = ref<boolean>(false)

  function extractDeviceNumbersFrom(res: BulkDeleteResponse | null, fallback: number[]): number[] {
    if (!res) return fallback
    const fromData = res.data?.deviceNumber
    if (Array.isArray(fromData)) return fromData.map(n => Number(n)).filter(Number.isFinite)
    const top = res.deviceNumber
    if (Array.isArray(top)) return top.map(n => Number(n)).filter(Number.isFinite)
    return fallback
  }
  function openBulkDeleteConfirm(): void {
    const total = deviceRows.value.length;
    const sel   = selectedDeviceNumbers.value.size;
    if (sel === 0 || sel >= total) return;
    bulkDeleteConfirmOpen.value = true;
  }

  async function onConfirmBulkDelete(): Promise<void> {
    try {
      deletingNow.value = true;
      await onClickBulkDelete();
      bulkDeleteConfirmOpen.value = false;
    } finally {
      deletingNow.value = false;
    }
  }

  type BulkDeleteDomain = BulkDeleteResponse & { statusCode?: number | string };

  type BulkDeleteWire =
    | ProxyEnvelope<BodyEnvelope<BulkDeleteDomain> | BulkDeleteDomain>
    | BodyEnvelope<BulkDeleteDomain>
    | BulkDeleteDomain;
  async function onClickBulkDelete(): Promise<void> {
    const facilityID = String(formData.value.facilityID ?? '').trim();
    const numbers = Array.from(selectedDeviceNumbers.value)
      .map(n => Number(n))
      .filter(Number.isFinite);

    if (!facilityID || numbers.length === 0) return;

    tableLoadingLocal.value = true;

    clearMessages()

    try {
      const bodyWire = await apiPost<BulkDeleteWire>(
        `${base.replace(/\/+$/, '')}/facilities/${encodeURIComponent(facilityID)}/equipments/bulk-delete`,
        { deviceNumber: numbers }
      );
      const body = unwrapToDomain<BulkDeleteDomain>(bodyWire);

      const confirmed = extractDeviceNumbersFrom(body, numbers).map(String);
      const toDelete = new Set(confirmed);

      formData.value.devices = (formData.value.devices ?? []).filter(
        d => !toDelete.has(String(d.deviceNumber))
      );

      selectedDeviceNumbers.value.clear();

      clearAllServerErrors?.();

    } catch (e: unknown) {
      const he = toHttpError(e);
      statusCode.value = he.statusCode;

      if (he.statusCode === 500) {
        router.push({ name: 'common-error', query: { returnTo: route.fullPath } });
        return;
      }

      applyErrorsToPage(
        (he.data as unknown) ?? { code: '', errors: [] },
        {
          topList: deviceDeleteErrorList,
          fieldMap: serverErrors,
          reset: true,
        }
      );

      const hasNoPageErrors =
        deviceDeleteErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0

      if (hasNoPageErrors) {
        const message = toNetworkMessage(e, t('error.E0038'))
        deviceDeleteErrorList.value = [message]
      }

      error.value = '';

    } finally {
      tableLoadingLocal.value = false;
    }
  }
  
  // ---- Device ID 更新 ----
  type UpdateDeviceIdDTO = {
    deviceNumber?: string | number | null
    updatedAt?: string | null
  }

  // ---- Device ID 更新 ----
  type UpdateDeviceIdResponse = {
    statusCode?: number | string;
    code?: string | number;
    data?: UpdateDeviceIdDTO | null;
    errors?: Array<{ message?: string | null; code?: string | number; field?: string | null }> | null;
  };

  // ===== UpdateDeviceIdResponse 用ワイヤ型 =====
  type UpdateDeviceIdDomain = UpdateDeviceIdResponse;
  type UpdateDeviceIdWire =
    | ProxyEnvelope<BodyEnvelope<UpdateDeviceIdDomain> | UpdateDeviceIdDomain>
    | BodyEnvelope<UpdateDeviceIdDomain>
    | UpdateDeviceIdDomain;
  type ConflictErrorWire = {
    status_code?: number;
    code?: string;              
    data?: {
      deviceNumber?: string;      
      updatedAt?: string;         
    };
    errors?: Array<{
      field?: string;
      code?: string;
      message?: string;
    }>;
  };

  // ---- Device ID 更新 ----
  async function onClickUpdateDeviceId(
    r: { deviceNumber: string; deviceID: string }
  ): Promise<void> {
    clearMessages()
    if (!canProceedUpdate(r.deviceNumber)) {
      return;
    }
    const deviceNumber = String(r.deviceNumber);

    const row = formData.value.devices?.find(
      (d) => String(d.deviceNumber) === deviceNumber
    );

    const existingFullId = String(row?.deviceID ?? '');
    const { prefix: existingPrefix } = splitOnDashKeepDashOrDefault(
      existingFullId,
      '' 
    );

    const inputValue = String(r.deviceID ?? '');
    const { suffix } = splitOnDashKeepDashOrDefault(inputValue, existingPrefix);
    const trimmed = suffix.trim();

    try {
      setUpdating(deviceNumber, true);
      gl?.show();
      loading.value = true;

      const wire = await apiPut<UpdateDeviceIdWire>(
        `${base.replace(/\/+$/, '')}/devices/${encodeURIComponent(deviceNumber)}`,
        {
          deviceID: trimmed,
          updatedAt: String(row?.updatedAt ?? '')
        }
      );

      const dto = unwrapToDomain<UpdateDeviceIdDTO>(wire);

      if (dto && dto.deviceNumber != null) {
        const serverUpdatedAt =
          typeof dto.updatedAt === 'string' ? dto.updatedAt : undefined;

        const newFullId = existingPrefix
          ? recombineWithDash(existingPrefix, trimmed)
          : trimmed;

        if (row) {
          row.deviceID = newFullId;
          if (serverUpdatedAt) {
            row.updatedAt = serverUpdatedAt;
          }
        }
        
        const successMsg = toSuccessMessage(wire);
        if (successMsg) {
          pushTableSuccess(successMsg);
        }
        clearRowErrors();
        clearAllServerErrors?.();
        return;
      }

      clearAllServerErrors?.();
    } catch (e: unknown) {
      const he = toHttpError(e);
      statusCode.value = he.statusCode;

      if (he.statusCode === 500) {
        router.push({ name: 'common-error', query: { returnTo: route.fullPath } });
        return;
      }

      applyErrorsToPage(
        (he.data as unknown) ?? { code: '', errors: [] },
        {
          topList: deviceIDErrorList,
          fieldMap: serverErrors,
          reset: true,
        }
      );

      if (he.statusCode === 409) {
          const payload = (he.data ?? {}) as ConflictErrorWire;

          // Prefer the server-reported deviceNumber, fall back to current
          const conflictDeviceNumber = String(
            payload?.data?.deviceNumber ?? deviceNumber
          );

          const serverUpdatedAt = payload?.data?.updatedAt;
          if (serverUpdatedAt) {
            // Update only the row's updatedAt so next submit uses the latest version
            const target =
              formData.value.devices?.find(
                (d) => String(d.deviceNumber) === conflictDeviceNumber
              );
            if (target) {
              target.updatedAt = serverUpdatedAt;
            }
          }
      }
      const hasNoPageErrors =
        deviceIDErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0;

      if (hasNoPageErrors) {
        const message = toNetworkMessage(e, t('error.E0038'));
        deviceIDErrorList.value = [message];
      }

      error.value = '';
    } finally {
      setUpdating(deviceNumber, false);
      loading.value = false;
      gl?.hide();
    }
  }

  // ---- Product 付帯情報の更新 ----
  type ProductExtrasDTO = {
    deviceNumber?: string | number | null
    panelNumber?: string | number | null   // NEW: scalar or null
    pcsNumber?: string | number | null     // NEW: scalar or null
    updatedAt?: string| null
  }
  type ProductExtrasResponse = {
    statusCode?: number | string
    code?: string | number
    data?: ProductExtrasDTO | null
    errors?: Array<{ message?: string | null }> | null
  }
    
  // ===== ProductExtrasResponse 用ワイヤ型 =====
  type ProductExtrasDomain = ProductExtrasResponse;
  type ProductExtrasWire =
    | ProxyEnvelope<BodyEnvelope<ProductExtrasDomain> | ProductExtrasDomain>
    | BodyEnvelope<ProductExtrasDomain>
    | ProductExtrasDomain;
  async function onClickUpdateProductExtras(
    r: { deviceNumber: string; productID: string },
    gl?: GlobalLoadingService
  ): Promise<void> {
    clearMessages()
    if (!canProceedUpdate(r.deviceNumber)) {
      return;
    }
    const deviceNumber = String(r.deviceNumber)

    const list = formData.value.devices
    const row = list?.find(d => String(d.deviceNumber) === deviceNumber)

    const existingFullPid = String(row?.productID ?? '')
    const { prefix: existingProductPrefix } = splitOnDashKeepDashOrDefault(
      existingFullPid,
      '' 
    )

    const inputValue = String(r.productID ?? '')
    const { suffix } = splitOnDashKeepDashOrDefault(inputValue, existingProductPrefix)
    const trimmed = suffix.trim()

    try {
      setUpdating(deviceNumber, true)
      gl?.show()
      loading.value = true

      const wire = await apiPut<ProductExtrasWire>(
        `${base.replace(/\/+$/, '')}/products/${encodeURIComponent(deviceNumber)}`,
        { productID: trimmed,
          updatedAt: String(row?.updatedAt??'')
         }
      )
      
      const dto = unwrapToDomain<ProductExtrasDTO>(wire)

      if (row) {
        const newFullProductId = existingProductPrefix
          ? recombineWithDash(existingProductPrefix, trimmed)
          : trimmed
        row.productID = newFullProductId
        if (typeof dto?.updatedAt === 'string') {
          row.updatedAt = dto.updatedAt
        }
      }

      if (!row || !dto) {
        clearAllServerErrors?.()
        return
      }

      const pn = dto.panelNumber != null ? String(dto.panelNumber).trim() : ''
      const un = dto.pcsNumber    != null ? String(dto.pcsNumber).trim()    : ''

      const hasPn = pn.length > 0
      const hasUn = un.length > 0

      if (hasPn && hasUn) {
        if (!Array.isArray(row.solarPanels)) row.solarPanels = []
        if (!Array.isArray(row.pcs))         row.pcs         = []

        const existingPanelSet = new Set(row.solarPanels.map(p => String(p.panelNumber)))
        if (!existingPanelSet.has(pn)) {
          row.solarPanels.push({ panelNumber: pn })
        }

        const existingPcsSet = new Set(row.pcs.map(u => String(u.pcsNumber)))
        if (!existingPcsSet.has(un)) {
          row.pcs.push({ pcsNumber: un })
        }

        showForDeviceNumber.value = String(dto.deviceNumber ?? deviceNumber)

        selectedPanels.value[deviceNumber] = new Set()
        selectedPcs.value[deviceNumber]    = new Set()
      } else {
        showForDeviceNumber.value = null
      }

      const successMsg = toSuccessMessage(wire);
      if (successMsg) {
        pushTableSuccess(successMsg);
      }
        clearRowErrors();

      clearAllServerErrors?.()
    } catch (e: unknown) {
      const he = toHttpError(e)
      statusCode.value = he.statusCode

      if (he.statusCode === 500) {
        router.push({ name: 'common-error', query: { returnTo: route.fullPath } })
        return
      }

    if (he.statusCode === 409) {
      const payload = (he.data ?? {}) as ConflictErrorWire

      const conflictDeviceNumber = String(payload?.data?.deviceNumber ?? deviceNumber)

      const serverUpdatedAt = payload?.data?.updatedAt
        if (serverUpdatedAt) {
          const target = formData.value.devices?.find(
            d => String(d.deviceNumber) === conflictDeviceNumber
          )
          if (target) {
            target.updatedAt = serverUpdatedAt
          }
        }
      }
      applyErrorsToPage(
        (he.data as unknown) ?? { code: '', errors: [] },
        {
          topList: productIDErrorList,
          fieldMap: serverErrors,
          reset: true,
        }
      )

      const hasNoPageErrors =
        productIDErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0

      if (hasNoPageErrors) {
        const message = toNetworkMessage(e, t('error.E0038'))
        productIDErrorList.value = [message]
      }

      error.value = ''
    } finally {
      setUpdating(deviceNumber, false)
      loading.value = false
      gl?.hide()
    }
  }

  // ---- 接頭辞の一括書き換え ----
  function rewriteAllDeviceIdPrefixes(newPrefix: string): void {
    const list = formData.value.devices
    if (!list) return
    for (const d of list) {
      const { suffix } = splitOnDashKeepDashOrDefault(String(d.deviceID ?? ''), newPrefix)
      d.deviceID = recombineWithDash(newPrefix, suffix)
    }
  }
  function rewriteAllProductIdPrefixes(newPrefix: string): void {
    const list = formData.value.devices
    if (!list) return
    for (const d of list) {
      const { suffix } = splitOnDashKeepDashOrDefault(String(d.productID ?? ''), newPrefix)
      d.productID = recombineWithDash(newPrefix, suffix)
    }
  }

  // バンドル間でも動作する堅牢な型ガード
  type HttpErrorLike = { statusCode: number; message: string; data?: unknown; name?: string }
  function toHttpError(e: unknown): HttpErrorLike {
    if (e && typeof e === 'object') {
      const m = e as { statusCode?: unknown; message?: unknown; data?: unknown }
      if (typeof m.statusCode === 'number' && typeof m.message === 'string') {
        return { statusCode: m.statusCode, message: m.message, data: m.data }
      }
    }
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return { statusCode: 0, message: msg, data: undefined }
  }

  /** ネットワークエラー時の表示文言を整形（既知の汎用文言は置換） */
  function toNetworkMessage(e: unknown, fallback: string): string {
    const he = toHttpError(e)
    const msg = (he.message ?? '').trim()

    const looksLikeNetwork =
      typeof he.statusCode !== 'number' ||
      he.statusCode === 0 ||
      he.statusCode === 503 ||
      he.statusCode === 504

    const isGenericBrowserMsg =
      /^failed to fetch$/i.test(msg) ||
      /network\s*error/i.test(msg) ||
      /load failed/i.test(msg)

    if (looksLikeNetwork || isGenericBrowserMsg || msg.length === 0) {
      return fallback
    }
    return msg
  }

  // ===== FacilityEditPostResult 用ワイヤ型 =====
  type FacilityEditDomain = FacilityEditPostResult;
  type FacilityEditWire =
    | ProxyEnvelope<BodyEnvelope<FacilityEditDomain> | FacilityEditDomain>
    | BodyEnvelope<FacilityEditDomain>
    | FacilityEditDomain;

  // ---- フォーム送信（施設編集） ----
  async function onSubmit(
    validateFn?: () => Promise<{ valid: boolean } | boolean>
  ): Promise<void> {
    msg.value = '';
    error.value = '';
    clearAllServerErrors();
    clearTableSuccess();
    if (validateFn) {
      const vr = await validateFn();
      const isValid = typeof vr === 'boolean' ? vr : (vr?.valid === true);
      if (!isValid) {
        await nextTick();
        try {
          const el = (formRef.value)?.$el?.querySelector?.(
            '.v-input--error input, .v-input--error textarea, .v-input--error .v-field__input'
          );
          el?.focus?.();
        } catch {}
        return;
      }
    }

    gl.show();
    loading.value = true;

    try {

      if (typeof pending.value.ecoCompanyID === 'string') {
        formData.value.ecoCompanyID = pending.value.ecoCompanyID.trim()
      }
      if (typeof pending.value.ecoCompanyPassword === 'string') {
        formData.value.ecoCompanyPassword = pending.value.ecoCompanyPassword
      }

      const id = String(formData.value.facilityID ?? '').trim();
      if (!id) {
        error.value = t('error.E0001', { field: t('facility.facilityID') });
        return;
      }

      const payload = mapEditToApi(formData.value as EditPayload);
      const wire = await apiPut<FacilityEditWire>(
        `${base.replace(/\/+$/, '')}/facilities/${encodeURIComponent(id)}`,
        payload
      );
      const body = unwrapToDomain<FacilityEditDomain>(wire);

      const httpStatus = toHttpStatus((body as { statusCode?: unknown })?.statusCode) ?? 200;
      statusCode.value = httpStatus;

      const newDevicePrefix  = buildIdPrefixFrom(formData.value.facilityID);
      const newProductPrefix = buildIdPrefixFrom(formData.value.ecoCompanyID);

      rewriteAllDeviceIdPrefixes(newDevicePrefix);
      rewriteAllProductIdPrefixes(newProductPrefix);

      pending.value = {}

      clearAllServerErrors();
      router.push(`/`)
    } catch (e: unknown) {
      const he = toHttpError(e);
      statusCode.value = he.statusCode;

      if (he.statusCode === 500) {
        router.push({ name: 'common-error', query: { returnTo: route.fullPath } });
        return;
      }

      applyErrorsToPage(
        (he.data as unknown) ?? { code: '', errors: [] },
        {
          topList: topErrorList,
          fieldMap: serverErrors,
          reset: true,
        }
      );

      const hasNoPageErrors =
        topErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0

      if (hasNoPageErrors) {
        const message = toNetworkMessage(e, t('error.E0038'))
        topErrorList.value = [message]
      }
      error.value = '';
    } finally {
      loading.value = false;
      gl.hide();
    }
  }


  // ---- リセット／キャンセル ----
  const suppressCategoryWatch = ref(false)
  async function resetForm() {
    msg.value = ''
    error.value = ''
    clearAllServerErrors()
    suppressCategoryWatch.value = true
      loading.value = true
    try {
      formData.value = deepClone(initialData.value)
      await loadFacilityById(formData.value.facilityID)
    } finally {
      loading.value = false
      suppressCategoryWatch.value = false
    }
  }

  async function onCancel() {
    clearAllServerErrors()
    await resetForm()
    await nextTick()
    formRef.value?.resetValidation()
  }

  const allowPrefixRewrite = ref(false);


  watch(() => formData.value.facilityID, (nv) => {
    if (!allowPrefixRewrite.value) return;
    rewriteAllDeviceIdPrefixes(buildIdPrefixFrom(nv));
  });
  watch(() => formData.value.ecoCompanyID, (nv) => {
    if (!allowPrefixRewrite.value) return;
    rewriteAllProductIdPrefixes(buildIdPrefixFrom(nv));
  });
  watch(() => route.params.facilityID, (nv) => {
    const id = Array.isArray(nv) ? nv[0] : nv
    if (typeof id === 'string' && id.trim()) {
      if (id.trim() !== (formData.value.facilityID)) {
        loadFacilityById(id.trim())
      }
    }
  }, { immediate: true })
  
  // 施設 GET のワイヤ型（Proxy → BodyEnvelope → Domain のいずれも許容）
  type FacilityGetWire =
    | ProxyEnvelope<BodyEnvelope<EditPayload> | EditPayload>
    | BodyEnvelope<EditPayload>
    | EditPayload;

  async function loadFacilityById(facilityId: string): Promise<void> {
    clearMessages();
    gl.show()
    loading.value = true
    try {
       const raw = await apiGet<FacilityGetWire>(
        `${base.replace(/\/+$/, '')}/facilities/${encodeURIComponent(facilityId)}`
      );
      const data = unwrapToDomain<EditPayload>(raw);

      const rawImage = (data as Partial<EditPayload> & { facilityImage?: unknown }).facilityImage;

      if (isFacilityImageError(rawImage)) {
        const msg = t(`error.${rawImage.errorCode}`, [ t('facility.imageFilename') ]);
        topErrorList.value.push(msg);
      }
      
      hydrateCategoryItemsFromPayload(data)
      hydrateStatusItemsFromPayload(data)

      const normalizedImage = coerceFacilityImage(rawImage);

      const next: EditPayload = {
        facilityTypeSelected: String(data.facilityTypeSelected ?? ''),
        facilityID: String(data.facilityID ?? ''),
        ecoCompanyID: String(data.ecoCompanyID ?? ''),
        ecoCompanyPassword: String(data.ecoCompanyPassword ?? ''),
        facilityName: String(data.facilityName ?? ''),
        facilityAddress: String(data.facilityAddress ?? ''),
        cityInformation: String(data.cityInformation ?? ''),
        facilityImage: normalizedImage, 
        facilityStatusSelected: String(data.facilityStatusSelected ?? ''),
        facilityManagerName: String(data.facilityManagerName ?? ''),
        facilityManagerContact: String(data.facilityManagerContact ?? ''),
        updatedAt: String(data.updatedAt ?? ''),
        devices: Array.isArray(data.devices)
        ? data.devices.map(d => ({
            deviceNumber: String(d.deviceNumber ?? ''),
            deviceID: String(d.deviceID ?? ''),
            productID: String(d.productID ?? ''),
            updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : '', 
            solarPanels: Array.isArray(d.solarPanels)
              ? d.solarPanels.map(sp => ({ panelNumber: String(sp.panelNumber) }))
              : [],
            pcs: Array.isArray(d.pcs)
              ? d.pcs.map(u => ({ pcsNumber: String(u.pcsNumber) }))
              : [],
          }))
        : [],
        facilityType: isMap(data.facilityType) ? data.facilityType : undefined,
        facilityStatus: isMap(data.facilityStatus) ? data.facilityStatus : undefined,
      };

      formData.value = deepClone(next);
      initialData.value = deepClone(next);

    } catch (e: unknown) {
      type MaybeStatus = { statusCode?: unknown }
      type MaybeResp   = { response?: { statusCode?: unknown; data?: { statusCode?: unknown } } }
      type MaybeData   = { data?: { statusCode?: unknown } }
      type MaybeBody   = { body?: { statusCode?: unknown } }
      const eo = e as MaybeStatus & MaybeResp & MaybeData & MaybeBody

      const httpStatus: number | null =
        toHttpStatus(eo?.statusCode) ??
        toHttpStatus(eo?.response?.statusCode) ??
        toHttpStatus(eo?.response?.data?.statusCode) ??
        toHttpStatus(eo?.data?.statusCode) ??
        toHttpStatus(eo?.body?.statusCode) ??
        null

      if (httpStatus === 500) {
        router.push({ name: 'common-error', query: { returnTo: route.fullPath } })
        return
      }

      router.push({ path: '/' })

      const hasNoPageErrors =
        topErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0
      if (hasNoPageErrors) {
        const message = toNetworkMessage(e, t('error.E0038'))
        topErrorList.value = [message]
      }
      error.value = ''
    } finally {
      suppressCategoryWatch.value = false
      loading.value = false
      gl.hide()
    }
  }

  onMounted(async () => {
    formData.value.facilityTypeSelected  = String(formData.value.facilityTypeSelected)
    formData.value.facilityStatusSelected = String(formData.value.facilityStatusSelected)

    await nextTick()
    if (registerFlagFromQuery.value) {
      confirmOpen.value = true
    }
  })

  /** パネル作成（成功時: 素の { deviceNumber: number } を受け取る） */
  // async function createSolarPanel(deviceNumber: string): Promise<{ deviceNumber: number; statusCode?: number | string }> {
  //   const path = `${base.replace(/\/+$/, '')}/facilities/${encodeURIComponent(deviceNumber)}/solar-panels`
  //   return await apiPost<{ deviceNumber: number; statusCode?: number | string }>(path, {})
  // }


  // /** 行内で 1件以上選択がある場合のみ、パネル削除ボタンを有効にする */
  // function canDeleteSelectedPanelsForRow(deviceNumber: string): boolean {
  //   const set = selectedPanels.value[deviceNumber]
  //   return !!set && set.size > 0
  // }

  // // パネル一括削除 API レスポンス型（UI 用）
  // type PanelsBulkDeleteResponse = {
  //   statusCode?: number | string;
  //   code?: string | number;
  //   panelNo?: number[];
  //   errors?: Array<{ message?: string }>;
  // };
  // /** パネル即時一括削除 */
  // async function onClickPanelsBulkDelete(deviceNumber: string): Promise<void> {
  //   const set = selectedPanels.value[deviceNumber] ?? new Set<string>();
  //   const numbers = Array.from(set).map(n => Number(n)).filter(Number.isFinite);

  //   if (numbers.length === 0) return;

  //   gl.show();
  //   loading.value = true;

  //   try {
  //     setUpdating(deviceNumber, true);

  //     const bodyRaw = await apiPost<BulkDeleteWire>(
  //       `${base.replace(/\/+$/, '')}/solar-panels/bulk-delete`,
  //       { panelNumbers: numbers }
  //     );
  //     const body = unwrapToDomain<PanelsBulkDeleteResponse & { statusCode?: number | string }>(bodyRaw);

  //     const httpStatus = toHttpStatus((body as { statusCode?: unknown })?.statusCode) ?? 200;
  //     statusCode.value = httpStatus;

  //     const confirmed = (Array.isArray(body.panelNo) ? body.panelNo : numbers)
  //       .map(n => String(n));
  //     const toDelete = new Set(confirmed);

  //     const row = formData.value.devices?.find(
  //       d => String(d.deviceNumber) === String(deviceNumber)
  //     );
  //     if (row && Array.isArray(row.solarPanels)) {
  //       row.solarPanels = row.solarPanels.filter(
  //         p => !toDelete.has(String(p.panelNumber))
  //       );
  //     }
  //     selectedPanels.value[deviceNumber] = new Set();

  //     clearAllServerErrors?.();

  //   } catch (e: unknown) {
  //     const he = toHttpError(e);
  //     statusCode.value = he.statusCode;

  //     if (he.statusCode === 500) {
  //       router.push({ name: 'common-error', query: { returnTo: route.fullPath } });
  //       return;
  //     }
  //     applyErrorsToPage(
  //       (he.data as unknown) ?? { code: '', errors: [] },
  //       {
  //         topList: panelsBulkDeleteErrorList,
  //         fieldMap: serverErrors,
  //         reset: true,
  //       }
  //     );

  //     const hasNoPageErrors =
  //       panelsBulkDeleteErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0

  //     if (hasNoPageErrors) {
  //       const message = toNetworkMessage(e, t('error.E0038'))
  //       panelsBulkDeleteErrorList.value = [message]
  //     }

  //     error.value = ''
  //   } finally {
  //     setUpdating(deviceNumber, false);
  //     loading.value = false;
  //     gl.hide();
  //   }
  // }

  // 追加: PCS init の data 形（body.data の中身だけ）
  // type PcsInitData = { pcs: Array<{ pcsNumber: string }> };

  // // Lambda Proxy / BodyEnvelope / Domain を許容するワイヤ型
  // type PcsInitWire =
  //   | ProxyEnvelope<BodyEnvelope<PcsInitData> | PcsInitData>
  //   | BodyEnvelope<PcsInitData>
  //   | PcsInitData;
  // /**
  //  * 新規 PCS 番号を 1 件払い出す
  //  * @param deviceNumber デバイス番号（r.deviceNumber をそのまま渡す）
  //  */
  // async function getPcsInit(deviceNumber: string): Promise<PcsInitWire> {
  //   const path = `${base.replace(/\/+$/, '')}/facilities/${encodeURIComponent(deviceNumber)}/pcs`;
  //   // 200 / PcsInitWire を返す想定
  //   const res = await apiPost<PcsInitWire>(path);
  //   return res;
  // }
  // /** 行内で 1件以上選択がある場合のみ、PCS 削除ボタンを有効にする */
  // function canDeleteSelectedPcsForRow(deviceNumber: string): boolean {
  //   const set = selectedPcs.value[deviceNumber];
  //   return !!set && set.size > 0;
  // }

  // // PCS 一括削除 API レスポンス型（UI 用）
  // type PcsBulkDeleteResponse = {
  //   statusCode?: number | string;   // 文字列/数値の双方を許可（toHttpStatusで正規化）
  //   code?: string | number;
  //   pcsNo?: number[];
  //   errors?: Array<{ message?: string }>;
  // };

  // // 既存：status は呼び出し側で正規化
  // async function postPcsBulkDelete(pcsNumbers: number[]): Promise<PcsBulkDeleteResponse> {
  //   const path = `${base.replace(/\/+$/, '')}/pcs/bulk-delete`;     
  //   const raw = await apiPost<BulkDeleteWire>(path, { pcsNumbers });
  //   return unwrapToDomain<PcsBulkDeleteResponse>(raw) ?? {};
  // }

  // /** PCS 即時一括削除（GL 対応 & ステータス分岐） */
  // async function onClickPcsBulkDelete(deviceNumber: string, gl?: GlobalLoadingService): Promise<void> {
  //   const set = selectedPcs.value[deviceNumber] ?? new Set<string>();
  //   const numbers = Array.from(set).map(n => Number(n)).filter(Number.isFinite);

  //   if (numbers.length === 0) return;

  //   gl?.show();
  //   loading.value = true;

  //   try {
  //     setUpdating(deviceNumber, true);

  //     const body = await postPcsBulkDelete(numbers);

  //     const httpStatus = toHttpStatus((body as { statusCode?: unknown })?.statusCode) ?? 200;
  //     statusCode.value = httpStatus;

  //     const serverPcsNo = (body as PcsBulkDeleteResponse).pcsNo;
  //     const confirmedNumbers: number[] = Array.isArray(serverPcsNo) ? serverPcsNo : numbers;

  //     const toDelete = new Set(confirmedNumbers.map(n => String(n)));

  //     const row = formData.value.devices?.find(
  //       d => String(d.deviceNumber) === String(deviceNumber)
  //     );
  //     if (row && Array.isArray(row.pcs)) {
  //       row.pcs = row.pcs.filter(u => !toDelete.has(String(u.pcsNumber)));
  //     }

  //     // 選択をクリア
  //     selectedPcs.value[deviceNumber] = new Set();

  //     clearAllServerErrors?.();

  //   } catch (e: unknown) {
  //     const he = toHttpError(e);
  //     statusCode.value = he.statusCode;

  //     if (he.statusCode === 500) {
  //       router.push({ name: 'common-error', query: { returnTo: route.fullPath } });
  //       return;
  //     }

  //     applyErrorsToPage(
  //       (he.data as unknown) ?? { code: '', errors: [] },
  //       {
  //         topList: pcsBulkDeleteErrorList,
  //         fieldMap: serverErrors,
  //         reset: true,
  //       }
  //     );

  //     const hasNoPageErrors =
  //       pcsBulkDeleteErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0

  //     if (hasNoPageErrors) {
  //       const message = toNetworkMessage(e, t('error.E0038'))
  //       pcsBulkDeleteErrorList.value = [message]
  //     }

  //     error.value = ''
  //   } finally {
  //     setUpdating(deviceNumber, false);
  //     gl?.hide();
  //     loading.value = false;
  //   }
  // }

  // ---- Submit/cancel などの公開メソッド／状態を返却 ----
  return {
    // state
    formData, initialData, msg, error, dialogError, dialog, loading, statusCode,
    images, loadingImages,
    CategoryItems, StatusItems,
    loadingCategory, loadingStatus,
    serverErrors, topErrorList,equipmentCreateErrorList,deviceIDErrorList,productIDErrorList,deviceDeleteErrorList,
    // addPanelErrorList,addPcsErrorList,
    // panelsBulkDeleteErrorList,pcsBulkDeleteErrorList,
    pageBgStyle, pageBgUrl, selectedImageUrl,
    columns, deviceRows,
    selectedDeviceNumbers, selectedPanels, selectedPcs,
    canDeleteSelectedDevices, disableRowCheckbox,
    onToggleRow, onTogglePanel, onTogglePcs,
    confirmOpen, openConfirm, onConfirm,
    bulkDeleteConfirmOpen, openBulkDeleteConfirm, onConfirmBulkDelete,
    tableLoadingLocal, deletingNow,pending,
    shouldDisablePanelCheckboxForRow, shouldDisablePcsCheckboxForRow,
    // canDeleteSelectedPanelsForRow,
    // onClickPanelsBulkDelete,
    // canDeleteSelectedPcsForRow,
    // onClickPcsBulkDelete,
    resolveUrl,loadFacilityById,
    rules, clearServerError, clearAllServerErrors,
    onSubmit, resetForm,clearFacilityImage,
    deviceIdPrefixGlobal, productIdPrefixGlobal,
    splitOnDashKeepDashOrDefault, onDeviceIdSuffixInput, onProductIdSuffixInput,
    /*addPanel, addPcs, removePanel, removePcs,*/ removeDevice,formRef,
    onClickUpdateDeviceId, onClickUpdateProductExtras,
    gateCols4to7,
    rowErrors, isUpdating, setRowError,setRowFieldError, onCancel,
    suppressCategoryWatch,
    isValidPositiveInt,
    invalidDeviceNumberMessage,
    showCols4to7ForDevice,splitProductIdSuffixWithFrozenPrefix,findDangerousToken,dangerMessage,
    shouldShowColsForRow,tableSuccessList,clearTableSuccess,inlineRowErrorList,clearRowErrors,canProceedUpdate
  }
}
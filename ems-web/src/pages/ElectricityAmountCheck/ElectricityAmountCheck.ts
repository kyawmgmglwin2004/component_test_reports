import { ref, onMounted,computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { apiGet } from '@/services/http'
import { applyErrorsToPage } from '../Common/error/errorResolver';
import { useGlobalLoading } from '@/pages/Common/composables/GlobalLoading'
import { useNotFoundScreenProps } from '@/pages/Common/composables/NotFoundScreen'

type facilityImage = {
  relativePath: string
  displayName: string
  presignedUrl: string
}

/**
 * ECheck:
 * エネルギー可視化ダッシュボードで扱う1施設分の計測/集計データの型定義
 */
export interface ECheck {
  facilityName: string
  cityInfo: string
  measuredTime: string
  totalGeneration: number
  currentGeneration: number
  currentSelfUsage: number
  currentUsage: number
  todayTotalGeneration: number
  todayTotalSelfUsage: number
  todayTotalUsage: number
  facilityImage: facilityImage
}
/**
 * API から返るペイロードの型（ECheck と同一構造）
 */
export type ApiPayload = ECheck

/**
 * 画面上で扱う情報の型（ECheck と同一構造）
 */
export type EcheckInfoData = {
  facilityID: string
  facilityName: string
  cityInfo: string
  measuredTime: string
  totalGeneration: number
  currentGeneration: number
  currentSelfUsage: number
  currentUsage: number
  todayTotalGeneration: number
  todayTotalSelfUsage: number
  todayTotalUsage: number
  facilityImage: string
}
  export type HttpErrorLike = { statusCode: number; message: string; data?: unknown; name?: string }
  export function toHttpError(e: unknown): e is HttpErrorLike {
  if (typeof e !== 'object' || e === null) return false
  return 'statusCode' in e && typeof (e as { statusCode?: unknown }).statusCode === 'number'
}
function isFacilityImageError(v: unknown): v is { errorCode: string } {
  return (
    !!v &&
    typeof v === 'object' &&
    'errorCode' in (v as Record<string, unknown>) &&
    typeof (v as Record<string, unknown>).errorCode === 'string'
  );
}
/**
 * エネルギーチェック（ダッシュボード）用の Composition 関数
 * - ルーティングから facilityID を取得して API 叩き
 * - 結果を画面用データにマッピング
 * - エラー処理（ページ上エラー/サーバーエラー/ネットワーク）
 * - 背景画像スタイルの計算
 * - 詳細チャート画面への遷移
 */
export function useEcheckDashboard() {
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const { openWith } = useNotFoundScreenProps()
  const echeck = ref<ECheck | null>(null)
  const loading = ref(false)
  const clickLoading = ref(false)
  const gl = useGlobalLoading()
  const error = ref<string | null>(null) 
  const topErrorList = ref<string[]>([])
  const serverErrors = ref<Record<string, string[]>>({})
  /**
   * 特定フィールドのサーバーエラーをクリア
   */
 function clearServerError(field: string): void {
    if (serverErrors.value[field]) {
      const rest = { ...serverErrors.value }
      delete rest[field]
      serverErrors.value = rest
    }
  }

  /**
   * サーバーエラーを全消去（ページ上のエラーもクリア）
   */
  function clearAllServerErrors(): void {
    serverErrors.value = {}
    topErrorList.value = []
  }

  /**
   * APIの値を画面用モデルにマッピング
   * - 数値系は Number() で変換し、null/undefined に強い
   * - 文字列は空文字でフォールバック
   */
function apiToForm(p: ApiPayload): ECheck {
  return {
    facilityName: p.facilityName,
    cityInfo: p.cityInfo,
    measuredTime: p.measuredTime,
    totalGeneration: Number(p.totalGeneration),
    currentGeneration: Number(p.currentGeneration),
    currentSelfUsage: Number(p.currentSelfUsage),
    currentUsage: Number(p.currentUsage),
    todayTotalGeneration: Number(p.todayTotalGeneration),
    todayTotalSelfUsage: Number(p.todayTotalSelfUsage),
    todayTotalUsage: Number(p.todayTotalUsage),
    facilityImage: p.facilityImage
  }
}
const nf3 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
})

function fmt3(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return t('eamountcheck.noData')
  return nf3.format(value) 
}
/** API Gateway 風のレスポンス */
type ApiGatewayEnvelope <T> = {
  statusCode: number | string
  headers?: Record<string, string>
  body: string | T 
}

/** バックエンドの body 内構造 */
type BodyEnvelope<T> = {
    code?: string;
    data?: T;
    meta?: Record<string, string> | undefined;
    errors?: Array<{ field?: string; code?: string; message?: string }>;
  };
function unwrapToDomain<T>(
  raw: ApiGatewayEnvelope<BodyEnvelope<T> | T> | BodyEnvelope<T> | T
): T {
  if (raw && typeof raw === 'object' && ('statusCode' in raw || 'body' in raw)) {
    const env = raw as ApiGatewayEnvelope<BodyEnvelope<T> | T>;
    const b = env.body;

    let candidate: unknown = b;
    if (typeof b === 'string') {
      try {
        candidate = JSON.parse(b);
      } catch {
        candidate = {};
      }
    }

    if (candidate && typeof candidate === 'object' && 'data' in (candidate)) {
      candidate = (candidate as BodyEnvelope<T>).data as T;
    }

    if (candidate && typeof candidate === 'object' && 'item' in (candidate)) {
      return (candidate).item as T;
    }
    return candidate as T;
  }

  if (raw && typeof raw === 'object' && 'data' in (raw )) {
    const candidate = (raw as BodyEnvelope<T>).data ;
    if (candidate && typeof candidate === 'object' && 'item' in candidate) {
      return candidate.item as T;
    }
    return candidate as T;
  }

  if (raw && typeof raw === 'object' && 'item' in (raw)) {
    return (raw ).item as T;
  }

  return raw as T;
}
type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  !!v && typeof v === 'object';
 function extractBackendCode(raw: unknown): string | undefined {
  if (!isRecord(raw)) return undefined;

  const c = raw.code;
  if (typeof c === 'string' && c.trim() !== '') {
    return c.trim();
  }

  if (isRecord(raw.data) && typeof (raw.data).code === 'string') {
    return (raw.data).code.trim();
  }

  return undefined;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

const facilityIdRegex = /^F[A-Z0-9]{5}$/;

const routeFacilityId = computed(() => String(route.params.facilityID ?? ''));

const isValidFacilityId = computed(() => facilityIdRegex.test(routeFacilityId.value));
  /**
   * ルートパラメータ（facilityID）を使ってデータ読込
   * - facilityID バリデーション（存在チェック、形式チェック）
   * - API 取得と結果のマッピング
   * - ステータスコード別の遷移（500/404）
   * - サーバーエラーのページ適用
   * - ネットワーク/不明エラーの整理
   * - ローディング表示の制御
   */

function safeJsonParse(s: string): unknown {
  try { return JSON.parse(s) } catch { return {} }
}
  async function loadByRouteId() {
    const facilityID = String(route.params.facilityID)
    clearAllServerErrors();
    loading.value = true
    gl.show()

    try {
      const base = import.meta.env.VITE_API_BASE_URL
      const url =`${(base).replace(/\/+$/, '')}/facilities/${encodeURIComponent(facilityID)}/energy/dashboard`
      const raw = await apiGet<ApiGatewayEnvelope<BodyEnvelope<ApiPayload>>>(url, { headers: { Authorization: 'Bearer mock-token' } })

      const envelopeLike: unknown =
        raw && typeof raw === 'object' && 'body' in (raw as Record<string, unknown>)
          ? (typeof (raw).body === 'string' ? safeJsonParse((raw ).body) : (raw).body)
          : raw;

      if (isRecord(envelopeLike) && isRecord(envelopeLike.data)) {
        const dataObj = envelopeLike.data;

        const innerCode = isNonEmptyString(dataObj.code) ? dataObj.code : undefined


        let fieldKeyAndParams: string | undefined;

        if (isNonEmptyString(dataObj.field)) {
          const rawField = String(dataObj.field);
          const statusLabel = rawField.trim(); 
          fieldKeyAndParams = `${statusLabel}`;
        }

        if (innerCode) {
          const syntheticRaw = {
            errors: [{ code: innerCode, field: fieldKeyAndParams }],
          };
          applyErrorsToPage(syntheticRaw, {
            topList: topErrorList,
            fieldMap: serverErrors,
            reset: false,
          });
        }
      }
      const body = unwrapToDomain<ApiPayload>(raw);

      const rawImage = (body)?.facilityImage;
      if (isFacilityImageError(rawImage)) {
        const msg = t(`error.${rawImage.errorCode}`, [ t('facility.imageFilename') ]);
        topErrorList.value.push(msg);
        }

      echeck.value = apiToForm(body);
    
    } catch (e: unknown) {  
      if(toHttpError(e)){
                if (e.statusCode === 500) {
        router.push({ name: 'common-error-visual', query: { code:String(e.statusCode ?? 500) } });
        return;
      }

    if (e.statusCode === 404) {
        const errCode = extractBackendCode(e.data) 
        openWith(404, { errorCode: errCode })
        return
      }

        
    if (e.statusCode === 504) {
       openWith(504)
        return; 
    }
    const raw = e.data; 
    applyErrorsToPage(raw, { topList: topErrorList,
      fieldMap: serverErrors,
      reset: true,
    });
    const msg = (e.message).trim()
    const looksLikeNetwork =
      typeof e.statusCode !== 'number' ||
      e.statusCode === 0 || e.statusCode === 503

    const isGenericBrowserMsg =
      /^failed to fetch$/i.test(msg) ||
      /network\s*error/i.test(msg) ||
      /load failed/i.test(msg)
    const hasNoPageErrors = topErrorList.value.length === 0 && Object.keys(serverErrors.value).length === 0
    if((looksLikeNetwork || isGenericBrowserMsg || msg.length === 0 || hasNoPageErrors)){
    const status = (typeof e?.statusCode === 'number' && e.statusCode > 0)
      ? e.statusCode
      : undefined

    openWith(status)

    }
      }

      error.value = ''
    } finally {
      loading.value = false
      gl.hide()
    }
  }
  /**
   * 背景画像のスタイルオブジェクトを返す
   * - 絶対URL(http/https)であればそのまま
   * - それ以外は /images/ 配下を参照
   * - 画像なしの場合は背景なし
   */
  type BgInput = facilityImage | string | null | undefined;
function bgStyle(input?: BgInput) {
  const url =
    typeof input === 'string'
      ? (input.startsWith('http') ? input : `/images/${input}`)
      : input?.presignedUrl || undefined;
    return {
      backgroundImage: url ? `url("${url}")` : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      width: '100%',
      minHeight: '100%',
    } as const
  }
  /**
   * 「詳細チャート」画面へ遷移
   * - facilityID を URL パスに含めて /facilities/:id/energy へ
   * - クリック中のローディングを表示（グローバルローディングも併用）
   */
  function goToDetailChart() {
    gl.show()
    clickLoading.value = true;
    try{
    const facilityID = String(route.params.facilityID)
    router.push(`/facilities/${encodeURIComponent(facilityID)}/energy`)
    }finally{
      gl.hide()
      clickLoading.value = false
    }
  }
   /**
   * マウント時に初期ロード実行
   */
onMounted(async () => {loadByRouteId()})

  return {
    t,
    echeck,
    loading,
    clickLoading,
    topErrorList,
    serverErrors,
    clearServerError,
    clearAllServerErrors,
    loadByRouteId,
    bgStyle,
    goToDetailChart,
    error,
    isValidFacilityId,toHttpError,fmt3
  }
}
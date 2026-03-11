
import axios from 'axios';
import { http, HttpResponse } from 'msw';
// import { i18n } from '../../i18n';

// ---------------------------------------------
// Types
// ---------------------------------------------

export type facilityType = '自治体' | '家庭';

export interface FacilityImageDTO {
  /** Relative URL under public/ or absolute URL (choose one of url/image) */
  url?: string;
  /** Base64 (no prefix) or "data:*" URI */
  image?: string;
  /** Display label for the grid */
  name: string;
}
// ---------------------------------------------
// FacilityImage ワイヤ型（サーバーから { errorCode } のみの形も来る場合がある）
// ---------------------------------------------

export type FacilityImageProblem = { errorCode: string };
export type FacilityImageWire = FacilityImage | FacilityImageProblem;

/** 文字列かどうかを判定 */
function isString(v: unknown): v is string {
  return typeof v === 'string';
}

/** UI 用 FacilityImage 型かどうか */
function isFacilityImage(v: unknown): v is FacilityImage {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  // 3つの主要プロパティのいずれかが string なら FacilityImage とみなす
  return (
    isString(o['relativePath']) ||
    isString(o['presignedUrl']) ||
    isString(o['displayName'])
  );
}


export type FacilityImage = {
  relativePath: string;   // e.g. "/facility/category2/family5.webp"
  displayName: string;    // e.g. "家庭5"
  presignedUrl: string;   // full or absolute URL for <v-img :src>
};

export interface SolarPanel {
  panelNumber: string;
}

export interface PCS  {
  pcsNumber: string;
}

export interface Device {
  deviceNumber: string;
  deviceID: string;
  productID: string;
  updatedAt: string;
  solarPanels?: SolarPanel[];
  pcs?: PCS[];
}
const base=import.meta.env.VITE_API_BASE_URL;
const getRandomDeviceNumber = () => Math.floor(Math.random() * 1000) + 1;
type BulkDeleteRequest = {
  deviceNumber?: Array<number | string>
}
// --- Error codes aligned to your rules ---
type ErrorCode =
  | 'E0001'
  | 'E0002'
  | 'E0008';

interface ApiErrorItem {
  field: string
  code: ErrorCode
  meta?: { max?: number }
  message?: string
}

function requireAuth(req: Request) {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return respondAsLambda(
      {
        code: 'UNAUTHORIZED',
        errors: [{ field: 'authorization', code: '401', message: 'Unauthorized' }],
        meta: makeMeta(),
      },
      { status: 401 }
    );
  }
  return null;
}

// const facilityTypeItems = [0,1];
// const facilityStatus = [0,1,2];

export const placeholder = new URL('../../assets/images/placeholder.png', import.meta.url).href;
type CodeLabelMap = Record<string, string>;
export type EditPayload = {
  facilityTypeSelected: string;
  facilityID?: string;
  ecoCompanyID: string;
  ecoCompanyPassword: string;
  facilityName: string;
  facilityAddress: string;
  cityInformation: string;
  facilityImage: FacilityImageWire; // nested
  facilityStatusSelected: string;
  facilityManagerName: string;
  facilityManagerContact: string;
  updatedAt: string; // ISO8601 timestamp for concurrency control (optional but useful)
  facilityType:CodeLabelMap;
  facilityStatus:CodeLabelMap;
  devices?: Device[];
};

export type ApiPayload = {
  facilityType: string;
  facilityID?: string;
  ecoCompanyID: string;
  ecoCompanyPassword: string;
  facilityName: string;
  facilityAddress: string;
  cityInformation: string;
  imageFilename: string; // flatten relativePath → backend
  facilityStatus: string;
  facilityManagerName: string;
  facilityManagerContact: string;
  updatedAt?: string; // optional for API payload, but can be used for concurrency control
  devices?: Device[];
};

export interface FacilityInfo {
  facilityType: string;
  facilityID?: string;
  ecoCompanyID?: string;
  ecoCompanyPassword?: string;
  facilityName: string;
  facilityAddress: string;
  cityInformation: string;
  // facilityImage: FacilityImage; // keep full object for client echo
  imageFilename: string;
  facilityStatus: string;
  facilityManagerName: string;
  facilityManagerContact: string;
  updatedAt: string; // ISO8601 timestamp for concurrency control
  devices?: Device[];
}

type EquipmentCreatePayload = {
  facilityID: string;     // from formData.facilityID
};

export type NewDeviceNumber = {
  deviceNumber: string; // server returns only this
  updatedAt: string;
};

// type EquipmentCreateBody = {
//   status: string; // '201'
//   code: string;   // 'EQUIPMENT_CREATE_SUCCESS'
//   data: {
//     devices?: NewDeviceNumber;
//   };
//   meta: {
//     requestId: string;
//     serverTime: string;
//   };
// };

export type ProductExtrasData = {
  deviceNumber: string
  solarPanels: { panelNumber: string }[]
  pcs: { pcsNumber: string }[]
}

export type ProductExtrasWire = {
  status: number
  code: string
  data?: ProductExtrasData
  errors?: ApiErrorItem[]
  meta?: { requestId: string; serverTime: string }
}
// ---------------------------------------------
// Demo data + normalizer
// ---------------------------------------------

const demoData: Record<facilityType, FacilityImageDTO[]> = {
  自治体: [
    { url: '/facility/category1/OIP.webp', name: '自治体1' },
    { url: '/facility/category1/OIP2.webp', name: '自治体2' },
    { url: '/facility/category1/OIP3.webp', name: '自治体3' },
  ],
  家庭: [
    { url: '/facility/category2/family1.webp', name: '家庭1' },
    { url: '/facility/category2/family2.webp', name: '家庭2' },
    { url: '/facility/category2/family3.webp', name: '家庭3' },
    { url: '/facility/category2/family4.webp', name: '家庭4' },
    { url: '/facility/category2/family5.webp', name: '家庭5' },
    { url: '/facility/category2/family6.webp', name: '家庭6' },
    { url: '/facility/category2/family7.webp', name: '家庭7' },
    { url: '/facility/category2/family8.webp', name: '家庭8' },
    { url: '/facility/category2/family9.webp', name: '家庭9' },
    { url: '/facility/category2/family10.webp', name: '家庭10' },
  ],
};

function absoluteUrl(u?: string): string {
  const baseUrl = import.meta.env?.BASE_URL ?? '/';
  if (!u) return placeholder;
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u;
  return `${baseUrl.replace(/\/$/, '')}${u.startsWith('/') ? '' : '/'}${u}`;
}

function normalizeDto(dto: FacilityImageDTO): FacilityImage {
  let relativePath = '';
  let presignedUrl = placeholder;

  if (dto.url) {
    relativePath = dto.url;          // raw path to send as imageFilename
    presignedUrl = absoluteUrl(dto.url); // absolute for <v-img>
  } else if (dto.image) {
    presignedUrl = dto.image.startsWith('data:')
      ? dto.image
      : `data:image/webp;base64,${dto.image}`;
  }

  return {
    relativePath,
    displayName: dto.name,
    presignedUrl,
  };
}

export async function getDemoFacilityImages(category: facilityType): Promise<FacilityImage[]> {
  await new Promise((r) => setTimeout(r, 150));
  return demoData[category].map(normalizeDto);
}

// ---------------------------------------------
// Defaults + factory
// ---------------------------------------------
const facilityTypeMap: CodeLabelMap = {
  '0': '自治体',
  '1': '家庭',
};

const facilityStatusMap: CodeLabelMap = {
  '0': '非運用',
  '1': '運用中',
  '2': 'メンテナンス',
};


// type ListItem = { code: string; label: string }

// const facilityTypeEnum: ListItem[] = facilityTypeList.map(c => ({ code: c.code, label: c.label }));
// const facilityStatusEnum: ListItem[] = facilityStatusList.map(s => ({ code: s.code, label: s.label }));

// const defaultfacilityType = facilityTypeList[1]?.code ?? '';
// const defaultFacilityStatus = facilityStatusList[2]?.code ?? '';

// function randomRequestId() {
//   // Short, readable requestId for mock/testing
//   return 'req-' + Math.random().toString(16).slice(2, 12)
// }

// Validate with your rules (server-side replica of your client rules)
// Validate with your rules (server-side replica of your client rules)
function validateFacility(
  apiPayload: ApiPayload,
  incomingImage?: Partial<EditPayload>['facilityImage']
): ApiErrorItem[] {
  const errors: ApiErrorItem[] = []

  const isBlank = (v: unknown) =>
    v === undefined ||
    v === null ||
    (typeof v === 'string' && v.trim().length === 0)

  const maxLen = (v: unknown, max: number) =>
    typeof v !== 'string' || v.trim().length <= max

  const emailLike = (v: unknown) => {
    const value = (v ?? '').toString().trim()
    return /^[^\s@]+@[^\s@]+$/.test(value)
  }

  // 画像パスの解決（API の imageFilename を優先、無ければ facilityImage.relativePath を使用）
  let imageRelativePath = ''
  if (!isBlank(apiPayload.imageFilename)) {
    imageRelativePath = String(apiPayload.imageFilename)
  } else if (isFacilityImage(incomingImage)) {
    imageRelativePath = String(incomingImage.relativePath)
  }

  // 1) facilityID: required + max 6
  if (isBlank(apiPayload.facilityID)) {
    errors.push({ field: 'facilityID', code: 'E0001' })
  } else if (!maxLen(apiPayload.facilityID, 6)) {
    errors.push({ field: 'facilityID', code: 'E0002', meta: { max: 6 } })
  }

  // 2) ecoCompanyID: required + max 8
  if (isBlank(apiPayload.ecoCompanyID)) {
    errors.push({ field: 'ecoCompanyID', code: 'E0001' })
  } else if (!maxLen(apiPayload.ecoCompanyID, 8)) { 
    errors.push({
      field: toCsvField('ecoCompanyID', { max: 8}),
      code: 'E0002'
    });
  }

  // 3) ecoCompanyPassword: required + max 16
  if (isBlank(apiPayload.ecoCompanyPassword)) {
    errors.push({ field: 'ecoCompanyPassword', code: 'E0001' })
  } else if (!maxLen(apiPayload.ecoCompanyPassword, 16)) {
    errors.push({
      field: toCsvField('ecoCompanyPassword', { max: 16 }),
      code: 'E0002'
    });
  }

  // 4) facilityName: required + max 30
  if (isBlank(apiPayload.facilityName)) {
    errors.push({ field: 'facilityName', code: 'E0001' })
  } else if (!maxLen(apiPayload.facilityName, 30)) {
    errors.push({
      field: toCsvField('facilityName', { max: 30 }),
      code: 'E0002'
    });
  }

  // 5) facilityAddress: required + max 40
  if (isBlank(apiPayload.facilityAddress)) {
    errors.push({ field: 'facilityAddress', code: 'E0001' })
  } else if (!maxLen(apiPayload.facilityAddress, 40)) {
    errors.push({ field: 'facilityAddress', code: 'E0002', meta: { max: 40 } })
  }

  // 6) cityInformation: required + max 50
  if (isBlank(apiPayload.cityInformation)) {
    errors.push({ field: 'cityInformation', code: 'E0001' })
  } else if (!maxLen(apiPayload.cityInformation, 50)) {
    errors.push({
      field: toCsvField('cityInformation', { max: 50 }),
      code: 'E0002'
    });
  }

  // 7) imageFilename rule（nested relativePath の存在）
  if (isBlank(imageRelativePath)) {
    errors.push({ field: 'imageFilename', code: 'E0001' })
  }

  // 8) managerName: max 20 (optional)
  if (!isBlank(apiPayload.facilityManagerName) && !maxLen(apiPayload.facilityManagerName, 20)) {
    errors.push({ field: toCsvField('facilityManagerName', { max: 20 }), code: 'E0002' })
  }

  // 9) managerContact: max 254 + email-like (optional)
  if (!isBlank(apiPayload.facilityManagerContact)) {
    if (!maxLen(apiPayload.facilityManagerContact, 254)) {
      errors.push({ field: toCsvField('facilityManagerContact', { max: 254 }), code: 'E0002' })
    } else if (!emailLike(apiPayload.facilityManagerContact)) {
      errors.push({ field: 'facilityManagerContact', code: 'E0008' })
    }
  }

  return errors
}

export const defaultEditPayload: EditPayload = {
  facilityTypeSelected: '1',
  facilityID: 'HSP912',
  ecoCompanyID: 'ecouser1',
  ecoCompanyPassword: 'securepassword12',
  facilityName: 'Yangon General Hospital',
  facilityAddress: 'Lanmadaw',
  cityInformation: 'Yangon',
  facilityImage: {
    relativePath: '/facility/category2/family6.webp',
    displayName: '家庭6',
    presignedUrl: '/facility/category2/family6.webp',
    // errorCode:'E0036'
  },
  facilityStatusSelected: '2',
  facilityManagerName: 'Dr. Aye Chan',
  facilityManagerContact: 'AyeAye@gmail.com',
  updatedAt: new Date().toISOString(),
  facilityType: facilityTypeMap,
  facilityStatus: facilityStatusMap,
  devices: [
    {
      deviceNumber: '1',
      deviceID: 'asdfD001',
      productID: 'asdfP001',
      updatedAt: new Date().toISOString(),
      solarPanels: [
        { panelNumber: '1' },
        { panelNumber: '2' },
        { panelNumber: '3' }
      ],
      pcs: [
        { pcsNumber: '1' },
        { pcsNumber: '2' },
        { pcsNumber: '3' }
      ]
    },
    {
      deviceNumber: '2',
      //  deviceID: 'HSP912-',
      //  productID: 'ecouser1-'
      deviceID: 'asdfD002',
      productID: 'asdfP002',
      updatedAt: new Date().toISOString(),
      solarPanels: [
        { panelNumber: '4' }
      ],
      pcs: [
        // { pcsNumber: '4' },
        { pcsNumber: '5' }
      ]
    },
    {
      deviceNumber: '3',
      //  deviceID: 'HSP912-',
      //  productID: 'ecouser1-'
      deviceID: 'HSP912-',
      productID: 'ecouser2-',
      updatedAt: new Date().toISOString(),
    }
  ]
};

export function createDefaultEditPayload(overrides: Partial<EditPayload> = {}): EditPayload {
  return { ...defaultEditPayload, ...overrides };
}
// ---------------------------------------------
// Mappers
// ---------------------------------------------

export function mapToApiPayload(p: EditPayload): ApiPayload {
  // facilityImage は FacilityImage | { errorCode } のユニオン → 型ガードで相互運用
  const imageFilename = isFacilityImage(p.facilityImage)
    ? p.facilityImage.relativePath
    : '';

  return {
    facilityType: p.facilityTypeSelected,
    facilityID: p.facilityID,
    ecoCompanyID: p.ecoCompanyID,
    ecoCompanyPassword: p.ecoCompanyPassword,
    facilityName: p.facilityName,
    facilityAddress: p.facilityAddress,
    cityInformation: p.cityInformation,
    imageFilename,
    facilityStatus: p.facilityStatusSelected,
    facilityManagerName: p.facilityManagerName,
    facilityManagerContact: p.facilityManagerContact,
    updatedAt: p.updatedAt,
    // devices: p.devices,
  };
}
// ---------------------------------------------
// Axios helper
// ---------------------------------------------

export async function apiPost<T>(
  url: string,
  payload?: unknown,
): Promise<T & { status: number }> {
  const res = await axios.post(url, payload, { validateStatus: () => true })
  // 👇 Merge HTTP status into the response object
  return { ...(res.data as T), status: res.status }
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await axios.get(url, { validateStatus: () => true })
  return res.data as T
}

// type CategoryResponse = {
//   categoryItems: { title: number; value: number }[];
// };

// type StatusResponse = {
//   statusItems: { title: number; value: number }[];
// };

// Put this near the top of your handlers file (or in a shared utils file)
async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as unknown as T
  } catch {
    return null
  }
}

function toCsvField(field: string, meta?: { max?: number; min?: number }): string {
  if (!meta) return field;
  const params: string[] = [];

  if (meta.min != null) params.push(String(meta.min));
  if (meta.max != null) params.push(String(meta.max));

  return params.length ? `${field},${params.join(',')}` : field;
}


// ------------------------------------------------------------
// ソーラーパネル一括削除 API の型定義
// エンドポイント: POST /solar-panels/bulk-delete
// リクエストボディ: { panelNumbers: number[] } を基本とする
// ------------------------------------------------------------

/** 一括削除のリクエスト（JSON を基本とする） */
interface PanelsBulkDeleteRequest {
  // 本実装では JSON の panelNumbers[] を使用（x-www-form-urlencoded も許容可）
  panelNumbers: number[];
}

/** 一括削除の成功レスポンス */
// interface PanelsBulkDeleteResponse {
//   status: 200;
//   code: 'SOLAR_PANELS_BULK_DELETE_SUCCESS';
//   /** サーバーが最終的に削除したパネル番号の確定値 */
//   // panelNo: number[];
//   meta: {
//     requestId: string;
//     serverTime: string; // ISO8601
//   };
// }

// /** バリデーションなどのエラーレスポンス */
// interface PanelsBulkDeleteError {
//   status: 400;
//   code: 'SOLAR_PANELS_BULK_DELETE_VALIDATION_FAILED';
//   errors: Array<{ field: string; code: string; message?: string }>;
//   meta: {
//     requestId: string;
//     serverTime: string;
//   };
// }


// PCS 初期化（新規 PCS 番号払い出し）用の型定義
// - エンドポイント: GET /facilities/:id/pcs
// - :id は deviceNumber（施設IDではない）
// - レスポンスは新規 pcsNumber を返す
// ------------------------------------------------------------

export type IdLike = string | number;

/** サーバが払い出した新規 PCS 番号を表す */
export interface NewPCSNumber {
  // 例: { pcsNumber: "11" }
  pcsNumber: string;
}

/** data ラッパ */
export interface PCSInitData {
  pcs: NewPCSNumber[];
}

/** メタ情報（監査・時刻など） */
export interface ApiMeta {
  requestId: string;
  serverTime: string; // ISO8601
}

/** 成功時ボディ（GET 想定のため 200） */
export interface PCSInitBody {
  status: '201';
  code: 'PCS_INIT_SUCCESS';
  data: PCSInitData;
  meta: ApiMeta;
}

/** バリデーション失敗などのエラーボディ */
export interface PCSInitErrorBody {
  status: '400';
  code: 'PCS_INIT_VALIDATION_FAILED';
  errors: ApiErrorItem[];
  meta: ApiMeta;
}

// ------------------------------------------------------------
// 共通ユーティリティ
// ------------------------------------------------------------

/** 汎用: 可能な限り配列の数値へ正規化する */
function normalizeToNumberArray(input: Array<number | string>): number[] {
  return Array.from(
    new Set(
      input.map(n => Number(n)).filter(n => Number.isFinite(n))
    )
  ).sort((a, b) => a - b);
}


// ------------------------------------------------------------
// PCS 一括削除 API の型定義
// エンドポイント: POST /pcs/bulk-delete
// リクエストボディ: { pcsNumbers: number[] } を基本とする
// ------------------------------------------------------------

/** 一括削除のリクエスト（JSON を基本とする） */
interface PcsBulkDeleteRequest {
  // 本実装では JSON の pcsNumbers[] を使用（x-www-form-urlencoded も許容可）
  pcsNumbers: number[];
}

/** 一括削除の成功レスポンス */
// interface PcsBulkDeleteResponse {
//   status: 200;
//   code: 'PCS_BULK_DELETE_SUCCESS';
//   /** サーバーが最終的に削除した PCS 番号の確定値 */
//   // pcsNo: number[];
//   meta: {
//     requestId: string;
//     serverTime: string; // ISO8601
//   };
// }

// /** バリデーションなどのエラーレスポンス */
// interface PcsBulkDeleteError {
//   status: 400;
//   code: 'PCS_BULK_DELETE_VALIDATION_FAILED';
//   errors: Array<{ field: string; code: string; message?: string }>;
//   meta: {
//     requestId: string;
//     serverTime: string;
//   };
// }

const defaultJsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

// メタ情報（監査用）
function makeMeta() {
  return {
    requestId: 'req-' + Math.random().toString(16).slice(2, 12),
    serverTime: new Date().toISOString(),
  };
}
function respondJson(
  payload: unknown,
  init?: { status?: number; headers?: HeadersInit }
) {
  const status = init?.status ?? 200;
  const headers: HeadersInit = { ...defaultJsonHeaders, ...(init?.headers ?? {}) };

  // NOTE: We return a raw JSON string to match your devtools "body: '...string'" view.
  return new HttpResponse(JSON.stringify(payload), {
    status,
    headers,
  });
}

/**
 * Return an MSW HttpResponse with:
 *  - JSON-stringified body (mimics Lambda proxy integration)
 *  - dynamic status code
 *  - JSON + CORS headers by default (mergeable)
 */
function respondAsLambda(
  payload: unknown,
  init?: { status?: number; headers?: HeadersInit }
) {
  const statusCode = init?.status ?? 200;
  const headers: HeadersInit = {
    ...defaultJsonHeaders,
    ...(init?.headers ?? {}),
  };

  // business payload must be inside stringified "body"
  const lambdaProxyEnvelope = {
    statusCode,
    headers,
    body: JSON.stringify(payload), // <-- DO NOT wrap another proxy envelope
  };

  // Actual HTTP response should use same status as lambdaProxyEnvelope
  return new HttpResponse(JSON.stringify(lambdaProxyEnvelope), {
    status: statusCode,
    headers,
  });
}



// ---------------------------------------------
// MSW handler (✔ fixed facilityImage typing)
// ---------------------------------------------
// export const handlers = [...facilityEditHandlers, ...addEquiptmentHandlers];
export const facilityEditHandlers = [
  // ======================================================
  // GET /facilities/:id
  // ======================================================
  http.get(`${base}/facilities/:id`, async ({ params, request }) => {
    const unauth = requireAuth(request);
    if (unauth) return unauth;

    const { id } = params as { id?: string };
    const facilityID = String(id ?? "").trim();

    // 画像抽出失敗のテスト用フラグ（?imgError=1 または ID に IMGERR を含むとき）
    const url = new URL(request.url);
    const imgErrorFlag =
      (url.searchParams.get('imgError') ?? '').trim() === '1' ||
      /IMGERR/i.test(facilityID);

    // 既定のペイロードをクローン
    const payload: EditPayload = JSON.parse(JSON.stringify(defaultEditPayload));
    if (facilityID) payload.facilityID = facilityID;

    // 画像抽出のエラーをモック（facilityImage を errorCode のみで返す）
    if (imgErrorFlag) {
      // EditPayload の facilityImage は UI 側で整形されることを前提に、
      // ワイヤ型（FacilityImageWire）で上書きする
      payload.facilityImage = { errorCode: 'E0036' };
    }

    await new Promise(r => setTimeout(r, 120));

    return respondJson(
      { code: "MSG0007", data: payload, meta: makeMeta() },
      { status: 200 }
    );
  }),

  // ======================================================
  // GET /facilities/photos
  // ======================================================
  http.get(`${base}/facilities/photos`, async ({ request }) => {
    const unauth = requireAuth(request);
    if (unauth) return unauth;

    const url = new URL(request.url);
    const code = (url.searchParams.get("facilityType") ?? "").trim();
    const cat: facilityType = code === "1" ? "家庭" : "自治体";
    const items: FacilityImage[] = (demoData[cat] ?? []).map(normalizeDto);

    await new Promise(r => setTimeout(r, 120));

    return respondJson(
      { code: "PHOTOS_SUCCESS", data: items, meta: makeMeta() },
      { status: 200 }
    );
  }),

  // ======================================================
  // PUT /facilities/:id
  // ======================================================
  http.put(`${base}/facilities/:id`, async ({ params, request }) => {
    const unauth = requireAuth(request);
    if (unauth) return unauth;

    const { id } = params as { id?: string };

    if (!id || String(id).trim().length === 0) {
      return respondJson(
        {
          code: "FACILITY_NOT_FOUND",
          errors: [
            { field: "facilityID", code: "E0001", message: "facility not found" },
          ],
          meta: makeMeta(),
        },
        { status: 404 }
      );
    }

    const raw = await request.json();
    const bodyAsRecord = raw as Record<string, unknown>;
    const incomingImage = (raw as Partial<EditPayload>)?.facilityImage;

    const apiPayload: ApiPayload =
      "imageFilename" in bodyAsRecord
        ? (raw as ApiPayload)
        : mapToApiPayload(raw as EditPayload);

    // Simulated 500 case
    if (apiPayload.facilityName === "trigger500") {
      return respondJson(
        {
          code: "FACILITY_UPDATE_FAILED",
          errors: [
            {
              field: "facilityName",
              code: "E9999",
              message: "server error (simulated)",
            },
          ],
          meta: makeMeta(),
        },
        { status: 500 }
      );
    }

    if (id === "404") {
      return respondJson(
        {
          code: "FACILITY_NOT_FOUND",
          errors: [
            { field: "facilityID", code: "E0001", message: "facility not found" },
          ],
          meta: makeMeta(),
        },
        { status: 404 }
      );
    }

    const img: FacilityImage = isFacilityImage(incomingImage)
  ? {
      relativePath: apiPayload.imageFilename || incomingImage.relativePath || '',
      displayName: incomingImage.displayName,
      presignedUrl: incomingImage.presignedUrl || absoluteUrl(apiPayload.imageFilename),
    }
  : {
      relativePath: apiPayload.imageFilename,
      displayName: '',
      presignedUrl: absoluteUrl(apiPayload.imageFilename),
    };

    const errors = validateFacility(apiPayload, incomingImage);
    if (errors.length > 0) {
      return respondJson(
        { code: "FACILITY_UPDATE_VALIDATION_FAILED", errors, meta: makeMeta() },
        { status: 400 }
      );
    }

    const facility: FacilityInfo = {
      facilityType: apiPayload.facilityType,
      facilityID: apiPayload.facilityID ?? id,
      ecoCompanyID: apiPayload.ecoCompanyID ?? "",
      ecoCompanyPassword: apiPayload.ecoCompanyPassword ?? "",
      facilityName: apiPayload.facilityName,
      facilityAddress: apiPayload.facilityAddress,
      cityInformation: apiPayload.cityInformation,
      imageFilename: img.relativePath,
      facilityStatus: apiPayload.facilityStatus,
      facilityManagerName: apiPayload.facilityManagerName,
      facilityManagerContact: apiPayload.facilityManagerContact,
      updatedAt: apiPayload.updatedAt ?? "",
    };

    return respondJson(
      { code: "MSG0007", data: facility, meta: makeMeta() },
      { status: 200 }
    );
  }),

  // ======================================================
  // POST /facilities/:facilityID/equipments
  // ======================================================
  http.post(`${base}/facilities/:facilityID/equipments`, async ({ params, request }) => {
    const unauth = requireAuth(request);
    if (unauth) return unauth;

    const { facilityID: pathFacilityID } = params as { facilityID: string };
    const raw = (await request.json()) as Partial<EquipmentCreatePayload>;

    const bodyFacilityID = String(raw.facilityID ?? "").trim();
    const facilityID = String(pathFacilityID || bodyFacilityID).trim();

    const errors: Array<{ field: string; code: string }> = [];
    if (!facilityID) errors.push({ field: "facilityID", code: "E0001" });

    if (errors.length > 0) {
      return respondJson(
        {
          code: "EQUIPMENT_CREATE_VALIDATION_FAILED",
          errors,
          meta: makeMeta(),
        },
        { status: 400 }
      );
    }

    const newDevice: NewDeviceNumber = {
      deviceNumber: String(getRandomDeviceNumber()),
      updatedAt: new Date().toISOString()
    };

    return respondJson(
      { code: "EQUIPMENT_CREATE_SUCCESS", data: { devices: newDevice }, meta: makeMeta() },
      { status: 201 }
    );
  }),

  // ======================================================
  // PUT /devices/:deviceNumber
  // ======================================================
  http.put(`${base}/devices/:deviceNumber`, async ({ params, request }) => {
    const unauth = requireAuth(request);
    if (unauth) return unauth;

    const { deviceNumber: pathDeviceNumber } = params as { deviceNumber?: unknown };
    const body = (await request.json()) as {
      deviceID?: unknown;
      updatedAt?: unknown; // must be provided by client
    };

    const deviceNumberRaw = params?.deviceNumber ?? pathDeviceNumber;
    const deviceIdRaw     = body?.deviceID;
    const updatedAtRaw    = body?.updatedAt;

    const errors: Array<{ field: string; code: string; message?: string }> = [];

    // deviceNumber required, string, non-empty
    if (typeof deviceNumberRaw !== "string" || !deviceNumberRaw.trim()) {
      errors.push({ field: "deviceNumber", code: "E0001" });
    }

    // deviceID required, alnum 1-11
    if (typeof deviceIdRaw !== "string") {
      errors.push({ field: "deviceID", code: "E0001" });
    } else {
      const deviceID = deviceIdRaw.trim();
      if (!deviceID) {
        errors.push({ field: "deviceID", code: "E0001" });
      } else if (!/^[A-Za-z0-9]{1,11}$/.test(deviceID)) {
        errors.push({ field: "deviceID,11", code: "E0003" });
      }
    }

    // updatedAt required (string, non-empty). You can add stricter ISO8601 checks if needed.
    if (typeof updatedAtRaw !== "string" || !updatedAtRaw.trim()) {
      errors.push({ field: "updatedAt", code: "E0001" });
    }

    if (errors.length) {
      return respondJson(
        {
          code: "DEVICE_ID_UPDATE_VALIDATION_FAILED",
          errors,
          meta: makeMeta(),
        },
        { status: 400 }
      );
    }

    const deviceNumber = String(deviceNumberRaw).trim();

    // Use server time as the canonical updatedAt returned to client
    const meta = makeMeta();
    const updatedAt = meta.serverTime;

    return respondJson(
      {
        code: "MSG0016",
        data: { deviceNumber, updatedAt }, // ← respond only these two fields
        meta,
      },
      { status: 200 }
    );
  }),

  // ======================================================
  // PUT /products/:deviceNumber
  // ======================================================
  http.put(`${base}/products/:deviceNumber`, async ({ params, request }) => {
    const unauth = requireAuth(request);
    if (unauth) return unauth;

    const { deviceNumber: pathDeviceNumber } = params as { deviceNumber?: string };
    const body = (await request.json()) as {
      productIdSuffix?: string;
      updatedAt:string;
    };

    const deviceNumber = String(params?.deviceNumber ?? pathDeviceNumber ?? "").trim();
    const productIdSuffix = String(body?.productIdSuffix ?? "").trim();
    const updatedAt=new Date().toISOString()

    const errors: Array<{ field: string; code: string; message?: string }> = [];

    if (typeof (params?.deviceNumber ?? pathDeviceNumber) !== "string" || !deviceNumber) {
      errors.push({ field: "deviceNumber", code: "E0001" });
    }
    if (!/^[A-Za-z0-9]{1,11}$/.test(productIdSuffix)) {
      errors.push({ field: "productID,11", code: "E0003" });
    }

    if (errors.length) {
      return respondJson(
        { code: "E0003", errors, meta: makeMeta() },
        { status: 400 }
      );
    }

    return respondJson(
      {
        code: "PRODUCT_EXTRAS_SUCCESS",
        data: {
          deviceNumber,
          panelNumber: '1',
          pcsNumber: '1',
          updatedAt
        },
        meta: makeMeta(),
      },
      { status: 200 }
    );
  }),

  // ======================================================
  // POST /facilities/:facilityID/equipments/bulk-delete
  // ======================================================
  http.post(`${base}/facilities/:facilityID/equipments/bulk-delete`, async ({ params, request }) => {
    const unauth = requireAuth(request);
    if (unauth) return unauth;

    const { facilityID } = params as { facilityID?: string };
    const fid = String(facilityID ?? "").trim();

    const body = await readJson<BulkDeleteRequest>(request);
    const errors: Array<{ field: string; code: string; message?: string }> = [];

    if (!fid) {
      errors.push({
        field: "facilityID",
        code: "E0001",
        message: "施設IDは必須です。",
      });
    }

    let nums: number[] = [];
    if (!body?.deviceNumber) {
      errors.push({
        field: "deviceNumber",
        code: "E0001",
        message: "削除対象の設備番号を指定してください。",
      });
    } else {
      const rawNums = Array.isArray(body.deviceNumber)
        ? body.deviceNumber
        : [];
      nums = Array.from(
        new Set(rawNums.map(n => Number(n)).filter(Number.isFinite))
      ).sort((a, b) => a - b);

      if (nums.length === 0) {
        errors.push({
          field: "deviceNumber",
          code: "E0001",
          message: "削除対象の設備番号を指定してください。",
        });
      }
    }

    if (errors.length) {
      return respondJson(
        {
          code: "EQUIPMENT_BULK_DELETE_VALIDATION_FAILED",
          errors,
          meta: makeMeta(),
        },
        { status: 400 }
      );
    }

    await new Promise(r => setTimeout(r, 120));

    return respondJson(
      { code: "MSG0013", data: { deviceNumber: nums }, meta: makeMeta() },
      { status: 200 }
    );
  }),

  // ======================================================
  // POST /facilities/:id/solar-panels
  // ======================================================
  http.post(`${base}/facilities/:id/solar-panels`, async ({ params, request }) => {
    const unauth = requireAuth(request);
    if (unauth) return unauth;

    const { id } = params as { id: string };
    const trimmed = String(id ?? "").trim();

    const errors: ApiErrorItem[] = [];
    if (!trimmed) {
      errors.push({ field: "id", code: "E0001" });
    }

    if (errors.length > 0) {
      return respondJson(
        {
          code: "SOLAR_PANEL_CREATE_VALIDATION_FAILED",
          errors,
          meta: makeMeta(),
        },
        { status: 400 }
      );
    }

    return respondJson(
      {
        code: "SOLAR_PANEL_CREATE_SUCCESS",
        data: { deviceNumber: getRandomDeviceNumber() },
        meta: makeMeta(),
      },
      { status: 201 }
    );
  }),

  // ======================================================
  // POST /solar-panels/bulk-delete
  // ======================================================
  http.post(`${base}/solar-panels/bulk-delete`, async ({ request }) => {
    const unauth = requireAuth(request);
    if (unauth) return unauth;

    const contentType = request.headers.get("Content-Type") || "";
    let numsRaw: Array<number | string> = [];

    if (contentType.includes("application/json")) {
      const json = (await request.json()) as Partial<PanelsBulkDeleteRequest>;
      if (Array.isArray(json?.panelNumbers)) numsRaw = json.panelNumbers;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const bodyText = await request.text();
      const search = new URLSearchParams(bodyText);
      const csv = (search.get("panelNumbers") || "").trim();
      if (csv) numsRaw = csv.split(",").map(s => s.trim()).filter(Boolean);
    } else {
      const bodyText = await request.text();
      try {
        const json = JSON.parse(bodyText) as Partial<PanelsBulkDeleteRequest>;
        if (Array.isArray(json?.panelNumbers)) numsRaw = json.panelNumbers;
      } catch {}
    }

    const nums = normalizeToNumberArray(numsRaw);
    const errors: Array<{ field: string; code: string; message?: string }> = [];

    if (!nums.length) {
      errors.push({
        field: "panelNumbers",
        code: "E0001",
        message: "削除対象のパネル番号を指定してください。",
      });
    }

    if (errors.length) {
      return respondJson(
        {
          code: "SOLAR_PANELS_BULK_DELETE_VALIDATION_FAILED",
          errors,
          meta: makeMeta(),
        },
        { status: 400 }
      );
    }

    await new Promise(r => setTimeout(r, 120));

    return respondJson(
      { code: "SOLAR_PANELS_BULK_DELETE_SUCCESS", data: { panelNo: nums }, meta: makeMeta() },
      { status: 200 }
    );
  }),

  // ======================================================
  // POST /facilities/:id/pcs
  // ======================================================
  http.post(`${base}/facilities/:id/pcs`, async ({ params, request }) => {
    const unauth = requireAuth(request);
    if (unauth) return unauth;

    const { id } = params as { id?: string };
    const deviceNumber = String(id ?? "").trim();

    const errors: ApiErrorItem[] = [];
    if (!deviceNumber) errors.push({ field: "id", code: "E0001" });

    if (errors.length > 0) {
      return respondJson(
        {
          code: "PCS_INIT_VALIDATION_FAILED",
          errors,
          meta: makeMeta(),
        },
        { status: 400 }
      );
    }

    const newPCS: NewPCSNumber = {
      pcsNumber: String(getRandomDeviceNumber()),
    };

    return respondJson(
      { code: "PCS_INIT_SUCCESS", data: { pcs: [newPCS] }, meta: makeMeta() },
      { status: 201 }
    );
  }),

  // ======================================================
  // POST /pcs/bulk-delete
  // ======================================================
  http.post(`${base}/pcs/bulk-delete`, async ({ request }) => {
    const unauth = requireAuth(request);
    if (unauth) return unauth;

    const contentType = request.headers.get("Content-Type") || "";
    let numsRaw: Array<number | string> = [];

    if (contentType.includes("application/json")) {
      const json = (await request.json()) as Partial<PcsBulkDeleteRequest>;
      if (Array.isArray(json?.pcsNumbers)) numsRaw = json.pcsNumbers;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const bodyText = await request.text();
      const search = new URLSearchParams(bodyText);
      const csv = (search.get("pcsNumbers") || "").trim();
      if (csv) numsRaw = csv.split(",").map(s => s.trim()).filter(Boolean);
    } else {
      const bodyText = await request.text();
      try {
        const json = JSON.parse(bodyText) as Partial<PcsBulkDeleteRequest>;
        if (Array.isArray(json?.pcsNumbers)) numsRaw = json.pcsNumbers;
      } catch {}
    }

    const nums = normalizeToNumberArray(numsRaw);
    const errors: Array<{ field: string; code: string; message?: string }> = [];

    if (!nums.length) {
      errors.push({
        field: "pcsNumbers",
        code: "E0001",
        message: "削除対象の PCS 番号を指定してください。",
      });
    }

    if (errors.length) {
      return respondJson(
        {
          code: "PCS_BULK_DELETE_VALIDATION_FAILED",
          errors,
          meta: makeMeta(),
        },
        { status: 400 }
      );
    }

    await new Promise(r => setTimeout(r, 120));

    return respondJson(
      { code: "PCS_BULK_DELETE_SUCCESS", data: { pcsNo: nums }, meta: makeMeta() },
      { status: 200 }
    );
  }),
];

export function applyImageSelection(payload: EditPayload, img: FacilityImage): EditPayload {
  return {
    ...payload,
    facilityImage: {
      relativePath: img.relativePath,
      displayName: img.displayName,
      presignedUrl: img.presignedUrl,
    },
  };
}


export type EquipmentCreateWire = {
  code: string;
  data?: { devices?: NewDeviceNumber[] };
  errors?: ApiErrorItem[];
  meta: { requestId: string; serverTime: string };
};


export type UpdateDeviceIdWire = {
  code: string
  data?: { deviceNumber: string; updatedAt: string } // suffix echoed back
  errors?: { field: string; code: string; message?: string }[]
  meta: { requestId: string; serverTime: string }
}
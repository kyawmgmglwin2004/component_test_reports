// src/mocks/handlers/facilityListHandlers.ts
import {
  http,
  HttpResponse,
  type JsonBodyType,
  type PathParams,
  type DefaultBodyType,
} from 'msw';

/* ============================================================
   Types
   ============================================================ */
export interface FacilityItem {
  facilityID: string;
  facilityType: string;
  facilityName: string;
  facilityAddress: string;
  deviceCount: number;
  facilityStatus: string;
  measuredTime: string;
  generatedEnergy: number;
  soldEnergy: number;
  boughtEnergy: number;
}

/** Common API error item */
type ApiErrorItem = {
  field?: string;
  code: 'E0001' | 'E0002' | 'E0008' | 'E0003' | 'E0007' | string;
  meta?: Record<string, unknown>;
  message?: string;
};

/** Common error body used by all endpoints */
type ErrorBody = {
  status: '400' | '401' | '404';
  code: string;
  errors: ApiErrorItem[];
  meta: { requestId: string; serverTime: string };
};

/** Envelope type for the Lambda/APIGW-like responder */
type LambdaEnvelope = {
  statusCode: number;
  headers: HeadersInit;
  body: string; // JSON-stringified or raw (e.g., CSV)
};

/** GET /facilities — response when searchFlag=0 (master data) */
type FacilitiesMasterData = {
  data: {
    facilityType: { '0': string; '1': string };
    facilityStatus: { '0': string; '1': string; '2': string };
  };
};

/** GET /facilities — normal list response */
type FacilitiesListData = {
  data: {
    facilities: FacilityItem[];
    searchResultCount: number;
  };
};

/** GET /facilities — union of all possible responses */
type FacilitiesGetResponse = FacilitiesMasterData | FacilitiesListData | ErrorBody;

/** DELETE /facilities/:id — success response */
type FacilityDeleteSuccess = { success: true; id: string };

/** POST /facilities/download — request payload */
type ExportCsvPayload = {
  facilityID: Array<string | number>;
  columns?: ReadonlyArray<Extract<keyof FacilityItem, string>>;
  headerTitles?: string[];
  filename?: string;
  simulateError?: boolean; // optional: if true, simulate 500 (inside envelope)
};

/** POST /facilities/download — union response */
type FacilitiesDownloadResponse = LambdaEnvelope | ErrorBody;

/* ============================================================
   Response helpers (type-safe)
   ============================================================ */

const defaultJsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
} as const;

/** Plain JSON responder (recommended for normal endpoints). */
export function respondJson<T extends JsonBodyType>(
  body: T,
  init?: { status?: number; headers?: HeadersInit }
) {
  const status = init?.status ?? 200;
  const headers: HeadersInit = { ...defaultJsonHeaders, ...(init?.headers ?? {}) };
  return HttpResponse.json<T>(body, { status, headers });
}

function getHeaderCaseInsensitive(headers: HeadersInit | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const target = name.toLowerCase();

  if (headers instanceof Headers) {
    return headers.get(name) ?? headers.get(target) ?? undefined;
  }
  if (Array.isArray(headers)) {
    for (const [k, v] of headers) {
      if (k.toLowerCase() === target) return v;
    }
    return undefined;
  }
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) return String(v);
  }
  return undefined;
}

/**
 * APIGW/Lambda-proxy style envelope.
 * Use ONLY when you need to embed non-JSON inner types (e.g., CSV)
 * or you explicitly want the { statusCode, headers, body } shape.
 *
 * - Outer response: JSON with HTTP status = statusCode
 * - Inner headers/content type in `headers`
 * - `body` is JSON-stringified when inner content-type is JSON
 */
export function respondAsLambda(
  body: unknown,
  init?: { status?: number; headers?: HeadersInit }
) {
  const statusCode = init?.status ?? 200;

  // Headers placed INSIDE the envelope
  const innerHeaders: HeadersInit = {
    ...defaultJsonHeaders,
    ...(init?.headers ?? {}),
  };

  const contentType =
    getHeaderCaseInsensitive(innerHeaders, 'Content-Type') ?? 'application/json';
  const isJson = contentType.toLowerCase().startsWith('application/json');

  const envelope: LambdaEnvelope = {
    statusCode,
    headers: innerHeaders,
    body: isJson
      ? JSON.stringify(body as JsonBodyType)
      : typeof body === 'string'
        ? body
        : String(body ?? ''),
  };

  // Outer response is JSON; status must reflect the inner statusCode
  return HttpResponse.json<LambdaEnvelope>(envelope, {
    status: statusCode,
    headers: defaultJsonHeaders,
  });
}

/* ============================================================
   Utilities & mock data
   ============================================================ */

function randomRequestId() {
  return 'req-' + Math.random().toString(16).slice(2, 10);
}

const allFacilityList: FacilityItem[] = Array.from({ length: 150 }, (_, i) => ({
  facilityID: `F${String(i + 1).padStart(5, '0')}`,
  facilityType: i % 2 === 0 ? '自治体' : '家庭',
  facilityName: i % 5 === 0 ? 'ABC工場' : 'CBC工場',
  facilityAddress:
    'Bagan (/bəˈɡæn/ bə-GAN; Burmese: ပုဂံ Băgam [bəɡàɰ̃]; formerly Pagan) is an ancient city and a UNESCO World Heritage Site in the Mandalay Region of Myanmar.[1] From the 9th to 13th centuries, the city was the capital of the Pagan Kingdom, the first kingdom that unified the regions that would later constitute Myanmar.',
  deviceCount: 22,
  facilityStatus: i % 5 === 0 ? '非運用' : i % 2 === 0 ? '運用中' : 'メンテナンス中',
  measuredTime: '09-28-12:00~14:00',
  generatedEnergy: 234 + i,
  soldEnergy: 345 + i,
  boughtEnergy: 456 + i,
}));


function requireAuth(request: Request): HttpResponse<ErrorBody> | null {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ') || !auth.slice(7).trim()) {
    return respondJson<ErrorBody>(
      {
        status: '401',
        code: 'UNAUTHORIZED',
        errors: [{ code: 'E0001', message: 'Unauthorized' }],
        meta: { requestId: randomRequestId(), serverTime: new Date().toISOString() },
      },
      { status: 401 }
    );
  }
  return null;
}

type SortOrder = 'asc' | 'desc';
type SortableStringKeys = Extract<
  {
    [K in keyof FacilityItem]: FacilityItem[K] extends string | number ? K : never;
  }[keyof FacilityItem],
  string
>;

const base = import.meta.env.VITE_API_BASE_URL as string;
const MAX_LEN = 40;
const LIMIT = 10 as const;
const normalize = (v: unknown): string => String(v ?? '').trim().toLowerCase();

function getSortableValue<T extends FacilityItem, K extends keyof T>(item: T, key: K): string {
  const value = item[key];
  if (typeof value === 'number') return String(value).trim().toLowerCase();
  if (typeof value === 'string') return value.trim().toLowerCase();
  return '';
}

type ColumnKey<T> = Extract<keyof T, string>;
export function toCsv<T extends object>(
  rows: T[],
  columns: ReadonlyArray<ColumnKey<T>>,
  headerTitles: ReadonlyArray<string>
): string {
  const escape = (val: unknown) => {
    if (val == null) return '';
    const s = String(val);
    const needsQuotes = /[",\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const get = <K extends ColumnKey<T>>(obj: T, key: K): T[K] => obj[key];
  const header = headerTitles.join(',');
  const body = rows.map(row => columns.map(col => escape(get(row, col))).join(',')).join('\n');
  return `${header}\n${body}`;
}

function mapFacilityType(raw: string) {
  if (raw === '0') return '自治体';
  if (raw === '1') return '家庭';
  return raw;
}

function mapFacilityStatus(raw: string) {
  if (raw === '0') return '非運用';
  if (raw === '1') return '運用中';
  if (raw === '2') return 'メンテナンス中';
  return raw;
}

function keywordMatches(item: FacilityItem, keywordRaw: string) {
  const nq = normalize(keywordRaw);
  if (!nq || nq === 'all') return true;
  if (normalize(item.facilityID?.toString?.()) === nq) return true;

  const fields = [normalize(item.facilityName ?? ''), normalize(item.facilityAddress ?? '')];
  return fields.some(f => f.includes(nq));
}

const allowedSortKeys: ReadonlyArray<SortableStringKeys> = [
  'facilityName',
  'facilityAddress',
  'facilityType',
  'facilityStatus',
  'facilityID',
  'deviceCount',
  'measuredTime',
  'generatedEnergy',
  'soldEnergy',
  'boughtEnergy',
];

/* ============================================================
   Handlers
   ============================================================ */
export const facilityListHandlers = [
  // CSV download (auth required) — keep envelope to carry CSV inner headers/body
  http.post<PathParams, ExportCsvPayload, FacilitiesDownloadResponse>(
    `${base}/facilities/download`,
    async ({ request }) => {
      const unauth = requireAuth(request);
      if (unauth) return unauth as unknown as HttpResponse<FacilitiesDownloadResponse>;

      const makeErrorBody = (code: string, errors: ApiErrorItem[]): ErrorBody => ({
        status: '400',
        code,
        errors,
        meta: {
          requestId: randomRequestId(),
          serverTime: new Date().toISOString(),
        },
      });
      const badRequest = (code: string, errors: ApiErrorItem[] = []) =>
        respondJson<ErrorBody>(makeErrorBody(code, errors), { status: 400 });

      // Payload
      let payload: ExportCsvPayload;
      try {
        payload = (await request.json()) as ExportCsvPayload;
      } catch {
        // Invalid JSON
        return badRequest('REQUEST_BODY_INVALID_JSON', [
          { code: 'E0001', message: 'Body must be valid JSON.' },
        ]);
      }

      // facilityID validation
      if (!Array.isArray(payload?.facilityID) || payload.facilityID.length === 0) {
        return respondJson<ErrorBody>(
          {
            status: '400',
            code: 'FACILITY_ID_VALIDATION_FAILED',
            errors: [{ code: 'E0006' }],
            meta: { requestId: randomRequestId(), serverTime: new Date().toISOString() },
          },
          { status: 400 }
        );
      }
      // Normalize IDs: trim, drop empty & placeholder "0", then dedupe
      const targetIds = Array.from(
        new Set(
          payload.facilityID
            .map(x => String(x).trim())
            .filter(v => v && v !== '0')
        )
      );
      if (targetIds.length === 0) {
        return badRequest('FACILITY_LIST_VALIDATION_FAILED', [
          {
            field: 'facilityID',
            code: 'E0006',
            message: 'Please select at least one valid facility.',
          },
        ]);
      }

      // Column allowlist & labels
      const allowedColumns: ReadonlyArray<Extract<keyof FacilityItem, string>> = [
        'facilityType',
        'facilityID',
        'facilityName',
        'facilityAddress',
        'deviceCount',
        'facilityStatus',
        'measuredTime',
        'generatedEnergy',
        'soldEnergy',
        'boughtEnergy',
      ] as const;

      const baseColumns: ReadonlyArray<Extract<keyof FacilityItem, string>> =
        Array.isArray(payload?.columns) && payload.columns.length
          ? (payload.columns as ReadonlyArray<Extract<keyof FacilityItem, string>>)
          : allowedColumns;

      const columnLabel: Record<Extract<keyof FacilityItem, string>, string> = {
        facilityType: '施設区分',
        facilityID: '設備ID',
        facilityName: '施設名',
        facilityAddress: '施設所在地',
        deviceCount: '設備数',
        facilityStatus: '設備ステータス',
        measuredTime: '計測対象時間帯 (mm/dd hh:mm～hh:mm)',
        generatedEnergy: '発電電力量（kWh）',
        soldEnergy: '売電電力量（kWh）',
        boughtEnergy: '買電電力量（kWh）',
      };

      const baseHeaderTitles =
        Array.isArray(payload?.headerTitles) && payload.headerTitles.length === baseColumns.length
          ? payload.headerTitles
          : baseColumns.map(key => columnLabel[key] ?? String(key));

      // Filename & RFC 5987
      const now = new Date();
      const yyyymmdd = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('');

      const baseNameJa = (payload?.filename?.trim() || `施設一覧CSVファイル__${yyyymmdd}`) + '.csv';
      const asciiFallback = `facility_list_${yyyymmdd}.csv`;
      const filenameStar = `UTF-8''${encodeURIComponent(baseNameJa)}`;

      // Select rows
      const byId = new Map<string, FacilityItem>(
        allFacilityList.map(item => [String(item.facilityID), item])
      );

      const selectedRows = targetIds
        .map(id => byId.get(id))
        .filter((row): row is FacilityItem => row !== undefined);

      const notFoundIds = targetIds.filter(id => !byId.has(id));

      if (selectedRows.length === 0) {
        return respondJson<ErrorBody>(
          {
            status: '404',
            code: 'Facility_List_Not_Found',
            errors: [{ code: 'E0007' }],
            meta: { requestId: randomRequestId(), serverTime: new Date().toISOString() },
          },
          { status: 404 }
        );
      }

      // Build CSV
      type FacilityItemWithRowNo = FacilityItem & { rowNo: number };

      const rowsWithIndex: FacilityItemWithRowNo[] = selectedRows.map((row, i) => ({
        ...row,
        rowNo: i + 1,
      }));

      const columnsWithRowNo: ReadonlyArray<Extract<
        keyof FacilityItemWithRowNo,
        string
      >> = ['rowNo', ...baseColumns];

      const headerTitlesWithRowNo: string[] = ['項番', ...baseHeaderTitles];

      const csv = toCsv<FacilityItemWithRowNo>(
        rowsWithIndex,
        columnsWithRowNo,
        headerTitlesWithRowNo
      );
      const csvBody = '\uFEFF' + csv; // BOM for Excel

      const extraHeaders: Record<string, string> = {
        'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=${filenameStar}`,
        'Access-Control-Expose-Headers': 'Content-Disposition',
        ...(notFoundIds.length ? { 'X-Not-Found-Ids': encodeURIComponent(notFoundIds.join(',')) } : {}),
        // inner content type for the envelope
        'Content-Type': 'text/csv; charset=utf-8',
      };

      // Normal success (optionally simulate error inside envelope)
      const innerStatus = payload?.simulateError ? 500 : 200;

      // Keep envelope ONLY here for CSV
      return respondAsLambda(csvBody, {
        status: innerStatus,
        headers: { ...extraHeaders },
      }) as unknown as HttpResponse<FacilitiesDownloadResponse>;
    }
  ),

  // Delete (auth required)
  http.delete<{ id: string }, DefaultBodyType, FacilityDeleteSuccess | ErrorBody>(
    `${base}/facilities/:id`,
    ({ request, params }) => {
      const unauth = requireAuth(request);
      if (unauth) return unauth as unknown as HttpResponse<FacilityDeleteSuccess | ErrorBody>;

      const idParam = params.id;
      if (idParam == null) {
        return respondJson<ErrorBody>(
          {
            status: '400',
            code: 'BAD_REQUEST',
            errors: [{ code: 'E0001', message: 'Missing id param' }],
            meta: { requestId: randomRequestId(), serverTime: new Date().toISOString() },
          },
          { status: 400 }
        );
      }

      const id = String(idParam);
      const before = allFacilityList.length;
      const update = allFacilityList.filter(f => String(f.facilityID) !== id);
      allFacilityList.length = 0;
      allFacilityList.push(...update);
      const success = update.length < before;

      return success
        ? respondJson<FacilityDeleteSuccess>({ success: true, id }, { status: 200 })
        : respondJson<ErrorBody>(
            {
              status: '404',
              code: 'FACILITY_NOT_FOUND',
              errors: [{ field: 'facilityID', code: 'E0001', message: 'facility not found' }],
              meta: { requestId: randomRequestId(), serverTime: new Date().toISOString() },
            },
            { status: 404 }
          );
    }
  ),

  // List/search facilities (auth required)
  http.get<PathParams, DefaultBodyType, FacilitiesGetResponse>(
    `${base}/facilities`,
    async ({ request }) => {
      const unauth = requireAuth(request);
      if (unauth) return unauth as unknown as HttpResponse<FacilitiesGetResponse>;

      const url = new URL(request.url);

      // -------------------- searchFlag handling --------------------
      const searchFlagParam = (url.searchParams.get('searchFlag') ?? '1').trim();
      const searchFlag = Number.isFinite(Number(searchFlagParam))
        ? Number(searchFlagParam)
        : 1;

      if (searchFlag === 0) {
        const body: FacilitiesMasterData = {
          data: {
            facilityType: { '0': '自治体', '1': '家庭' },
            facilityStatus: { '0': '非運用', '1': '運用中', '2': 'メンテナンス中' },
          },
        };
        return respondJson<FacilitiesGetResponse>(body, { status: 200 });
      }

      // --------- Query params for search/sort/pagination --------
      const keywordRaw = (url.searchParams.get('keyword') ?? '').trim();
      const facilityTypeParam = (url.searchParams.get('facilityType') ?? '').trim();
      const facilityStatusParam = (url.searchParams.get('facilityStatus') ?? '').trim();
      const pageNumberParam = url.searchParams.get('pageNumber');
      const sortItemNameRaw = (url.searchParams.get('sortItemName') ?? '').trim();
      const sortOrderRaw = (url.searchParams.get('sortOrder') ?? 'asc').trim().toLowerCase();
      const pageNumber = Number.isFinite(Number(pageNumberParam))
        ? Number(pageNumberParam)
        : 1;
      const sortOrder: SortOrder = sortOrderRaw === 'desc' ? 'desc' : 'asc';
      const sortKey = allowedSortKeys.includes(sortItemNameRaw as SortableStringKeys)
        ? (sortItemNameRaw as SortableStringKeys)
        : null;

      const makeErrorBody = (code: string, errors: ApiErrorItem[]): ErrorBody => ({
        status: '400',
        code,
        errors,
        meta: {
          requestId: randomRequestId(),
          serverTime: new Date().toISOString(),
        },
      });

      // ---- Validation: keyword too long ----
      if (keywordRaw.length > MAX_LEN) {
        const body: ErrorBody = makeErrorBody('FACILITY_LIST_VALIDATION_FAILED', [
          { field: 'キーワード,40', code: 'E0002' },
        ]);
        return respondJson<FacilitiesGetResponse>(body, { status: 400 });
      }

      // ---- Normalize & map filters ----
      const mappedTypeRaw = mapFacilityType(facilityTypeParam);
      const mappedStatusRaw = mapFacilityStatus(facilityStatusParam);
      const keyword = normalize(keywordRaw);
      const type =
        ['', 'all', '*'].includes(normalize(mappedTypeRaw)) ? '' : normalize(mappedTypeRaw);
      const status =
        ['', 'all', '*'].includes(normalize(mappedStatusRaw)) ? '' : normalize(mappedStatusRaw);
      const hasAnyFilter = Boolean(keyword) || Boolean(type) || Boolean(status);

      // ---- Defensive wrapper around allFacilityList ----
      let filtered: FacilityItem[] = [];
      if (Array.isArray(allFacilityList)) {
        filtered = [...allFacilityList];
      } else {
        console.error('allFacilityList is not an array', allFacilityList);
        filtered = [];
      }

      // ---- Filtering ----
      if (hasAnyFilter) {
        filtered = filtered.filter(item => {
          const matchesKeyword = keywordMatches(item, keywordRaw);
          const matchesType = !type || normalize(item.facilityType) === type;
          const matchesStatus = !status || normalize(item.facilityStatus) === status;
          return matchesKeyword && matchesType && matchesStatus;
        });
      }

      // ---- Not found → 404 plain JSON ----
      if (filtered.length === 0) {
        return respondJson<FacilitiesGetResponse>(
          {
            status: '404',
            code: 'Facility_List_Not_Found',
            errors: [{ code: 'E0007' }],
            meta: { requestId: randomRequestId(), serverTime: new Date().toISOString() },
          },
          { status: 404 }
        );
      }

      // ---- Sorting ----
      if (sortKey) {
        filtered = filtered.slice().sort((a, b) => {
          const aVal = (getSortableValue(a, sortKey) ?? '').toString().normalize('NFKC');
          const bVal = (getSortableValue(b, sortKey) ?? '').toString().normalize('NFKC');

          const primary = aVal.localeCompare(bVal, 'ja', {
            sensitivity: 'base',
            numeric: true,
          });
          if (primary !== 0) {
            return sortOrder === 'asc' ? primary : -primary;
          }
          const aId = Number(a.facilityID ?? 0);
          const bId = Number(b.facilityID ?? 0);
          return sortOrder === 'asc' ? aId - bId : bId - aId;
        });
      } else {
        filtered.sort((a, b) => {
          const aid = Number(a.facilityID);
          const bid = Number(b.facilityID);
          const bothFinite = Number.isFinite(aid) && Number.isFinite(bid);
          if (bothFinite && aid !== bid) return aid - bid;

          const idCompare = String(a.facilityID ?? '').localeCompare(String(b.facilityID ?? ''));
          if (idCompare !== 0) return idCompare;

          const aType = String(a.facilityType ?? '');
          const bType = String(b.facilityType ?? '');
          return aType.localeCompare(bType);
        });
      }
      // ---- Pagination ----
      const safePage = Math.max(1, Number.isFinite(pageNumber) ? pageNumber : 1);
      const start = (safePage - 1) * LIMIT;
      const facilities = filtered.slice(start, start + LIMIT);
      const searchResultCount = filtered.length;

      const body: FacilitiesListData = {
        data: {
          facilities,
          searchResultCount,
        },
      };

      return respondJson<FacilitiesGetResponse>(body, { status: 200 });
    }
  ),
];
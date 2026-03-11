// src/mocks/handlers/facilityRegisterHandlers.ts
import {
  http,
  HttpResponse,
  type DefaultBodyType,
  type PathParams,
  type JsonBodyType,
} from 'msw'

/* ============================================================
   Helpers: return *only* body (simulate API Gateway unwrapping)
   ============================================================ */

const defaultJsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
} as const

/** Return plain JSON body with real HTTP status and headers. */
function respondJson<T extends JsonBodyType>(
  body: T,
  init?: { status?: number; headers?: HeadersInit }
) {
  const status = init?.status ?? 200
  const headers: HeadersInit = { ...defaultJsonHeaders, ...(init?.headers ?? {}) }
  return HttpResponse.json<T>(body, { status, headers })
}

/* ============================================================
   Utilities, types, and constants
   ============================================================ */

function randomRequestId() {
  return 'req-' + Math.random().toString(16).slice(2, 10)
}
function meta() {
  return { requestId: randomRequestId(), serverTime: new Date().toISOString() }
}

const base = import.meta.env.VITE_API_BASE_URL as string

type FacilityTypeCode = '0' | '1'

type InitResponse = {
  facilityId: string
  facilityType: { '0': '自治体'; '1': '家庭' }
  facilityStatus: { '0': '非運用'; '1': '運用中'; '2': 'メンテナンス' }
  defaultFacilityType: '0' | '1'
  defaultFacilityStatus: '0' | '1' | '2'
}

export interface FacilityImageDTO {
  relativePath?: string
  presignedUrl?: string
  displayName?: string
}
export interface FacilityImage {
  presignedUrl?: string
  relativePath?: string
  displayName?: string
}

type FacilityRegisterBody = {
  facilityType: string
  facilityID?: string
  ecoCompanyID: string
  ecoCompanyPassword: string
  facilityName: string
  facilityAddress: string
  cityInfo: string
  imageFilename: string
  facilityStatus: string
  facilityManagerName: string
  facilityManagerMail: string
}

/* --------------------- Standardized response bodies --------------------- */

type Meta = { requestId: string; serverTime: string }
type ErrorItem = { field?: string; code: string; message?: string; args?: (string | number)[] }

type ErrorBody = {
  status: '400' | '401' | '409' | '503' | '404'
  code: string
  errors: ErrorItem[]
  meta: Meta
}

type InitSuccess = {
  code: 'FACILITY_REGISTER_INIT_SUCCESS'
  data: InitResponse
  meta: Meta
}

type PhotosSuccess = {
  code: 'FACILITY_PHOTOS_SUCCESS'
  data: FacilityImage[]
  meta: Meta
}

type RegisterSuccess = {
  code: 'FACILITY_REGISTER_SUCCESS'
  data: { facility: unknown }
  meta: Meta
}

/* ============================================================
   Auth → plain JSON error with real HTTP 401
   ============================================================ */

function requireAuth(request: Request): HttpResponse<ErrorBody> | null {
  const auth = request.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ') || !auth.slice(7).trim()) {
    return respondJson<ErrorBody>(
      {
        status: '401',
        code: 'UNAUTHORIZED',
        errors: [{ code: 'E0001', message: 'Unauthorized' }],
        meta: meta(),
      },
      { status: 401 }
    )
  }
  return null
}
/* ============================================================
   Mock data & helpers
   ============================================================ */

const placeholder = new URL('../../assets/images/placeholder.png', import.meta.url).href
const demoData: Record<FacilityTypeCode, FacilityImageDTO[]> = {
  '0': [
    { relativePath: '/facility/category1/OIP.webp',  displayName: '自治体1' },
    { relativePath: '/facility/category1/OIP2.webp', displayName: '自治体2' },
    { relativePath: '/facility/category1/OIP3.webp', displayName: '自治体3' },
  ],
  '1': [
    { relativePath: '/facility/category2/family1.webp',  displayName: '家庭1' },
    { relativePath: '/facility/category2/family2.webp',  displayName: '家庭2' },
    { relativePath: '/facility/category2/family3.webp',  displayName: '家庭3' },
    { relativePath: '/facility/category2/family4.webp',  displayName: '家庭4' },
    { relativePath: '/facility/category2/family5.webp',  displayName: '家庭5' },
    { relativePath: '/facility/category2/family6.webp',  displayName: '家庭6' },
    { relativePath: '/facility/category2/family7.webp',  displayName: '家庭7' },
    { relativePath: '/facility/category2/family8.webp',  displayName: '家庭8' },
    { relativePath: '/facility/category2/family9.webp',  displayName: '家庭9' },
    { relativePath: '/facility/category2/family10.webp', displayName: '家庭10' },
      { relativePath: '/facility/category2/family1.webp',  displayName: '家庭1' },
    { relativePath: '/facility/category2/family2.webp',  displayName: '家庭2' },
    { relativePath: '/facility/category2/family3.webp',  displayName: '家庭3' },
    { relativePath: '/facility/category2/family4.webp',  displayName: '家庭4' },
    { relativePath: '/facility/category2/family5.webp',  displayName: '家庭5' },
    { relativePath: '/facility/category2/family6.webp',  displayName: '家庭6' },
    { relativePath: '/facility/category2/family7.webp',  displayName: '家庭7' },
    { relativePath: '/facility/category2/family8.webp',  displayName: '家庭8' },
    { relativePath: '/facility/category2/family9.webp',  displayName: '家庭9' },
    { relativePath: '/facility/category2/family10.webp', displayName: '家庭10' },
      { relativePath: '/facility/category2/family1.webp',  displayName: '家庭1' },
    { relativePath: '/facility/category2/family2.webp',  displayName: '家庭2' },
    { relativePath: '/facility/category2/family3.webp',  displayName: '家庭3' },
    { relativePath: '/facility/category2/family4.webp',  displayName: '家庭4' },
    { relativePath: '/facility/category2/family5.webp',  displayName: '家庭5' },
    { relativePath: '/facility/category2/family6.webp',  displayName: '家庭6' },
    { relativePath: '/facility/category2/family7.webp',  displayName: '家庭7' },
    { relativePath: '/facility/category2/family8.webp',  displayName: '家庭8' },
    { relativePath: '/facility/category2/family9.webp',  displayName: '家庭9' },
    { relativePath: '/facility/category2/family10.webp', displayName: '家庭10' },
  ],
}

function absoluteUrl(u: string): string {
  const baseUrl = import.meta.env?.BASE_URL ?? '/'
  if (!u) return placeholder
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u
  return `${baseUrl.replace(/\/$/, '')}${u.startsWith('/') ? '' : '/'}${u}`
}
function normalizeDto(dto: FacilityImageDTO): FacilityImage {
  let presignedUrl = placeholder
  if (dto.relativePath) {
    presignedUrl = absoluteUrl(dto.relativePath)
  } else if (dto.presignedUrl) {
    presignedUrl = dto.presignedUrl.startsWith('data:')
      ? dto.presignedUrl
      : `data:image/webp;base64,${dto.presignedUrl}`
  }
  return {
    presignedUrl,
    relativePath: dto.relativePath,
    displayName: dto.displayName,
  }
}

// Validation helpers
const isBlank = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim().length === 0)
const maxLen = (v: unknown, max: number) =>
  typeof v !== 'string' || v.trim().length <= max
const isNumericString = (v: unknown) => {
  if (typeof v !== 'string') return false
  const s = v.trim()
  return s.length > 0 && /^\d+$/.test(s)
}
const emailLike = (v: unknown) => /^[^\s@]+@[^\s@]+$/.test((v ?? '').toString().trim())

const withArgs = (field: string, code: string) => ({
  field,
  code,
  args: field ? field.split(',') : [],
})

function validateRegister(b: FacilityRegisterBody): ErrorItem[] {
  const errors: ErrorItem[] = []

  if (isBlank(b.facilityID)) errors.push(withArgs('facilityID', 'E0001'))
  else if (isNumericString(b.facilityID)) errors.push(withArgs('facilityID,文字列', 'E0003'))
  else if (!maxLen(b.facilityID, 10)) errors.push(withArgs('facilityID,10', 'E0002'))

  if (isBlank(b.ecoCompanyID)) errors.push(withArgs('ecoCompanyID', 'E0001'))
  else if (isNumericString(b.ecoCompanyID)) errors.push(withArgs('ecoCompanyID,文字列', 'E0003'))
  else if (!maxLen(b.ecoCompanyID, 8)) errors.push(withArgs('ecoCompanyID,8,文字列', 'E0002'))

  if (isBlank(b.ecoCompanyPassword)) errors.push(withArgs('ecoCompanyPassword', 'E0001'))
  else if (isNumericString(b.ecoCompanyPassword)) errors.push(withArgs('ecoCompanyPassword,文字列', 'E0003'))
  else if (!maxLen(b.ecoCompanyPassword, 16)) errors.push(withArgs('ecoCompanyPassword,16', 'E0002'))

  if (isBlank(b.facilityName)) errors.push(withArgs('facilityName', 'E0001'))
  else if (isNumericString(b.facilityName)) errors.push(withArgs('facilityName,文字列', 'E0003'))
  else if (!maxLen(b.facilityName, 30)) errors.push(withArgs('facilityName,30', 'E0002'))

  if (isBlank(b.facilityAddress)) errors.push(withArgs('facilityAddress', 'E0001'))
  else if (isNumericString(b.facilityAddress)) errors.push(withArgs('facilityAddress,文字列', 'E0003'))
  else if (!maxLen(b.facilityAddress, 40)) errors.push(withArgs('facilityAddress,40', 'E0002'))

  if (isBlank(b.cityInfo)) errors.push(withArgs('cityInfo', 'E0001'))
  else if (isNumericString(b.cityInfo)) errors.push(withArgs('cityInfo,文字列', 'E0003'))
  else if (!maxLen(b.cityInfo, 50)) errors.push(withArgs('cityInfo,50', 'E0002'))

  if (isBlank(b.imageFilename)) errors.push(withArgs('imageFilename', 'E0001'))
  else if (isNumericString(b.imageFilename)) errors.push(withArgs('imageFilename,文字列', 'E0003'))

  if (!isBlank(b.facilityManagerName)) {
    if (!maxLen(b.facilityManagerName, 20)) errors.push(withArgs('facilityManagerName,20', 'E0002'))
    else if (isNumericString(b.facilityManagerName)) errors.push(withArgs('facilityManagerName,文字列', 'E0003'))
  }

  if (!isBlank(b.facilityManagerMail) && !emailLike(b.facilityManagerMail)) {
    errors.push(withArgs('facilityManagerMail', 'E0008'))
  }

  return errors
}

function toFacilityType(input: string | null | undefined): FacilityTypeCode | undefined {
  if (input === '0' || input === '1') return input
  return undefined
}

/* ============================================================
   Handlers — PLAIN JSON body (envelope at root; no Lambda proxy)
   ============================================================ */

export const facilityRegisterHandlers = [
  // INIT — returns { code, data, meta } or error body
  http.get<PathParams, DefaultBodyType, InitSuccess | ErrorBody>(
    `${base}/facilities/register/init`,
    ({ request }) => {
      const unauth = requireAuth(request)
      if (unauth) return unauth as unknown as HttpResponse<InitSuccess | ErrorBody>

      const data: InitResponse = {
        facilityId: 'F00005',
        facilityType: { '0': '自治体', '1': '家庭' },
        facilityStatus: { '0': '非運用', '1': '運用中', '2': 'メンテナンス' },
        defaultFacilityType: '0',
        defaultFacilityStatus: '0',
      }

      return respondJson<InitSuccess | ErrorBody>(
        { code: 'FACILITY_REGISTER_INIT_SUCCESS', data, meta: meta() },
        { status: 200 }
      )
    }
  ),

  // Photos — returns { code, data, meta } or 400 error
  http.get<PathParams, DefaultBodyType, PhotosSuccess | ErrorBody>(
    `${base}/facilities/photos`,
    ({ request }) => {
      const unauth = requireAuth(request)
      if (unauth) return unauth as unknown as HttpResponse<PhotosSuccess | ErrorBody>

      const url = new URL(request.url)
      const q = url.searchParams.get('facilityType')
      const category = toFacilityType(q)

      if (!category) {
        return respondJson<PhotosSuccess | ErrorBody>(
          {
            status: '400',
            code: 'FACILITY_REGISTER_VALIDATION_FAILED',
            errors: [{ code: 'E0001', message: `Unknown category: "${q}". Allowed: 0, 1` }],
            meta: meta(),
          },
          { status: 400 }
        )
      }

      const simulateS3NotFound =
        url.searchParams.get('error') === 'E0035' ||
        url.searchParams.get('s3') === 'notfound'
      const s3Key = (url.searchParams.get('key') ?? '').trim()

      if (simulateS3NotFound) {
        return respondJson<PhotosSuccess | ErrorBody>(
          {
            status: '400',
            code: 'E0035',
            errors: [
              {
                code: 'E0043',
                message: '指定されたファイルはS3上に存在しません。',
                field: s3Key ? `s3Key:${s3Key}` : undefined,
              },
            ],
            meta: meta(),
          },
          { status: 400 }
        )
      }

      const dtos = demoData[category] ?? []
      if (dtos.length === 0) {
        return respondJson<PhotosSuccess | ErrorBody>(
          {
            status: '404',
            code: 'not found',
            errors: [
              {
                code: 'E0043',
                message: '指定されたファイルはS3上に存在しません。',
                field: s3Key ? `s3Key:${s3Key}` : undefined,
              },
            ],
            meta: meta(),
          },
          { status: 404 }
        )
      }

      const images: FacilityImage[] = dtos.map(normalizeDto)
      return respondJson<PhotosSuccess | ErrorBody>(
        { code: 'FACILITY_PHOTOS_SUCCESS', data: images, meta: meta() },
        { status: 200 }
      )
    }
  ),

  // REGISTER — returns success 201 or error bodies
  http.post<PathParams, FacilityRegisterBody, RegisterSuccess | ErrorBody>(
    `${base}/facilities`,
    async ({ request }) => {
      const unauth = requireAuth(request)
      if (unauth) return unauth as unknown as HttpResponse<RegisterSuccess | ErrorBody>

      let body: FacilityRegisterBody
      try {
        body = (await request.json()) as FacilityRegisterBody
      } catch {
        return respondJson<RegisterSuccess | ErrorBody>(
          {
            status: '400',
            code: 'REQUEST_BODY_INVALID_JSON',
            errors: [{ code: 'E0001', message: 'Body must be valid JSON.' }],
            meta: meta(),
          },
          { status: 400 }
        )
      }

      const errors = validateRegister(body)
      if (errors.length > 0) {
        return respondJson<RegisterSuccess | ErrorBody>(
          { status: '400', code: 'FACILITY_REGISTER_VALIDATION_FAILED', errors, meta: meta() },
          { status: 400 }
        )
      }

      if ((body.facilityID ?? '') === 'F00005') {
        return respondJson<RegisterSuccess | ErrorBody>(
          {
            status: '409',
            code: 'FACILITY_ID_CONFLICT',
            errors: [{ code: 'E0009', args: ['F00001', 'F00002'] }],
            meta: meta(),
          },
          { status: 409 }
        )
      }

      const created = {
        facilityType: body.facilityType,
        facilityID: body.facilityID ?? '',
        ecoCompanyID: body.ecoCompanyID,
        facilityName: body.facilityName,
        facilityAddress: body.facilityAddress,
        cityInfo: body.cityInfo,
        imageFilename: body.imageFilename,
        facilityStatus: body.facilityStatus,
        facilityManagerName: body.facilityManagerName,
        facilityManagerMail: body.facilityManagerMail,
      }

      // 🔧 FIX: use 'created' (not 'facilityated')
      return respondJson<RegisterSuccess | ErrorBody>(
        { code: 'FACILITY_REGISTER_SUCCESS', data: { facility: created }, meta: meta() },
        { status: 201 }
      )
    }
  ),
]
import { http, HttpResponse } from 'msw'

// ====== Bundled images (Vite ?url imports) ======
import OIP     from '/facility/category1/OIP.webp?url'
import OIP2    from '/facility/category1/OIP2.webp?url'
import OIP3    from '/facility/category1/OIP3.webp?url'
import family1 from '/facility/category2/family1.webp?url'
import family2 from '/facility/category2/family2.webp?url'
import family3 from '/facility/category2/family3.webp?url'
import family4 from '/facility/category2/family4.webp?url'
import family5 from '/facility/category2/family5.webp?url'
import family6 from '/facility/category2/family6.webp?url'
import family7 from '/facility/category2/family7.webp?url'
import family8 from '/facility/category2/family8.webp?url'
import family9 from '/facility/category2/family9.webp?url'

// ====== Types (mirror your frontend) ======
export type facilityImage = {
  relativePath: string
  displayName: string
  presignedUrl: string
}

export interface facilityImageDTO {
  url?: string
  image?: string
  name: string
}

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
  // NOTE: The frontend allows facilityImage to be `{ errorCode: string }` at runtime
  // even though TS type is facilityImage; MSW will return that shape sometimes for testing.
  facilityImage: facilityImage | { errorCode: string }
}

export type ApiPayload = ECheck

type BodyEnvelope<T> = {
  code?: string
  data?: T
  meta?: Record<string, string>
  errors?: Array<{ field?: string; code?: string; message?: string }>
}

// ====== Utilities ======
const PLACEHOLDER = OIP

// Match either env-based base or the hard-coded base used in your composition function
const configuredBase = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
const HARDCODED_BASE = 'https://nz1q9c7272.execute-api.ap-northeast-1.amazonaws.com/dev'
const base = configuredBase || HARDCODED_BASE

function absoluteUrl(urlOrPath: string): string {
  if (/^(?:https?:)?\/\//i.test(urlOrPath) || /^data:/i.test(urlOrPath)) return urlOrPath
  if (urlOrPath.startsWith('/')) return `${location.origin}${urlOrPath}`
  return `${location.origin}/${urlOrPath.replace(/^\.\//, '')}`
}

function getDevDataUrlForFacility(numericId: string): string | null {
  try {
    return localStorage.getItem(`facilityImage:${numericId}`)
  } catch {
    return null
  }
}

const facilityFileUrlById: Record<string, string> = {
  '0': OIP, '1': OIP2, '2': OIP3, '3': family1, '4': family2, '5': family3,
  '6': family4, '7': family5, '8': family6, '9': family7, '10': family8, '11': family9,
}

function buildFacilityImageUrl(numericId: string): string {
  const dev = getDevDataUrlForFacility(numericId)
  if (dev) return dev
  return facilityFileUrlById[numericId] ?? PLACEHOLDER
}

function normalizeDto(dto: facilityImageDTO): facilityImage {
  let relativePath = ''
  let presignedUrl = PLACEHOLDER

  if (dto.url) {
    relativePath = dto.url
    presignedUrl = absoluteUrl(dto.url)
  } else if (dto.image) {
    presignedUrl = dto.image.startsWith('data:')
      ? dto.image
      : `data:image/webp;base64,${dto.image}`
  }
  return { relativePath, displayName: dto.name, presignedUrl }
}

function formatLastCompletedHourWindow({
  timeZone = 'Asia/Yangon',
  useStartDateForLabel = false,
}: { timeZone?: string; useStartDateForLabel?: boolean } = {}) {
  const now = new Date()
  const hourParts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hour12: false }).formatToParts(now)
  const hourStr = hourParts.find(p => p.type === 'hour')?.value ?? ''
  const endHour = parseInt(hourStr, 10)
  if (Number.isNaN(endHour)) throw new Error('Could not parse hour for the given timeZone')

  let startHour = endHour - 1
  let dateForLabel = now

  if (startHour < 0) {
    startHour = 23
    if (useStartDateForLabel) {
      const d = new Date(now)
      d.setDate(d.getDate() - 1)
      dateForLabel = d
    }
  }
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(dateForLabel).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value
    return acc
  }, {})

  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${parts.year}/${parts.month}/${parts.day} ${pad2(startHour)}:00~${pad2(endHour)}:00`
}

// Example: 'F00042'
function toFacilityCode(idx: number): string {
  return `F${String(idx).padStart(5, '0')}`
}

const facilityIdRegex = /^[A-Z0-9]{6}$/

export const eamountcheckHandler = [
  http.get(`${base}/facilities/:facilityID/energy/dashboard`, async (req) => {
    const { facilityID } = req.params as { facilityID?: string }

    // 404: missing id
    if (!facilityID) {
      const errPayload: BodyEnvelope<unknown> = {
        code: 'E0034',
        errors: [{ field: 'facilityID', code: 'E0034', message: 'facilityID is required' }],
        meta: { requestId: 'req-778899', serverTime: new Date().toISOString() },
      }
      return HttpResponse.json(errPayload, { status: 404 })
    }

    // 404: invalid format (keep consistent with frontend regex)
    if (!facilityIdRegex.test(String(facilityID))) {
      const errPayload: BodyEnvelope<unknown> = {
        code: 'E0031',
        errors: [{ field: 'facilityID', code: 'E0031', message: 'invalid facilityID format' }],
        meta: { requestId: 'req-778899', serverTime: new Date().toISOString() },
      }
      return HttpResponse.json(errPayload, { status: 404 })
    }
    if (facilityID === 'F00044') {
      const errPayload: BodyEnvelope<unknown> = {
        code: 'E0031',
        errors: [{ field: 'server', code: 'E9999', message: 'internal server error (mock)' }],
        meta: { requestId: 'req-500-err', serverTime: new Date().toISOString() },
      }
      return HttpResponse.json(errPayload, { status: 404 })
    }
        if (facilityID === 'F00053') {
      const errPayload: BodyEnvelope<unknown> = {
        code: 'E0038',
        errors: [{ field: 'server', code: 'E0038', message: 'internal server error (mock)' }],
        meta: { requestId: 'req-500-err', serverTime: new Date().toISOString() },
      }
      return HttpResponse.json(errPayload, { status: 503 })
    }
    // Special error scenarios to exercise your frontend:
    // - F00050 => 500 (CommonError route)
    // - F00097 => 503 (network-like; triggers toNetworkMessage with fallback)
    if (facilityID === 'F00050') {
      const errPayload: BodyEnvelope<unknown> = {
        code: 'E9999',
        errors: [{ field: 'server', code: 'E9999', message: 'internal server error (mock)' }],
        meta: { requestId: 'req-500-err', serverTime: new Date().toISOString() },
      }
      return HttpResponse.json(errPayload, { status: 500 })
    }
    if (facilityID === 'F00054') {
      const errPayload: BodyEnvelope<unknown> = {
        code: 'E0039',
        errors: [{ field: 'network', code: 'E0039', message: 'service unavailable (mock)' }],
        meta: { requestId: 'req-503-err', serverTime: new Date().toISOString() },
      }
      return HttpResponse.json(errPayload, { status: 504 })
    }
    const measuredTime = formatLastCompletedHourWindow({
      timeZone: 'Asia/Yangon',
      useStartDateForLabel: false,
    })

    // Build mock rows for F00000..F00099
    const items = Array.from({ length: 100 }, (_, idx) => {
      const numericId = String(idx)
      const code = toFacilityCode(idx) // F00000..F00099
      const src = buildFacilityImageUrl(numericId)

      // For testing image error handling on certain indices (e.g., every 7th)
      // Frontend: if facilityImage is { errorCode }, it shows top error via i18n.
      const facilityImage: facilityImage | { errorCode: string } = 
      idx % 7 === 0
        ? { errorCode: 'E0036' } // e.g., "file missing" → t('error.E0036', [t('facility.imageFilename')])
        : idx % 5 === 0
        ? { errorCode: 'E0035' } // choose the appropriate meaning in your i18n table
        : normalizeDto({ url: src, name: `施設画像 ${idx + 1}` });


      const row: ApiPayload = {
        facilityName: `施設 ${idx + 1}`,
        cityInfo: `所在市 ${idx + 1}`,
        measuredTime,
        totalGeneration: 9999 + idx,
        currentGeneration: (idx + 1) * 0.1,
        currentSelfUsage: (idx + 1) * 0.2,
        currentUsage: (idx + 1) * 0.4,
        todayTotalGeneration: (idx + 1) * 1.0,
        todayTotalSelfUsage: (idx + 1) * 0.4,
        todayTotalUsage: (idx + 1) * 2.2,
        facilityImage,
      }
      // NOTE: ECheck doesn't include facilityID in the schema used by your frontend.
      // If you need it, you can add it separately, but keeping parity with your ECheck.
      return { facilityID: code, row }
    })

    const found = items.find(x => x.facilityID === facilityID)
    if (!found) {
      const errPayload: BodyEnvelope<unknown> = {
        code: 'E0031',
        errors: [{ field: 'facilityID', code: 'E0031', message: 'facility not found' }],
        meta: { requestId: 'req-404-miss', serverTime: new Date().toISOString() },
      }
      return HttpResponse.json(errPayload, { status: 404 })
    }

    // 200: OK — return a plain JSON body (BodyEnvelope<ApiPayload>)
    // This matches your unwrapToDomain() and ALSO your "outer.data" access afterwards.
    const successPayload: BodyEnvelope<ApiPayload> = {
      code: 'MSG0007',
      data: found.row,
      meta: {
        requestId: 'req-778899',
        serverTime: new Date().toISOString(),
      },
    }
    //return HttpResponse.error()
    return HttpResponse.json(successPayload, { status: 200 })
  }),
]
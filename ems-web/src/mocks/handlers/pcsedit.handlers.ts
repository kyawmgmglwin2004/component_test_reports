import { http, HttpResponse } from 'msw'
import { i18n } from '../../i18n'

type ErrorCode = 'E0001' | 'E0002' | 'E0003'

interface ApiErrorItem {
  field: string
  code: ErrorCode
  meta?: { max?: number }
  message?: string
}

export type ApiPayload = {
  deviceNumber: number
  deviceID: string
  PCSNumber: number
  PCSID: string
  pcslManufacturerName?: string
  PCSModelNumber: string
  PCSInstallLocation: string
  PCSSetupDate: string
}
const base=import.meta.env.VITE_API_BASE_URL;
type EditInitResponse = { PCSInfo: ApiPayload }

// ------------- helpers -------------
function requireAuth(req: Request) {
  const auth = req.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) {
    return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }
  return null
}

function randomRequestId() {
  return 'req-' + Math.random().toString(16).slice(2, 12)
}

const isBlank = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim().length === 0)

const maxLen = (v: unknown, max: number) =>
  typeof v !== 'string' || v.trim().length <= max

function validateFacility(apiPayload: ApiPayload): ApiErrorItem[] {
  const errors: ApiErrorItem[] = []
  if (isBlank(apiPayload.PCSID)) {
    errors.push({ field: 'PCSID', code: 'E0001' })
  } else if (!maxLen(apiPayload.PCSID, 10)) {
    errors.push({ field: 'PCSID,10', code: 'E0002' })
  }
  if (isBlank(apiPayload.pcslManufacturerName)) {
    errors.push({ field: 'pcslManufacturerName', code: 'E0001' })
  } else if (!maxLen(apiPayload.pcslManufacturerName, 30)) {
    errors.push({ field: 'pcslManufacturerName,30', code: 'E0002' })
  }
  if (isBlank(apiPayload.PCSModelNumber)) {
    errors.push({ field: 'PCSModelNumber', code: 'E0001' })
  } else if (!maxLen(apiPayload.PCSModelNumber, 10)) {
    errors.push({ field: 'PCSModelNumber,10', code: 'E0002' })
  }
  if (!maxLen(apiPayload.PCSInstallLocation, 20)) {
    errors.push({ field: 'PCSInstallLocation,20', code: 'E0002' })
  }
  if (!maxLen(apiPayload.PCSSetupDate, 10)) {
    errors.push({ field: 'PCSSetupDate,10', code: 'E0002' })
  }
  return errors
}

// Optional seed for (1,1)
export const defaultEditApiPayload: ApiPayload = {
  deviceNumber: 1,
  PCSNumber: 1,
  deviceID: 'F00001-校舎A',
  PCSID: '',
  pcslManufacturerName: 'オムロン',
  PCSModelNumber: 'KPW-A48-J4',
  PCSInstallLocation: '屋外',
  PCSSetupDate: '2025/11/15',
}

// Directory to pre-fill deviceID even if record doesn’t exist
const deviceDirectory = new Map<string, string>([
  ['1-1', 'F00001-校舎A'],
  ['2-2', 'F00002-校舎B'],
  ['3-1', 'F00003-校舎C'],
])

function fallbackDeviceID(PCSNumber: number, deviceNumber: number) {
  return `F${String(deviceNumber).padStart(5, '0')}-校舎${PCSNumber}`
}

// In-memory store
const store = new Map<string, ApiPayload>()
const keyOf = (PCSNumber: number, deviceNumber: number) => `${PCSNumber}-${deviceNumber}`

// Seed example
store.set(keyOf(1, 1), { ...defaultEditApiPayload })

// shared upsert logic used by both PUT and POST

type PCSRouteParams = {
  PCSNumber: string
  deviceNumber: string
}

// 2) upsert with proper types
async function upsertPCS(
  params: PCSRouteParams,
  request: Request
): Promise<Response> {
  const unauth = requireAuth(request)
  if (unauth) return unauth

  const PCSNumber = Number(params.PCSNumber)
  const deviceNumber = Number(params.deviceNumber)
  const k = keyOf(PCSNumber, deviceNumber)

  const incoming = (await request.json()) as Partial<ApiPayload>
  const existing = store.get(k)
  const deviceID =
    incoming.deviceID ??
    existing?.deviceID ??
    deviceDirectory.get(k) ??
    fallbackDeviceID(PCSNumber, deviceNumber)

  const candidate: ApiPayload = {
    deviceNumber,
    PCSNumber,
    deviceID,
    PCSID: incoming.PCSID ?? existing?.PCSID ?? '',
    pcslManufacturerName: incoming.pcslManufacturerName ?? existing?.pcslManufacturerName ?? '',
    PCSModelNumber: incoming.PCSModelNumber ?? existing?.PCSModelNumber ?? '',
    PCSInstallLocation: incoming.PCSInstallLocation ?? existing?.PCSInstallLocation ?? '',
    PCSSetupDate: incoming.PCSSetupDate ?? existing?.PCSSetupDate ?? '',
  }

  const errors = validateFacility(candidate)
  if (errors.length > 0) {
    return HttpResponse.json(
      {
        status: '400',
        code: 'PCS_UPDATE_FAILED',
        errors,
        meta: { requestId: randomRequestId(), serverTime: new Date().toISOString() },
      },
      { status: 400 }
    )
  }

  store.set(k, candidate)
  const message = i18n.global.t('message.MSG0003')
  return HttpResponse.json({ message, PCSInfo: candidate }, { status: 200 })
}


export const pcsEditHandlers = [
  // GET init: always 200; pre-fill deviceID even if record not found
  http.get(`${base}/devices/:deviceNumber/pcs/:PCSNumber/init`, ({ params, request }) => {
    const unauth = requireAuth(request)
    if (unauth) return unauth

    const PCSNumber = Number(params.PCSNumber)
    const deviceNumber = Number(params.deviceNumber)
    const k = keyOf(PCSNumber, deviceNumber)
    const found = store.get(k)

    if (found) {
      const body: EditInitResponse = { PCSInfo: found }
      return HttpResponse.json(body, { status: 200 })
    }

    const deviceID = deviceDirectory.get(k) ?? fallbackDeviceID(PCSNumber, deviceNumber)
    const blank: EditInitResponse = {
      PCSInfo: {
        deviceNumber,
        PCSNumber,
        deviceID, // pre-filled
        PCSID: '',
        pcslManufacturerName: '',
        PCSModelNumber: '',
        PCSInstallLocation: '',
        PCSSetupDate: '',
      },
    }
    return HttpResponse.json(blank, { status: 200 })
  }),

  // PUT /pcs/:PCSNumber/:deviceNumber (upsert)
  http.put(`${base}/devices/:deviceNumber/pcs/:PCSNumber`, async ({ params, request }) =>
    upsertPCS(params as PCSRouteParams, request)
  ),

  // POST /pcs/:PCSNumber/:deviceNumber (upsert alias for clients that only have POST)

]
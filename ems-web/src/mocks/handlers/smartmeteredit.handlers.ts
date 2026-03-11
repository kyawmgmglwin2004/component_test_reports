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
  smartmeterManufacturerName?: string
  smartmeterModelNumber: string
  smartmeterInstallLocation: string
  smartmeterSetupDate: string
  updatedAt: string
}
const base=import.meta.env.VITE_API_BASE_URL;
type EditInitResponse = { SmartMeterInfo: ApiPayload }

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
  if (isBlank(apiPayload.smartmeterManufacturerName)) {
    errors.push({ field: 'smartmeterManufacturerName', code: 'E0001' })
  } else if (!maxLen(apiPayload.smartmeterManufacturerName, 30)) {
    errors.push({ field: 'smartmeterManufacturerName,30', code: 'E0002'})
  }
  if (isBlank(apiPayload.smartmeterModelNumber)) {
    errors.push({ field: 'smartmeterModelNumber', code: 'E0001' })
  } else if (!maxLen(apiPayload.smartmeterModelNumber, 10)) {
    errors.push({ field: 'smartmeterModelNumber,10', code: 'E0002' })
  }
  if (!maxLen(apiPayload.smartmeterInstallLocation, 20)) {
    errors.push({ field: 'smartmeterInstallLocation,20', code: 'E0002'})
  }
  if (!maxLen(apiPayload.smartmeterSetupDate, 10)) {
    errors.push({ field: 'smartmeterSetupDate,10', code: 'E0002' })
  }
  if (isBlank(apiPayload.updatedAt)) {
    errors.push({ field: 'updatedAt', code: 'E0001' })
  }
  return errors
}

// Optional seed for (1,1)
export const defaultEditApiPayload: ApiPayload = {
  deviceNumber: 1,
  deviceID: 'F00001-校舎A',
  smartmeterManufacturerName:' 東光東芝メータシステムズ',
  smartmeterModelNumber: ' S1SWS-TALr',
  smartmeterInstallLocation: '屋外',
  smartmeterSetupDate: '2025/11/18',
  updatedAt: '2026/01/11',
}

// Directory to pre-fill deviceID even if record doesn’t exist
// const deviceDirectory = new Map<string, string, string>([
//   ['1', 'F00001-校舎A','2026/01/11'],
//   ['2', 'F00002-校舎B','2026/02/11'],
//   ['3', 'F00003-校舎C','2026/03/11'],
// ])

const deviceIdDirectory = new Map<string, string>([
  ['1', 'F00001-校舎A'],
  ['2', 'F00002-校舎B'],
  ['3', 'F00003-校舎C'],
])

const updatedDateDirectory = new Map<string, string>([
  ['1', '2026/01/11'],
  ['2', '2026/02/11'],
  ['3', '2026/03/11'],
])


// In-memory store
const store = new Map<string, ApiPayload>()
const keyOf = (deviceNumber: number) => `${deviceNumber}`

// Seed example
store.set(keyOf(1), { ...defaultEditApiPayload })

// shared upsert logic used by both PUT and POST

type SmartMeterRouteParams = {
  deviceNumber: string
}

// 2) upsert with proper types
async function upsertSmartMeter(
  params: SmartMeterRouteParams,
  request: Request
): Promise<Response> {
  const unauth = requireAuth(request)
  if (unauth) return unauth


  const deviceNumber = Number(params.deviceNumber)
  const k = keyOf( deviceNumber)

  const incoming = (await request.json()) as Partial<ApiPayload>
  const existing = store.get(k)
  const deviceID =
    incoming.deviceID ??
    existing?.deviceID ??
    deviceIdDirectory.get(k) 

    const updatedAt = incoming.updatedAt ?? existing?.updatedAt ?? updatedDateDirectory.get(k)
    
if (!deviceID) {
  return HttpResponse.json(
    { error: `Missing deviceID for key ${String(k)}` },
    { status: 400 }
  );
}

if (!updatedAt) {
  return HttpResponse.json(
    { error: `Missing updatedAt for key ${String(k)}` },
    { status: 400 }
  );
}


  const candidate: ApiPayload = {
    deviceNumber,
    deviceID,
    smartmeterManufacturerName: incoming.smartmeterManufacturerName ?? existing?.smartmeterManufacturerName ?? '',
    smartmeterModelNumber: incoming.smartmeterModelNumber ?? existing?.smartmeterModelNumber ?? '',
    smartmeterInstallLocation: incoming.smartmeterInstallLocation ?? existing?.smartmeterInstallLocation ?? '',
    smartmeterSetupDate: incoming.smartmeterSetupDate ?? existing?.smartmeterSetupDate ?? '',
    updatedAt  }

  const errors = validateFacility(candidate)
  if (errors.length > 0) {
    return HttpResponse.json(
      {
        status: '400',
        code: 'SMARTMETER_UPDATE_FAILED',
        errors,
        meta: { requestId: randomRequestId(), serverTime: new Date().toISOString() },
      },
      { status: 400 }
    )
  }

  store.set(k, candidate)
  const message = i18n.global.t('message.MSG0025')
  return HttpResponse.json({ message, SmartMeterInfo: candidate }, { status: 200 })
}


export const smartmeterEditHandlers = [
  // GET init: always 200; pre-fill deviceID even if record not found
  http.get(`${base}/smart-meters/:id/init`, ({ params, request }) => {
    const unauth = requireAuth(request)
    if (unauth) return unauth

    const deviceNumber = Number(params.id)
    const k = keyOf(deviceNumber)
    const found = store.get(k)

    if (found) {
      const body: EditInitResponse = { SmartMeterInfo: found }
      return HttpResponse.json(body, { status: 200 })
    }

    const deviceID = deviceIdDirectory.get(k) 
    const updatedAt = updatedDateDirectory.get(k)
    
if (!deviceID) {
  return HttpResponse.json(
    { error: `Missing deviceID for key ${String(k)}` },
    { status: 400 }
  );
}

if (!updatedAt) {
  return HttpResponse.json(
    { error: `Missing updatedAt for key ${String(k)}` },
    { status: 400 }
  );
}

    const blank: EditInitResponse = {
      SmartMeterInfo: {
        deviceNumber,
        deviceID, // pre-filled
        smartmeterManufacturerName: '',
        smartmeterModelNumber: '',
        smartmeterInstallLocation: '',
        smartmeterSetupDate: '',
        updatedAt,
      },
    }
    return HttpResponse.json(blank, { status: 200 })
  }),

 
  http.put(`${base}/smart-meters/:id`, async ({ params, request }) =>
    upsertSmartMeter(params as SmartMeterRouteParams, request)
  ),

]
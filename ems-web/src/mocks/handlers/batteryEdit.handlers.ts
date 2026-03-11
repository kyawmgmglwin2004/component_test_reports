import { http, HttpResponse } from 'msw'
import { i18n } from '../../i18n'

/** ---------------- Types (MUST MATCH useBatteryEdit.ts) ---------------- */
type ErrorCode = 'E0001' | 'E0002' | 'E0003' | 'E0015' | 'E0004'

const base=import.meta.env.VITE_API_BASE_URL;

interface ApiErrorItem {
  field: string
  code: ErrorCode
  meta?: Record<string, unknown>
}

export type BatteryApiPayload = {
  deviceID: string
  deviceNumber: number
  storageBatteryManufactureName: string
  storageBatteryModelNumber: string
  storageCapacityKwhPerH: number | null
  charageKwhPerH: number | null
  dischargePerKwhH: number | null
  installationLocation: string
  storageBatterySetupDate: string
}

type EditInitResponse = {
  Battery: BatteryApiPayload
}

/** ---------------- Helpers ---------------- */
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
  v === undefined ||
  v === null ||
  (typeof v === 'string' && v.trim().length === 0)

const maxLen = (v: unknown, max: number) =>
  typeof v !== 'string' || v.trim().length <= max

const isDigitsOnlyString = (v: unknown) => {
  if (typeof v !== 'string') return false
  const s = v.trim()
  return s.length > 0 && /^\d+$/.test(s)
}

const isNonNegativeNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0

/** YYYY/MM/DD format + real date check */
// function isValidYmd(s: string): boolean {
//   const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(String(s ?? '').trim())
//   if (!m) return false
//   const year = Number(m[1])
//   const month = Number(m[2])
//   const day = Number(m[3])
//   if (month < 1 || month > 12) return false
//   const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
//   const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
//   const maxDay = daysInMonth[month - 1]
//   return day >= 1 
// }

/** ---------------- Validation (field names MUST MATCH composable) ---------------- */
function validateBattery(payload: BatteryApiPayload): ApiErrorItem[] {
  const errors: ApiErrorItem[] = []
  // deviceID (optional, max 20)
  if (!maxLen(payload.deviceID, 20)) {
    errors.push({ field: 'deviceID', code: 'E0002', meta: { max: 20 } })
  }

  // storageBatteryManufactureName (required, max 30, not digits-only)
  if (isBlank(payload.storageBatteryManufactureName)) {
    errors.push({ field: 'storageBatteryManufactureName', code: 'E0001' })
  } else if (isDigitsOnlyString(payload.storageBatteryManufactureName)) {
    errors.push({ field: 'storageBatteryManufactureName', code: 'E0003', meta: { expected: '文字列' } })
  } else if (!maxLen(payload.storageBatteryManufactureName, 30)) {
    errors.push({ field: 'storageBatteryManufactureName', code: 'E0002', meta: { max: 30 } })
  }

  // storageBatteryModelNumber (required, max 30, not digits-only)
  if (isBlank(payload.storageBatteryModelNumber)) {
    errors.push({ field: 'storageBatteryModelNumber', code: 'E0001' })
  } else if (isDigitsOnlyString(payload.storageBatteryModelNumber)) {
    errors.push({ field: 'storageBatteryModelNumber', code: 'E0003', meta: { expected: '文字列' } })
  } else if (!maxLen(payload.storageBatteryModelNumber, 30)) {
    errors.push({ field: 'storageBatteryModelNumber', code: 'E0002', meta: { max: 30 } })
  }
  // Numeric required fields (accept decimals, non-negative)
  // if (payload.storageCapacityKwhPerH == null || !isNonNegativeNumber(payload.storageCapacityKwhPerH)) {
  //   // If you prefer "required" over "type error" for null/blank, keep E0001
  //   errors.push({
  //     field: 'storageCapacityKwhPerH',
  //     code: payload.storageCapacityKwhPerH == null ? 'E0001' : 'E0003',
  //     meta: payload.storageCapacityKwhPerH == null ? undefined : { expected: '数字' },
  //   })
  // }
  if (payload.charageKwhPerH == null || !isNonNegativeNumber(payload.charageKwhPerH)) {
    errors.push({
      field: 'charageKwhPerH',
      code: payload.charageKwhPerH == null ? 'E0001' : 'E0003',
      meta: payload.charageKwhPerH == null ? undefined : { expected: '数字' },
    })
  }

  if (payload.dischargePerKwhH == null || !isNonNegativeNumber(payload.dischargePerKwhH)) {
    errors.push({
      field: 'dischargePerKwhH',
      code: payload.dischargePerKwhH == null ? 'E0001' : 'E0003',
      meta: payload.dischargePerKwhH == null ? undefined : { expected: '数字' },
    })
  }

  // installationLocation (required string, not digits-only, max 20)
  if (!isBlank(payload.installationLocation)) {
    errors.push({ field: 'installationLocation', code: 'E0001' })
  } else if (isDigitsOnlyString(payload.installationLocation)) {
    errors.push({ field: 'installationLocation', code: 'E0003', meta: { expected: '文字列' } })
  } else if (!maxLen(payload.installationLocation, 20)) {
    errors.push({ field: 'installationLocation', code: 'E0002', meta: { max: 20 } })
  }
  // storageBatterySetupDate (required + YYYY/MM/DD format)
  if (isBlank(payload.storageBatterySetupDate)) {
    errors.push({ field: 'storageBatterySetupDate', code: 'E0001' })
  } 
  return errors
}

/** ---------------- Default initial data (INIT) ---------------- */
export const defaultBatteryEditApiPayload: BatteryApiPayload = {
  deviceNumber: 1,
  deviceID: 'F00001-校舎A',
  storageBatteryManufactureName: '長州産業',
  storageBatteryModelNumber: 'CB-LMP98A2',
  storageCapacityKwhPerH: 9.8,
  charageKwhPerH: 4.0,
  dischargePerKwhH: 2.0,
  installationLocation: '屋外',
  storageBatterySetupDate: '2025/11/01',
}

export function createDefaultBatteryEditApiPayload(
  overrides: Partial<BatteryApiPayload> = {}
): BatteryApiPayload {
  return { ...defaultBatteryEditApiPayload, ...overrides }
}

/** ---------------- MSW handlers (MATCH useBatteryEdit.ts URLs) ---------------- */
export const batteryEditHandlers = [
  // INIT: GET /batteries/:deviceNumber/init (relative URL so MSW intercepts)
  http.get(`${base}/batteries/:deviceNumber/init`, ({ request, params }) => {
    const unauth = requireAuth(request)
    if (unauth) return unauth

    const deviceNumber = Number(params.deviceNumber ?? 1)
    const payload = createDefaultBatteryEditApiPayload({ deviceNumber })
    const body: EditInitResponse = { Battery: payload }
    return HttpResponse.json(body, { status: 200 })
  }),

  // UPDATE: PUT /batteries/:deviceNumber (relative URL so MSW intercepts)
  http.put('/batteries/:deviceNumber', async ({ request }) => {
    const unauth = requireAuth(request)
    if (unauth) return unauth

    const body = (await request.json()) as BatteryApiPayload

    const errors = validateBattery(body)
    if (errors.length > 0) {
      return HttpResponse.json(
        {
          status: '400',
          code: 'FACILITY_UPDATE_VALIDATION_FAILED',
          errors,
          meta: { requestId: randomRequestId(), serverTime: new Date().toISOString() },
        },
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    const message = i18n.global.t('message.facilityRegistered')
    return HttpResponse.json(
      {
        message,
        facility: { ...body },
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }),
]
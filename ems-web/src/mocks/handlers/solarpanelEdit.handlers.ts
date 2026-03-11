import { http, HttpResponse } from 'msw'
import { i18n } from '../../i18n'


type ErrorCode =
  | 'E0001'
  | 'E0002'
  | 'E0003'
  | 'E0015'
  | 'E0004'

interface ApiErrorItem {
  field: string
  code: ErrorCode
  meta?: Record<string, unknown> 
}

export type ApiPayload = {
solarPanelNumber: number
deviceNumber: number 
  deviceID: string
  solarPanelID?: string
  panelManufacturerName: string
  panelModelNumber: string
  panelRatedPower: number
  panelTiltAngleDegree: number
  panelDirection: string
  panelSurfaceArea: number
  panleInstallLocation: string
  panelSetupDate: string

}


// INIT response type
type EditInitResponse = {
  Solarpanel: ApiPayload
}

// ---------------- Helpers ----------------
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

/** pure number string allows decimals: "123" or "123.4" */
const isPureNumberString = (v: unknown) => {
  if (typeof v !== 'string') return false
  const s = v.trim()
  return s.length > 0 && /^\d+(\.\d+)?$/.test(s)
}

const isNonNegativeInteger = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0

const digitLen = (n: number) => String(Math.abs(n)).length

const isHalfWidthAlnumHyphen = (v: unknown) => {
  if (typeof v !== 'string') return false
  return /^[A-Za-z0-9-]+$/.test(v.trim())
}

const isAngle0to90 = (v: unknown) =>
  isNonNegativeInteger(v) && v >= 0 && v <= 90

/** ---------------- Validation (MATCH your composable rules) ---------------- */
function validatesolarpanel(payload: ApiPayload): ApiErrorItem[] {
  const errors: ApiErrorItem[] = []

  // solarPanelID: required, max 10, not pure number
  if (isBlank(payload.solarPanelID)) {
    errors.push({ field: 'solarPanelID', code: 'E0001' })
  } else if (isPureNumberString(payload.solarPanelID)) {
    errors.push({ field: 'solarPanelID', code: 'E0003', meta: { expected: '文字列' } })
  } else if (!maxLen(payload.solarPanelID, 10)) {
    errors.push({ field: 'solarPanelID', code: 'E0002', meta: { max: 10 } })
  }

  // panelManufacturerName: required, max 30, not pure number
  if (isBlank(payload.panelManufacturerName)) {
    errors.push({ field: 'panelManufacturerName', code: 'E0001' })
  } else if (isPureNumberString(payload.panelManufacturerName)) {
    errors.push({
      field: 'panelManufacturerName',
      code: 'E0003',
      meta: { expected: '文字列' },
    })
  } else if (!maxLen(payload.panelManufacturerName, 30)) {
    errors.push({ field: 'panelManufacturerName', code: 'E0002', meta: { max: 30 } })
  }

  // panelModelNumber: required, max 10, halfwidth only (A-Z a-z 0-9 -)
  if (isBlank(payload.panelModelNumber)) {
    errors.push({ field: 'panelModelNumber', code: 'E0001' })
  } else if (!isHalfWidthAlnumHyphen(payload.panelModelNumber)) {
    errors.push({
      field: 'panelModelNumber',
      code: 'E0003',
      meta: { expected: '半角英数字' },
    })
  } else if (!maxLen(payload.panelModelNumber, 10)) {
    errors.push({ field: 'panelModelNumber', code: 'E0002', meta: { max: 10 } })
  }

  // panelRatedPower: required, integer, max 3 digits
  if (payload.panelRatedPower == null) {
    errors.push({ field: 'panelRatedPower', code: 'E0001' })
  } else if (!isNonNegativeInteger(payload.panelRatedPower)) {
    errors.push({ field: 'panelRatedPower', code: 'E0003', meta: { expected: '数字' } })
  } else if (digitLen(payload.panelRatedPower) > 3) {
    errors.push({ field: 'panelRatedPower', code: 'E0002', meta: { max: 3 } })
  }
  // panelTiltAngleDegree: required, integer, 0..90
  if (payload.panelTiltAngleDegree == null) {
    errors.push({ field: 'panelTiltAngleDegree', code: 'E0001' })
  } else if (!isNonNegativeInteger(payload.panelTiltAngleDegree)) {
    errors.push({ field: 'panelTiltAngleDegree', code: 'E0003', meta: { expected: '数字' } })
  } else if (!isAngle0to90(payload.panelTiltAngleDegree)) {
    errors.push({
      field: 'panelTiltAngleDegree',
      code: 'E0015',
      meta: { min: 0, max: 90 },
    })
  }

  // panelDirection: required, max 10, not pure number
  if (isBlank(payload.panelDirection)) {
    errors.push({ field: 'panelDirection', code: 'E0001' })
  } else if (isPureNumberString(payload.panelDirection)) {
    errors.push({ field: 'panelDirection', code: 'E0003', meta: { expected: '文字列' } })
  } else if (!maxLen(payload.panelDirection, 10)) {
    errors.push({ field: 'panelDirection', code: 'E0002', meta: { max: 10 } })
  }

  // panelSurfaceArea: required, integer, max 10 digits
  if (payload.panelSurfaceArea == null) {
    errors.push({ field: 'panelSurfaceArea', code: 'E0001' })
  } else if (!isNonNegativeInteger(payload.panelSurfaceArea)) {
    errors.push({ field: 'panelSurfaceArea', code: 'E0003', meta: { expected: '数字' } })
  } else if (digitLen(payload.panelSurfaceArea) > 10) {
    errors.push({ field: 'panelSurfaceArea', code: 'E0002', meta: { max: 10 } })
  }

  // panleInstallLocation: optional, max 20, not pure number
  if (!isBlank(payload.panleInstallLocation)) {
    if (isPureNumberString(payload.panleInstallLocation)) {
      errors.push({
        field: 'panleInstallLocation',
        code: 'E0003',
        meta: { expected: '文字列' },
      })
    } else if (!maxLen(payload.panleInstallLocation, 20)) {
      errors.push({ field: 'panleInstallLocation', code: 'E0002', meta: { max: 20 } })
    }
  }

  // panelSetupDate: optional, max 10, must be valid YYYY/MM/DD
  if (!isBlank(payload.panelSetupDate)) {
    if (!maxLen(payload.panelSetupDate, 10)) {
      errors.push({ field: 'panelSetupDate', code: 'E0002', meta: { max: 10 } })
    } 
  }
  return errors
}

// ---------------- Default initial data (for INIT) ----------------
export const defaultEditApiPayload: ApiPayload = {
solarPanelNumber: 2,
deviceNumber : 1,
  deviceID: 'F00001-校舎A',
  solarPanelID: '',
  panelManufacturerName: 'シャープ　',
  panelModelNumber: ' NQ-241BP',
  panelRatedPower: 241,
  panelTiltAngleDegree: 34,
  panelDirection: 'Yangon',
  panelSurfaceArea: 345,
  panleInstallLocation: '屋上',
  panelSetupDate: ' 2025/11/01',
}
export function createDefaultEditApiPayload(overrides: Partial<ApiPayload> = {}): ApiPayload {
  return { ...defaultEditApiPayload, ...overrides }
}

export const solarPanelEditHandlers = [
  http.get('https://hknfu2joxa.execute-api.ap-northeast-1.amazonaws.com/solar-panels/:solarPanelNumber/:deviceNumber/init', ({ request }) => {
    const unauth = requireAuth(request)
    if (unauth) return unauth
    const body: EditInitResponse = {
      Solarpanel: defaultEditApiPayload, // ✅ initial all fields
    }
    return HttpResponse.json(body, { status: 200 })
  }),

  //  EDIT (POST) - behaves like register POST but updates
  http.put('https://hknfu2joxa.execute-api.ap-northeast-1.amazonaws.com/solar-panels/:solarPanelNumber/:deviceNumber', async ({ request }) => {
    const unauth = requireAuth(request)
    if (unauth) return unauth

    const body = (await request.json()) as ApiPayload

    const errors = validatesolarpanel(body)
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
    // Echo back updated entity (same pattern as register)
    return HttpResponse.json(
      {
        message,
        facility: {
          ...body,
        },
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
import { http, HttpResponse } from 'msw'

/** ----------------------------
 *  Utilities
 *  ---------------------------- */

/** Random integer: inclusive min, exclusive max */
function rand(min = 100_000, max = 1_000_000) {
  return Math.floor(Math.random() * (max - min)) + min
}

/** Helpers */
function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate()
}
function toLocalDate(dateStr?: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}
function sameYMD(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

/** Envelope helpers */
function genRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Return a real HTTP 200, but also mirror statusCode in body/header
 */
function ok<T>(data: T, message = 'OK') {
  const body = { code: 'MSG0019', message, data, request_id: genRequestId(), statusCode: 200 }
  return HttpResponse.json(body, {
    status: 200,
     headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
  })
}

/**
 * Return a real HTTP error, plus mirror statusCode in body/header
 */
function fail(code: number, message: string, status = 400, data = null) {
  const body = { code, message, data, request_id: genRequestId(), statusCode: status }
  return HttpResponse.json(body, {
    status,
    headers: {
      'x-status-code': String(status), // optional mirror
    },
  })
}

/** ----------------------------
 *  Generators
 *  ---------------------------- */

function generateHourlyForDate(target: Date, now = new Date(), full = false) {
  // "00" ~ "23"
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')) // <-- FIXED

  const isToday = sameYMD(target, now)
  const cutoff = full ? 23 : (isToday ? now.getHours() : 23)

  const generated = Array.from({ length: 24 }, (_, i) => (i <= cutoff ? rand() : 0))
  const consumed  = Array.from({ length: 24 }, (_, i) => (i <= cutoff ? rand() : 0))
  const used      = Array.from({ length: 24 }, (_, i) => (i <= cutoff ? rand() : 0))

  return { hours, generated, consumed, used, cutoffHour: cutoff }
}

function generateDailyForMonth(year: number, month1to12: number, now = new Date(), full = false) {
  const lastDay = daysInMonth(year, month1to12)
  const categories = Array.from({ length: lastDay }, (_, i) => String(i + 1))
  const isCurrentMonth = year === now.getFullYear() && month1to12 === (now.getMonth() + 1)
  const cutoffDay = full ? lastDay : (isCurrentMonth ? now.getDate() : lastDay)

  const generated = categories.map((_, i) => (i + 1) <= cutoffDay ? rand() : 0)
  const consumed  = categories.map((_, i) => (i + 1) <= cutoffDay ? rand() : 0)
  const used      = categories.map((_, i) => (i + 1) <= cutoffDay ? rand() : 0)

  return { categories, generated, consumed, used, lastDay, cutoffDay }
}

function generateMonthlyForYear(year: number, now = new Date(), full = false) {
  const categories = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const isCurrentYear = year === now.getFullYear()
  const cutoffMonth = full ? 12 : (isCurrentYear ? (now.getMonth() + 1) : 12)

  const generated = categories.map((_, i) => (i + 1) <= cutoffMonth ? rand() : 0)
  const consumed  = categories.map((_, i) => (i + 1) <= cutoffMonth ? rand() : 0)
  const used      = categories.map((_, i) => (i + 1) <= cutoffMonth ? rand() : 0)

  return { categories, generated, consumed, used, cutoffMonth }
}

/** Common y-axis metadata */
const COMMON_UNITS = 'kWh'
const COMMON_RANGE = { min: 100_000, max: 1_000_000 }

/** ----------------------------
 *  Builders
 *  ---------------------------- */

function buildHourlyPayload(url: URL) {
  const dateStr = url.searchParams.get('date') // YYYY-MM-DD
  const full = (url.searchParams.get('full') ?? 'false').toLowerCase() === 'true'
  const hstart = url.searchParams.get('hstart')
  const hend = url.searchParams.get('hend')

  const target = toLocalDate(dateStr) ?? new Date()
  const data = generateHourlyForDate(target, new Date(), full)

  let viewStart = 0
  let viewEnd = data.cutoffHour

  if (hstart && hend) {
    const s = parseInt(hstart, 10)
    const e = parseInt(hend, 10)
    if (isNaN(s) || isNaN(e)) return fail(400, 'hstart/hend must be integers (0..23)', 400)
    if (e < s) return fail(400, 'hend must be ≥ hstart', 400)
    viewStart = Math.max(0, Math.min(23, s))
    viewEnd = Math.max(0, Math.min(23, e))
  }

  const si = viewStart
  const ei = viewEnd

  const categories = data.hours.slice(si, ei + 1)
  const series = [
    { name: 'soldEnergy', data: data.generated.slice(si, ei + 1) },
    { name: 'selfUsage', data: data.consumed.slice(si, ei + 1) },
    { name: 'usage', data: data.used.slice(si, ei + 1) },
  ]

  return { categories, series, units: COMMON_UNITS, range: COMMON_RANGE }
}

function buildDailyPayload(url: URL) {
  const monthStrRaw = url.searchParams.get('month') // "YYYY-MM"
  const full   = (url.searchParams.get('full') ?? 'false').toLowerCase() === 'true'
  let dstart   = url.searchParams.get('dstart') // "1"..lastDay
  let dend     = url.searchParams.get('dend')   // "1"..lastDay

  const startStr = url.searchParams.get('start') // YYYY-MM-DD
  const endStr   = url.searchParams.get('end')

  const now = new Date()
  let year = now.getFullYear()
  let month1to12 = now.getMonth() + 1

  if (startStr && endStr) {
    const s = toLocalDate(startStr)
    const e = toLocalDate(endStr)
    if (!s || !e) return fail(400, 'start/end must be valid YYYY-MM-DD', 400)
    if (s.getFullYear() !== e.getFullYear() || s.getMonth() !== e.getMonth()) {
      return fail(400, 'start/end must be in the same month for daily view', 400)
    }
    year = s.getFullYear()
    month1to12 = s.getMonth() + 1
    dstart = String(s.getDate())
    dend   = String(e.getDate())
  } else if (typeof monthStrRaw === 'string' && monthStrRaw.length > 0) {
    const m = /^(\d{4})-(\d{2})$/.exec(monthStrRaw)
    if (m?.[1] && m?.[2]) {
      const y = parseInt(m[1], 10)
      const mm = parseInt(m[2], 10)
      if (!isNaN(y) && !isNaN(mm) && mm >= 1 && mm <= 12) {
        year = y
        month1to12 = mm
      }
    }
  }

  const day = generateDailyForMonth(year, month1to12, now, full)

  let viewStart = 1
  let viewEnd = day.cutoffDay
  if (dstart && dend) {
    const s = parseInt(dstart, 10)
    const e = parseInt(dend, 10)
    if (isNaN(s) || isNaN(e)) return fail(400, 'dstart/dend must be integers (1..lastDay)', 400)
    if (e < s) return fail(400, 'dend must be >= dstart', 400)
    viewStart = Math.max(1, Math.min(day.lastDay, s))
    viewEnd   = Math.max(1, Math.min(day.lastDay, e))
  }

  const si = viewStart - 1
  const ei = viewEnd - 1

  const categories = day.categories.slice(si, ei + 1)
  const series = [
    { name: 'soldEnergy', data: day.generated.slice(si, ei + 1) },
    { name: 'selfUsage', data: day.consumed.slice(si, ei + 1) },
    { name: 'usage', data: day.used.slice(si, ei + 1) },
  ]

  return { categories, series, units: COMMON_UNITS, range: COMMON_RANGE }
}

function buildMonthlyPayload(url: URL) {
  const yearStr = url.searchParams.get('year') // YYYY
  const full    = (url.searchParams.get('full') ?? 'false').toLowerCase() === 'true'
  let mstart    = url.searchParams.get('mstart')
  let mend      = url.searchParams.get('mend')

  const startStr = url.searchParams.get('start')
  const endStr   = url.searchParams.get('end')

  const now = new Date()
  let year = new Date().getFullYear()

  if (startStr && endStr) {
    const s = toLocalDate(startStr)
    const e = toLocalDate(endStr)
    if (!s || !e) return fail(400, 'start/end must be valid dates', 400)
    if (s.getFullYear() !== e.getFullYear()) return fail(400, 'start/end must be in the same year for monthly view', 400)
    year = s.getFullYear()
    mstart = String(s.getMonth() + 1)
    mend   = String(e.getMonth() + 1)
  } else if (yearStr) {
    const y = parseInt(yearStr, 10)
    year = isNaN(y) ? now.getFullYear() : y
  }

  const month = generateMonthlyForYear(year, now, full)

  let viewStart = 1
  let viewEnd = month.cutoffMonth
  if (mstart && mend) {
    const s = parseInt(mstart, 10)
    const e = parseInt(mend, 10)
    if (isNaN(s) || isNaN(e)) return fail(400, 'mstart/mend must be integers (1..12)', 400)
    if (e < s) return fail(400, 'mend must be >= mstart', 400)
    viewStart = Math.max(1, Math.min(12, s))
    viewEnd   = Math.max(1, Math.min(12, e))
  }

  const si = viewStart - 1
  const ei = viewEnd - 1

  const categories = month.categories.slice(si, ei + 1)
  const series = [
    { name: 'soldEnergy', data: month.generated.slice(si, ei + 1) },
    { name: 'selfUsage', data: month.consumed.slice(si, ei + 1) },
    { name: 'usage', data: month.used.slice(si, ei + 1) },
  ]

  return { categories, series, units: COMMON_UNITS, range: COMMON_RANGE }
}

/** ----------------------------
 *  Handlers
 *  ---------------------------- */

const base = import.meta.env.VITE_API_BASE_URL

function formatDateLocalYMD(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const todayYMD = formatDateLocalYMD()
function formatMonthLocalYM(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}
function thisYear(): number {
  return new Date().getFullYear()
}

function isYMD(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}
function isYM(s: unknown): s is string {
  // If you want both YYYY/MM and YYYY-MM, use: /^\d{4}[-/]\d{1,2}$/
  return typeof s === 'string' && /^\d{4}-\d{1,2}$/.test(s)
}
function isYYYY(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}$/.test(s)
}

function getFacilityNameById(id: string | undefined): string {
  if (!id) return ''
  const map: Record<string, string> = {
    '1': '札幌第一発電所',
    '2': '東京第ニ発電所',
    'demo': 'デモ施設',
  }
  return map[id] ?? `施設 ${id}`
}

export const ChartHandlers = [
  http.get(`${base}/facilities/:id/energy`, ({ request, params }) => {
    const facilityID = params.id as string | undefined
    const facilityName = getFacilityNameById(facilityID)
    const url = new URL(request.url)
    const flag = url.searchParams.get('flag') // 0 = hourly, 1 = daily, 2 = monthly

    if (!facilityID) return fail(404, 'facilityID missing', 404)
    if (facilityID === 'F00044') return fail(404, 'facilityID missing', 404)
      if (facilityID === 'F00050') return fail(404, 'facilityID missing', 500)
        if (facilityID === 'F00054') return fail(404, 'facilityID missing', 504)
          if (facilityID === 'F00053') return fail(404, 'facilityID missing', 503)

    switch (flag) {
      case '0': {
        let date = url.searchParams.get('date')
        if (!date) {
          const selectedDay = url.searchParams.get('selDate')
          if (isYMD(selectedDay)) date = selectedDay
        }
        if (!date) date = todayYMD
        url.searchParams.set('date', date)

        const payloadOrResp = buildHourlyPayload(url)
        if (payloadOrResp instanceof Response) return payloadOrResp
        return ok({ facilityName, ...payloadOrResp })
      }

      case '1': {
        let month = url.searchParams.get('month') ?? url.searchParams.get('selMonth')
        if (!month) {
          const selectedMonth = url.searchParams.get('selMonth') // "YYYY/MM" comment—see isYM if needed
          if (isYM(selectedMonth)) {

const parts = selectedMonth.split('/', 2);
  if (parts.length === 2) {
    const [y, m] = parts as [string, string]; // tuple assert after length check
    month = `${y}-${String(parseInt(m, 10)).padStart(2, '0')}`;
  }

          }
        }
        if (!month) month = formatMonthLocalYM()
        url.searchParams.set('month', month)

        const payloadOrResp = buildDailyPayload(url)
        if (payloadOrResp instanceof Response) return payloadOrResp
        return ok({ facilityName, ...payloadOrResp })
      }

      case '2': {
        const startMonthRaw = url.searchParams.get('startMonth') // "YYYY/MM" by comment
        const endMonthRaw   = url.searchParams.get('endMonth')

        if (isYM(startMonthRaw) && isYM(endMonthRaw)) {
          const sy = (startMonthRaw as string).slice(0, 4)
          const ey = (endMonthRaw as string).slice(0, 4)
          const sm = parseInt((startMonthRaw as string).slice(5), 10)
          const em = parseInt((endMonthRaw as string).slice(5), 10)

          if (sy !== ey) return fail(400, "'startMonth' and 'endMonth' must be in the same year (YYYY)", 400)
          if (Number.isNaN(sm) || Number.isNaN(em) || sm < 1 || sm > 12 || em < 1 || em > 12)
            return fail(400, 'Invalid month numbers (must be 1..12 or 01..12)', 400)
          if (em < sm) return fail(400, "'endMonth' must be >= 'startMonth'", 400)

          url.searchParams.set('year', sy)
          url.searchParams.set('mstart', String(sm))
          url.searchParams.set('mend', String(em))

          const payloadOrResp = buildMonthlyPayload(url)
          if (payloadOrResp instanceof Response) return payloadOrResp
          return ok({ facilityName, ...payloadOrResp })
        }

        const startRaw = url.searchParams.get('start') // "YYYY-MM"
        const endRaw   = url.searchParams.get('end')
        const yearRaw  = url.searchParams.get('year')

        if (typeof startRaw === 'string' && /^\d{4}-\d{2}$/.test(startRaw)
          && typeof endRaw === 'string' && /^\d{4}-\d{2}$/.test(endRaw)) {

          if (startRaw.slice(0, 4) !== endRaw.slice(0, 4))
            return fail(400, "'start' and 'end' must be in the same year (YYYY)", 400)

          const year = startRaw.slice(0, 4)
          const mstart = parseInt(startRaw.slice(5, 7), 10)
          const mend   = parseInt(endRaw.slice(5, 7), 10)
          if (Number.isNaN(mstart) || Number.isNaN(mend)) return fail(400, 'Invalid month numbers', 400)

          url.searchParams.set('year', year)
          url.searchParams.set('mstart', String(mstart))
          url.searchParams.set('mend', String(mend))

          const payloadOrResp = buildMonthlyPayload(url)
          if (payloadOrResp instanceof Response) return payloadOrResp
          return ok({ facilityName, ...payloadOrResp })
        }

        if (isYYYY(yearRaw)) {
          url.searchParams.set('year', yearRaw!)
          const payloadOrResp = buildMonthlyPayload(url)
          if (payloadOrResp instanceof Response) return payloadOrResp
          return ok({ facilityName, ...payloadOrResp })
        }

        url.searchParams.set('year', String(thisYear()))
        const payloadOrResp = buildMonthlyPayload(url)
        if (payloadOrResp instanceof Response) return payloadOrResp
        return ok({ facilityName, ...payloadOrResp })
      }

      default:
        return fail(400, 'Invalid flag. Use ?flag=0|1|2', 400)
    }
  }),
]
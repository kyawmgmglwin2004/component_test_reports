import { describe, test, expect, vi, beforeEach, afterAll, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { useFacilityHistory } from '../ElectricityCheckHistory/ElectricityCheckHistory'
import { apiGet } from '@/services/http'
import { useRouter } from 'vue-router'
import { useNotFoundScreenProps } from '@/pages/Common/composables/NotFoundScreen'
import type ApexCharts from 'apexcharts'
import type { ApexOptions } from 'apexcharts'
import type { Mock } from 'vitest'

import { reactive } from 'vue'

const routeParams = reactive<{ facilityID?: string }>({ facilityID: 'FBC123' })

vi.mock('vue-router', () => {
  const push = vi.fn()
  return {
    useRouter: () => ({ push }),
    useRoute: () => ({
      fullPath: '/facilities/FYZ123',
      params: routeParams, 
    }),
  }
})

const fixed = new Date('2026-03-09T00:00:00.000Z')
vi.useFakeTimers()
vi.setSystemTime(fixed)


vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  cb(performance.now())
  return 0 as unknown as number
})
vi.stubGlobal('cancelAnimationFrame', () => {})
const originalGetComputedStyle = global.getComputedStyle
vi.stubGlobal('getComputedStyle', (el: Element) => {
  const s = originalGetComputedStyle(el)
  return new Proxy(s, {
    get(target, prop) {
      if (prop === 'display') return 'block'
      if (prop === 'visibility') return 'visible'
      if (prop === 'opacity') return '1'
      return Reflect.get(target, prop)
    }
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

afterAll(() => {
  vi.useRealTimers()
})
// Mock router
vi.mock('vue-router', () => {
  const push = vi.fn()
  return {
    useRouter: () => ({ push }),
    useRoute: () => ({ fullPath: '/facilities/FYZ123', params: { facilityID: 'FBC123' } }),
  }
})

// Mock i18n
vi.mock('vue-i18n', () => {
  type TOptions = { default?: string };
  type TValueMap = Record<string, unknown>;

  return {
    useI18n: () => ({
      // keep only what your tests need
      t: (key: string, _values?: TValueMap, options: TOptions = {}): string =>
        options.default ?? key,
    }),
  };
});

// Mock GlobalLoading
vi.mock('@/pages/Common/composables/GlobalLoading', () => ({
  useGlobalLoading: () => ({ show: vi.fn(), hide: vi.fn() }),
}))


const openWith = vi.fn()

vi.mock('@/pages/Common/composables/NotFoundScreen', () => ({
  useNotFoundScreenProps: () => ({ openWith }),
}))

export { openWith }


// Mock API
vi.mock('@/services/http', () => ({
  apiGet: vi.fn(),
}))

// Mock VueApexCharts component (so <apexchart> ref exists)
vi.mock('vue3-apexcharts', () => {
  const VueApexCharts = {}
  return { default: VueApexCharts }
})

// We don't import ApexCharts runtime; we inject a fake via apexRef.value in tests
vi.mocked(apiGet)

function toHTMLElement(
  el: Element | import('vue').ComponentPublicInstance | null
): HTMLElement | null {
  // Direct DOM element
  if (el instanceof HTMLElement) return el
  // Vue component instance wrapping a DOM element
  if (el && typeof el === 'object' && '$el' in el) {
    const root = (el).$el
    return root instanceof HTMLElement ? root : null
  }
  return null
}

function makeHost(facilityID = 'FBC123') {
  let api: ReturnType<typeof useFacilityHistory> | null = null

  const Host = defineComponent({
    name: 'HostUseFacilityHistory',
    setup() {
      api = useFacilityHistory(facilityID)

      return () =>
        h('div', { id: 'root' }, [
          h(
            'div',
            {
              class: 'chart-root',
              ref: (el) => {
                api!.chartRoot.value = toHTMLElement(el)
              },
            },
            [
              h('div', {
                class: 'y-gutter',
                ref: (el) => {
                  api!.yStickyEl.value = toHTMLElement(el)
                },
              }),
            ]
          ),
        ])
    },
  })

  const wrapper = mount(Host)
  return { wrapper, api: () => api! }
}


type FakeApexComponent = {
  chart: ApexCharts
  updateSeries: Mock<(...args: unknown[]) => Promise<void>>
  updateOptions: Mock<
    (opts: ApexOptions, redraw?: boolean, animate?: boolean) => Promise<void>
  >
}



export function attachApex(
  api: ReturnType<typeof useFacilityHistory>,
  overrides?: Partial<FakeApexComponent>
) {
  const updateSeries =
    overrides?.updateSeries ??
    vi.fn<(..._args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)

  const updateOptions =
    overrides?.updateOptions ??
    vi.fn<(opts: ApexOptions, redraw?: boolean, animate?: boolean) => Promise<void>>()
      .mockResolvedValue(undefined)

  const chartRuntime = {
    w: { globals: { yAxisScale: [{ min: 0, max: 100 }], minY: 0, maxY: 100 } },
  }

  const fake: FakeApexComponent = {
    chart: chartRuntime as unknown as ApexCharts,
    updateSeries,
    updateOptions,
  }

  // 🔐 Protect the ref so Vue can't overwrite it during mount/update
  Object.defineProperty(api.apexRef, 'value', {
    get() { return fake },
    set() { /* ignore Vue overwrites */ },
    configurable: true,
  })

  return { updateSeries, updateOptions, chartRuntime }
}

function setGridDom(api: ReturnType<typeof useFacilityHistory>, opts?: { interior: number }) {
  // Build the DOM structure required for syncYAxis to find elements
  const root = api.chartRoot.value as HTMLElement
  const gutter = api.yStickyEl.value as HTMLElement
  expect(root).toBeTruthy()
  expect(gutter).toBeTruthy()

  root.innerHTML = `
    <svg class="apexcharts-grid-borders">
      <line x1="0" y1="0" x2="100" y2="0"></line>
      <line x1="0" y1="200" x2="100" y2="200"></line>
    </svg>
    <svg class="apexcharts-gridlines-horizontal">
      ${Array.from({ length: opts?.interior ?? 3 }, (_, i) => 
        `<line class="" x1="0" y1="${(i+1)*50}" x2="100" y2="${(i+1)*50}"></line>`
      ).join('')}
    </svg>
  `
}

describe('useFacilityHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('searchHourRange_navigatesOn500', async () => {
    const router = useRouter()
    vi.mocked(apiGet).mockRejectedValueOnce({ statusCode: 500, message: 'Internal' })
    const { api } = makeHost()
    attachApex(api())
    await api().searchHourRange()
    expect(router.push).toHaveBeenCalledWith({ name: 'common-error-visual', query: { code: '500' } })
  })

  test('searchHourRange_openWith404_andClearsChart', async () => {
    const { openWith } = useNotFoundScreenProps()
    vi.mocked(apiGet).mockRejectedValueOnce({ statusCode: 404, message: 'not found', data: { code: 'E404X' } })
    const { api } = makeHost()
    const { updateOptions } = attachApex(api())
    await api().searchHourRange()
    expect(openWith).toHaveBeenCalledWith(404, { errorCode: 'E404X' })
    expect(updateOptions).toHaveBeenCalled()
    expect(api().mainSeries.value).toEqual([])
  })

  test('searchHourRange_openWith504', async () => {
    const { openWith } = useNotFoundScreenProps()
    vi.mocked(apiGet).mockRejectedValueOnce({ statusCode: 504, message: 'gateway timeout' })
    const { api } = makeHost()
    attachApex(api())
    await api().searchHourRange()
    expect(openWith).toHaveBeenCalledWith(504)
  })

  test('searchHourRange_handlesNetworkLikeError', async () => {
    const { openWith } = useNotFoundScreenProps()
    vi.mocked(apiGet).mockRejectedValueOnce({ statusCode: 0, message: 'Failed to fetch', data: {} })
    const { api } = makeHost()
    attachApex(api())
    await api().searchHourRange()
    expect(openWith).toHaveBeenCalledWith(503) // fallback
  })

  test('searchDayRange_updates_onSuccess', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({
      code: 'OK', message: 'ok', data: {
        categories: ['1','2','3'],
        series: [{ name: 'S', data: [10] }],
        units: 'kWh', range: { min: 0, max: 50 }, facilityName: 'F2'
      }
    })
    const { api } = makeHost()
    const { updateSeries, updateOptions } = attachApex(api())
    setGridDom(api())

    await api().searchDayRange()
    await nextTick()
    await nextTick()
    expect(updateSeries).toHaveBeenCalled()
    expect(updateOptions).toHaveBeenCalled()
    expect(api().yTicks.value.length).toBeGreaterThan(0)
  })

  test('parseYM_integration_withApply_startAdjustsEndIfNeeded', async () => {
    const { api } = makeHost()
    // open start -> set temp > today -> apply clamps
    api().tempStartYear.value = 2027
    api().tempStartMonth.value = 12
    api().apply('start', () => ({ THIS_YEAR: 2026, THIS_MONTH: 3 }))
    expect(api().startYM.value).toBe('2026/03')
    // end should be aligned same year and >= start
    expect(api().endYM.value).toBe('2026/03')
  })

  test('apply_endClampsFuture_andKeepsStartValid', async () => {
    const { api } = makeHost()
    api().startYM.value = '2026/01'
    api().tempEndYear.value = 2026
    api().tempEndMonth.value = 12
    api().apply('end', () => ({ THIS_YEAR: 2026, THIS_MONTH: 3 }))
    expect(api().endYM.value).toBe('2026/03')
    expect(api().startYM.value).toBe('2026/01') // stays valid
  })

  test('resetMonthlyToDefault_setsCurrentYearRange', () => {
    const { api } = makeHost()
    api().resetMonthlyToDefault()
    // Based on frozen time 2026-03-09
    expect(api().startYM.value).toBe('2026/01')
    expect(api().endYM.value).toBe('2026/03')
  })

  test('resetDailyToToday_setsMonthAndYear', () => {
    const { api } = makeHost()
    api().resetDailyToToday()
    expect(api().selDate.value).toBe('2026-03')
    expect(api().year.value).toBe(2026)
  })

  test('resetHourlyToToday_setsDate', () => {
    const { api } = makeHost()
    api().resetHourlyToToday()
    expect(api().date.value).toBe('2026-03-09')
  })

  test('isBeforeMin_isAfterMax_respectBounds', () => {
    const { api } = makeHost()
    const min = new Date(2025, 0, 1)
    const max = new Date(2026, 2, 1)
    api().__setMinMonthForTest(min)
    api().__setMaxMonthForTest(max)
    expect(api().isBeforeMin(2024,12)).toBe(true)
    expect(api().isAfterMax(2026,4)).toBe(true)
    expect(api().isBeforeMin(2025,1)).toBe(false)
    expect(api().isAfterMax(2026,2)).toBe(false)
  })

  test('validHourRange_clampsFutureDates', async () => {
    const { api } = makeHost()
    api().date.value = '2027-01-01'
    await nextTick()
    expect(api().date.value).toBe('2026-03-09') // clamped to today
    expect(api().validHourRange.value).toBe(true)
  })

  test('validDayRange_clampsFutureMonths', async () => {
    const { api } = makeHost()
    api().selDate.value = '2026-12'
    await nextTick()
    expect(api().selDate.value).toBe('2026-03') // clamped to current month
    expect(api().validDayRange.value).toBe(true)
  })

  test('syncYAxis_returnsEmptyWhenDomMissing', async () => {
    const { api } = makeHost()
    // no DOM set -> yTicks should become []
    await api().syncYAxis()
    await nextTick()
    expect(api().yTicks.value).toEqual([])
  })

  test('syncYAxis_computesTicksFromBordersAndInteriors', async () => {
    const { api } = makeHost()
    attachApex(api())
    setGridDom(api(), { interior: 2 })
    await api().syncYAxis()
    await nextTick()
    
    const ticks = api().yTicks.value

    expect(ticks).toHaveLength(4)

    // Index after narrowing; the non-null assertion is now justified
    const first = ticks[0]!
    const last  = ticks[3]!

    expect(first.value).toBeGreaterThan(last.value)

    expect(api().yTicks.value.length).toBe(4)
  })

  test('granularity_watch_triggersImmediateSearch', async () => {
    vi.mocked(apiGet).mockResolvedValue({
      code: 'OK', message: 'ok', data: { categories: [], series: [], range: { min: 0, max: 0 }, units: 'kWh' }
    })
    const { api } = makeHost()
    attachApex(api())
    // On mount immediate: default granularity is 'time', so 1 call
    await nextTick()
    expect(apiGet).toHaveBeenCalledTimes(1)
    // switch to day/month triggers calls
    api().granularity.value = 'day'
    await nextTick()
    api().granularity.value = 'month'
    await nextTick()
    expect(apiGet).toHaveBeenCalledTimes(3)
  })
  test('closeAllMenus_closesAll', () => {
  const { api } = makeHost()
  api().openTime.value = true
  api().openDay.value = true
  api().openStart.value = true
  api().openEnd.value = true
  api().closeAllMenus()
  expect(api().openTime.value).toBe(false)
  expect(api().openDay.value).toBe(false)
  expect(api().openStart.value).toBe(false)
  expect(api().openEnd.value).toBe(false)
})

test('setTodayStart_setsStartToCurrentMonth', () => {
  const { api } = makeHost()
  api().setTodayStart()
  expect(api().startYM.value).toBe('2026/03')
})
})
describe('routeFacilityId', () => {
  test('routeFacilityId_derivesStringFromRouteParam_orEmpty', async () => {
    const { routeFacilityId } = useFacilityHistory('FNYID') // facilityID arg unused in this part
    // initial mock
    expect(routeFacilityId.value).toBe('FBC123')

    // when param is undefined
    routeParams.facilityID = undefined
    await nextTick()
    expect(routeFacilityId.value).toBe('') // String(undefined ?? '') -> ''
  })
})
import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction  } from 'vitest'
import { h, defineComponent, reactive } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { type Router } from 'vue-router'

import { useEcheckDashboard, type ECheck, type HttpErrorLike } from '../ElectricityAmountCheck/ElectricityAmountCheck'

type StringArrayMap = Record<string, string[]>
type ApplyErrorsOpts = {
  topList: { value: string[] }
  fieldMap: { value: StringArrayMap }
  reset: boolean
}
type ApplyErrorsToPageFn = (raw: unknown, opts: ApplyErrorsOpts) => void
const pushSpy: MockedFunction<Router['push']> = vi.fn().mockResolvedValue(undefined)
const mockedRoute = reactive({
  params: { facilityID: 'FABCDE' as string },
})

const mockedRouter = { push: pushSpy }

vi.mock('vue-router', () => ({
  useRouter: () => mockedRouter,
  useRoute: () => mockedRoute,
}))

const tSpy = vi.fn((key: string, args?: unknown[]) => {
  if (key === 'eamountcheck.noData') return 'NO_DATA'
  if (key === 'facility.imageFilename') return 'filename'
  if (key.startsWith('error.')) return `${key}:${Array.isArray(args) ? String(args[0]) : ''}`
  return key
})
vi.mock('vue-i18n', () => {
  return { useI18n: () => ({ t: tSpy }) }
})
type VoidFn = () => void
const showSpy = vi.fn<VoidFn>(() => {})
const hideSpy = vi.fn<VoidFn>(() => {})

vi.mock('@/pages/Common/composables/GlobalLoading', () => {
  return {
    useGlobalLoading: () => ({ show: showSpy, hide: hideSpy }),
  }
})
type OpenWithFn = (code?: number, opts?: Record<string, string>) => void
const openWithSpy = vi.fn<OpenWithFn>((code, opts) => {
  void code
  void opts
})
vi.mock('@/pages/Common/composables/NotFoundScreen', () => {
  return { useNotFoundScreenProps: () => ({ openWith: openWithSpy }) }
})
const applyErrorsSpy = vi.fn<ApplyErrorsToPageFn>((raw, opts) => {
  void raw
  if (opts.reset) {
    opts.topList.value = []
    opts.fieldMap.value = {}
  }
  const records: unknown = (raw as { errors?: Array<Record<string, unknown>> } | undefined)?.errors
  if (Array.isArray(records) && records.length > 0) {
    if (typeof records[0].message === 'string') {
      opts.topList.value.push(records[0].message as string)
    } else {
      opts.topList.value.push('GENERIC_ERR')
    }
    if (typeof records[0].field === 'string') {
      const key = String(records[0].field)
      opts.fieldMap.value[key] = ['FIELD_ERROR']
    }
  }
})
vi.mock('../Common/error/errorResolver', () => {
  return {
    applyErrorsToPage: (raw: unknown, opts: ApplyErrorsOpts) => applyErrorsSpy(raw, opts),
  }
})
type ApiGetFn = <TResponse>(
  url: string,
  init?: { headers?: Record<string, string> }
) => Promise<TResponse>

let apiGetImpl: ApiGetFn = async <TResponse,>(url: string): Promise<TResponse> => {
  throw new Error(`apiGet mock not set for ${url}`)
}

vi.mock('@/services/http', () => {
  const apiGet: ApiGetFn = (url, init) => apiGetImpl(url, init)
  return { apiGet }
})

interface MutableImportMeta { env: Record<string, string> }
function setViteBase(url: string): void {
  const meta = import.meta as unknown as MutableImportMeta
  if (!meta.env) meta.env = {}
  meta.env.VITE_API_BASE_URL = url
}
function samplePayload(overrides?: Partial<ECheck>): ECheck {
  return {
    facilityName: 'Alpha Plant',
    cityInfo: 'Tokyo',
    measuredTime: '2026-03-07T00:00:00Z',
    totalGeneration: 1000,
    currentGeneration: 123.456,
    currentSelfUsage: 78.9,
    currentUsage: 200.001,
    todayTotalGeneration: 234.5,
    todayTotalSelfUsage: 123.0,
    todayTotalUsage: 345.8,
    facilityImage: {
      relativePath: 'alpha.jpg',
      displayName: 'Alpha',
      presignedUrl: 'https://img.example.com/alpha.jpg',
    },
    ...overrides,
  }
}
const Exposer = defineComponent({
  name: 'TestExposerComponent', 
  setup() {
    const api = useEcheckDashboard()
    ;(globalThis as unknown as { $api: ReturnType<typeof useEcheckDashboard> }).$api = api
    return () => h('div')
  },
})
beforeEach(() => {
  setViteBase('https://api.example.com')
  pushSpy.mockClear()
  showSpy.mockClear()
  hideSpy.mockClear()
  openWithSpy.mockClear()
  applyErrorsSpy.mockClear()
  tSpy.mockClear()

  mockedRoute.params.facilityID = 'FABCDE'
})

afterEach(() => {
})


describe('useEcheckDashboard', () => {
  it('onMounted - triggers loadByRouteId automatically and handles happy path', async () => {
    const payload = samplePayload()

    apiGetImpl = async <TResponse,>(): Promise<TResponse> => {
      const result = {
        statusCode: 200,
        body: JSON.stringify({ data: payload }),
      }
      return result as unknown as TResponse
    }

    const wrapper = shallowMount(Exposer)
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))

    const api = (globalThis as unknown as { $api: ReturnType<typeof useEcheckDashboard> }).$api
    expect(api.loading.value).toBe(false)
    expect(showSpy).toHaveBeenCalled()
    expect(hideSpy).toHaveBeenCalled()

    expect(api.echeck.value?.facilityName).toBe('Alpha Plant')
    expect(applyErrorsSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })
it('unwrapToDomain - ApiGatewayEnvelope with invalid JSON string body goes to catch and returns {}', async () => {
  apiGetImpl = async <TResponse,>(): Promise<TResponse> => {
    const result = { statusCode: 200, body: '{invalid' } 
    return result as unknown as TResponse
  }

  const { loadByRouteId, echeck } = useEcheckDashboard()
  await loadByRouteId()
  expect(echeck.value).toBeTruthy()
  expect(Number.isNaN(echeck.value!.totalGeneration)).toBe(true)
  expect(Number.isNaN(echeck.value!.currentGeneration)).toBe(true)
})

it('unwrapToDomain - BodyEnvelope with data (no item) returns data', async () => {
  const payload = {
    facilityName: 'Hotel Plant',
    cityInfo: 'Kobe',
    measuredTime: '2026-03-07T00:00:00Z',
    totalGeneration: 12,
    currentGeneration: 4,
    currentSelfUsage: 5,
    currentUsage: 6,
    todayTotalGeneration: 8,
    todayTotalSelfUsage: 5,
    todayTotalUsage: 10,
    facilityImage: { relativePath: 'h.jpg', displayName: 'H', presignedUrl: 'https://img/h.jpg' },
  }

  apiGetImpl = async <TResponse,>(): Promise<TResponse> => {
    return { data: payload } as unknown as TResponse
  }

  const { loadByRouteId, echeck } = useEcheckDashboard()
  await loadByRouteId()

  expect(echeck.value?.facilityName).toBe('Hotel Plant')
})


it('unwrapToDomain - BodyEnvelope with empty object data (no item) returns {} and maps to NaN numbers', async () => {
  apiGetImpl = async <TResponse,>(): Promise<TResponse> => {
    return { data: {} } as unknown as TResponse
  }

  const { loadByRouteId, echeck } = useEcheckDashboard()
  await loadByRouteId()

  expect(echeck.value).toBeTruthy()
  expect(Number.isNaN(echeck.value!.totalGeneration)).toBe(true)
  expect(Number.isNaN(echeck.value!.todayTotalUsage)).toBe(true)
})
it('loadByRouteId - 404 uses nested data.code when top-level empty', async () => {
  const err: HttpErrorLike = { statusCode: 404, message: 'nf', data: { code: '   ', data: { code: ' NEST ' } } };
  apiGetImpl = async () => { throw err };

  const { loadByRouteId } = useEcheckDashboard();
  await loadByRouteId();

  expect(openWithSpy).toHaveBeenCalledWith(404, { errorCode: 'NEST' });
});

it('loadByRouteId - 404 with data not a record returns undefined', async () => {
  const err: HttpErrorLike = { statusCode: 404, message: 'nf', data: 'oops' as unknown };
  apiGetImpl = async () => { throw err };

  const { loadByRouteId } = useEcheckDashboard();
  await loadByRouteId();

  expect(openWithSpy).toHaveBeenCalledWith(404, { errorCode: undefined });
});

it('loadByRouteId - 404 with no code returns undefined', async () => {
  const err: HttpErrorLike = { statusCode: 404, message: 'nf', data: { something: true } };
  apiGetImpl = async () => { throw err };

  const { loadByRouteId } = useEcheckDashboard();
  await loadByRouteId();

  expect(openWithSpy).toHaveBeenCalledWith(404, { errorCode: undefined });
});

it('loadByRouteId - network fallback when statusCode === 0: openWith(undefined)', async () => {
  const e = { statusCode: 0, message: 'something', data: {} } 
  apiGetImpl = async () => { throw e }

  const { loadByRouteId } = useEcheckDashboard()
  await loadByRouteId()

  expect(openWithSpy).toHaveBeenCalledTimes(1)
  expect(openWithSpy).toHaveBeenCalledWith(undefined) 
})

  it('loadByRouteId - handles API envelope with { data: { item: payload, code, field } } and applies inner errors', async () => {
    const payload = samplePayload()
    apiGetImpl = async <TResponse,>(): Promise<TResponse> => {
      const body = { data: { item: payload, code: 'ERR_X', field: 'STATUS_LABEL' } }
      return { statusCode: 200, body: JSON.stringify(body) } as unknown as TResponse
    }

    const { loadByRouteId, echeck, topErrorList } = useEcheckDashboard()
    await loadByRouteId()

    expect(echeck.value?.facilityName).toBe('Alpha Plant')
    expect(applyErrorsSpy).toHaveBeenCalled()
    expect(Array.isArray(topErrorList.value)).toBe(true) 
  })

  it('loadByRouteId - supports body object (non-string) with { data: payload }', async () => {
    const payload = samplePayload({ facilityName: 'Bravo Plant' })
    apiGetImpl = async <TResponse,>(): Promise<TResponse> => {
      return { statusCode: 200, body: { data: payload } } as unknown as TResponse
    }

    const { loadByRouteId, echeck } = useEcheckDashboard()
    await loadByRouteId()
    expect(echeck.value?.facilityName).toBe('Bravo Plant')
  })

  it('loadByRouteId - supports raw with "data" (no body) and item inside', async () => {
    const payload = samplePayload({ facilityName: 'Charlie Plant' })
    apiGetImpl = async <TResponse,>(): Promise<TResponse> => {
      return { data: { item: payload } } as unknown as TResponse
    }

    const { loadByRouteId, echeck } = useEcheckDashboard()
    await loadByRouteId()
    expect(echeck.value?.facilityName).toBe('Charlie Plant')
  })

  it('loadByRouteId - supports raw with "item" only', async () => {
    const payload = samplePayload({ facilityName: 'Delta Plant' })
    apiGetImpl = async <TResponse,>(): Promise<TResponse> => {
      return { item: payload } as unknown as TResponse
    }

    const { loadByRouteId, echeck } = useEcheckDashboard()
    await loadByRouteId()
    expect(echeck.value?.facilityName).toBe('Delta Plant')
  })

  it('loadByRouteId - supports raw being payload directly', async () => {
    const payload = samplePayload({ facilityName: 'Echo Plant' })
    apiGetImpl = async <TResponse,>(): Promise<TResponse> => {
      return payload as unknown as TResponse
    }

    const { loadByRouteId, echeck } = useEcheckDashboard()
    await loadByRouteId()
    expect(echeck.value?.facilityName).toBe('Echo Plant')
  })

  it('loadByRouteId - pushes facility image error to topErrorList when facilityImage is error-like', async () => {
    const payload = samplePayload({
      facilityImage: { relativePath: '', displayName: '', presignedUrl: '' } as unknown as ECheck['facilityImage'],
    })
    const rawPayload: Record<string, unknown> = { ...payload, facilityImage: { errorCode: 'IMG_NOT_FOUND' } }

    apiGetImpl = async <TResponse,>(): Promise<TResponse> => {
      return { statusCode: 200, body: JSON.stringify({ data: rawPayload }) } as unknown as TResponse
    }

    const { loadByRouteId, topErrorList } = useEcheckDashboard()
    await loadByRouteId()

    expect(topErrorList.value.some((s) => s.startsWith('error.IMG_NOT_FOUND'))).toBe(true)
  })

it('loadByRouteId - routes to common-error-visual on 500', async () => {
    const e: HttpErrorLike = { statusCode: 500, message: 'Server error' }
    apiGetImpl = async () => {
      throw e
    }

    const { loadByRouteId } = useEcheckDashboard()
    await loadByRouteId()

    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(pushSpy).toHaveBeenCalledWith({
      name: 'common-error-visual',
      query: { code: '500' },
    })
  })

  it('loadByRouteId - opens not found with code on 404', async () => {
    const e: HttpErrorLike = { statusCode: 404, message: 'Not found', data: { code: 'ERR404' } }
    apiGetImpl = async () => {
      throw e
    }
    const { loadByRouteId } = useEcheckDashboard()
    await loadByRouteId()
    expect(openWithSpy).toHaveBeenCalledWith(404, { errorCode: 'ERR404' })
  })

  it('loadByRouteId - opens 504 (timeout) via not-found screen', async () => {
    const e: HttpErrorLike = { statusCode: 504, message: 'Gateway timeout' }
    apiGetImpl = async () => {
      throw e
    }
    const { loadByRouteId } = useEcheckDashboard()
    await loadByRouteId()
    expect(openWithSpy).toHaveBeenCalledWith(504)
  })

  it('loadByRouteId - opens not found for 503 network-like when no page errors populated', async () => {
    const e: HttpErrorLike = { statusCode: 503, message: 'Network Error' }
    apiGetImpl = async () => {
      throw e
    }
    const { loadByRouteId } = useEcheckDashboard()
    await loadByRouteId()
    expect(openWithSpy).toHaveBeenCalledWith(503)
  })

  it('loadByRouteId - does not open not-found if applyErrorsToPage populated page errors', async () => {
    const e: HttpErrorLike = {
      statusCode: 400,
      message: 'Bad request',
      data: { errors: [{ field: 'foo', message: 'bad foo' }] },
    }
    apiGetImpl = async () => {
      throw e
    }
    const { loadByRouteId } = useEcheckDashboard()
    await loadByRouteId()
    expect(applyErrorsSpy).toHaveBeenCalled()
    expect(openWithSpy).not.toHaveBeenCalled()
  })
it('loadByRouteId - looksLikeNetwork via statusCode=503 → openWith(503)', async () => {
  const e = { statusCode: 503, message: 'Service Unavailable', data: {} }
  apiGetImpl = async () => { throw e }

  const { loadByRouteId } = useEcheckDashboard()
  await loadByRouteId()

  expect(openWithSpy).toHaveBeenCalledWith(503)
})
it('loadByRouteId - isGenericBrowserMsg via "Network error" + status=400 → openWith(400)', async () => {
  const e = { statusCode: 400, message: 'Network error', data: {} }
  apiGetImpl = async () => { throw e }

  const { loadByRouteId } = useEcheckDashboard()
  await loadByRouteId()

  expect(openWithSpy).toHaveBeenCalledWith(400)
})
it('loadByRouteId - finally always hides GL', async () => {
  const e = { statusCode: 400, message: 'x', data: {} }
  apiGetImpl = async () => { throw e }

  const { loadByRouteId } = useEcheckDashboard()
  await loadByRouteId()

  expect(showSpy).toHaveBeenCalled()
  expect(hideSpy).toHaveBeenCalled()
})
it('loadByRouteId - non-HttpErrorLike (plain Error): skips http branch, clears error, no openWith/push/applyErrors', async () => {
  apiGetImpl = async () => {
    throw new Error('boom') 
  }

  const { loadByRouteId, error } = useEcheckDashboard()
  await loadByRouteId()

  expect(openWithSpy).not.toHaveBeenCalled()
  expect(pushSpy).not.toHaveBeenCalled()
  expect(applyErrorsSpy).not.toHaveBeenCalled()

  expect(error.value).toBe('')

  expect(showSpy).toHaveBeenCalled()
  expect(hideSpy).toHaveBeenCalled()
})
  it('bgStyle - returns cover style for absolute URL string', () => {
    const { bgStyle } = useEcheckDashboard()
    const style = bgStyle('https://img.example.com/a.jpg')
    expect(style.backgroundImage.includes('https://img.example.com/a.jpg')).toBe(true)
    expect(style.backgroundSize).toBe('cover')
  })

  it('bgStyle - prepends /images/ for relative file name', () => {
    const { bgStyle } = useEcheckDashboard()
    const style = bgStyle('logo.png')
    expect(style.backgroundImage.includes('/images/logo.png')).toBe(true)
  })

  it('bgStyle - uses presignedUrl from object', () => {
    const { bgStyle } = useEcheckDashboard()
    const style = bgStyle({ relativePath: '', displayName: '', presignedUrl: 'https://signed' })
    expect(style.backgroundImage.includes('https://signed')).toBe(true)
  })

  it('bgStyle - none when null/undefined', () => {
    const { bgStyle } = useEcheckDashboard()
    expect(bgStyle(null).backgroundImage).toBe('none')
    expect(bgStyle(undefined).backgroundImage).toBe('none')
  })

  it('fmt3 - formats number to 3 decimals (en-US) or returns noData text', () => {
    const { fmt3 } = useEcheckDashboard()
    expect(fmt3(1234.5)).toBe('1,234.500')
    expect(fmt3(null)).toBe('NO_DATA')
    expect(fmt3(Number.NaN)).toBe('NO_DATA')
  })

  it('toHttpError - true only for objects with numeric statusCode', () => {
    const { toHttpError } = useEcheckDashboard()
    const good: HttpErrorLike = { statusCode: 400, message: 'oops' }
    const bad1: unknown = { statusCode: '400', message: 'oops' }
    const bad2: unknown = 'error'
    expect(toHttpError(good)).toBe(true)
    expect(toHttpError(bad1)).toBe(false)
    expect(toHttpError(bad2)).toBe(false)
  })

  it('isValidFacilityId - passes regex for F[A-Z0-9]{5}', async () => {

  mockedRoute.params.facilityID = 'F1234Z'
  let api = useEcheckDashboard()
  expect(api.isValidFacilityId.value).toBe(true)

  mockedRoute.params.facilityID = 'X12345'
  api = useEcheckDashboard() 
  expect(api.isValidFacilityId.value).toBe(false)

  mockedRoute.params.facilityID = 'F123'
  api = useEcheckDashboard() 
  expect(api.isValidFacilityId.value).toBe(false)

  })

  it('clearServerError - removes a single field error; clearAllServerErrors - clears all', async () => {
    const { serverErrors, clearServerError, clearAllServerErrors } = useEcheckDashboard()
    serverErrors.value = { foo: ['e1'], bar: ['e2'] }

    clearServerError('foo')
    expect(serverErrors.value.foo).toBeUndefined()
    expect(serverErrors.value.bar).toEqual(['e2'])

    clearAllServerErrors()
    expect(Object.keys(serverErrors.value)).toHaveLength(0)
  })

  it('clearServerError - no-op when key not present (branch: false, key missing)', () => {
    const { serverErrors, clearServerError } = useEcheckDashboard()
    serverErrors.value = { foo: ['e1'], bar: ['e2'] }

    const prevRef = serverErrors.value
    clearServerError('baz') 

    expect(serverErrors.value).toBe(prevRef)                
    expect(serverErrors.value).toEqual({ foo: ['e1'], bar: ['e2'] })
  })

  it('goToDetailChart - navigates and toggles clickLoading/gl', async () => {
    mockedRoute.params.facilityID = 'FABCDE'
    const { goToDetailChart, clickLoading } = useEcheckDashboard()
    expect(clickLoading.value).toBe(false)
    await goToDetailChart()
    expect(showSpy).toHaveBeenCalled()
    expect(hideSpy).toHaveBeenCalled()
    expect(pushSpy).toHaveBeenCalledWith('/facilities/FABCDE/energy')
    expect(clickLoading.value).toBe(false)
  })

  it('isFacilityImageError - recognizes facility image error object', () => {
    const payload = samplePayload({
      facilityImage: { relativePath: '', displayName: '', presignedUrl: '' } as unknown as ECheck['facilityImage'],
    })
    const rawPayload: Record<string, unknown> = { ...payload, facilityImage: { errorCode: 'IMG_ERR' } }

    apiGetImpl = async <TResponse,>(): Promise<TResponse> => {
      return { statusCode: 200, body: JSON.stringify({ data: rawPayload }) } as unknown as TResponse
    }

    const { loadByRouteId, topErrorList } = useEcheckDashboard()
    return loadByRouteId().then(() => {
      expect(topErrorList.value.some((x) => x.startsWith('error.IMG_ERR'))).toBe(true)
    })
  })
  it('routeFacilityId - falls back to empty string when route param is undefined', () => {
  mockedRoute.params.facilityID = undefined as unknown as string;

  const { isValidFacilityId } = useEcheckDashboard();
  expect(isValidFacilityId.value).toBe(false);
});
it('500 handler - covers the ?? 500 fallback by using a getter that becomes undefined on third read', async () => {
  let readCount = 0;
  const err = {
    get statusCode() {
      readCount += 1;
      if (readCount <= 2) return 500;
      return undefined as unknown as number;
    },
    message: 'Server error with tricky getter',
    data: {},
  } as unknown as HttpErrorLike;

  apiGetImpl = async () => { throw err; };

  const { loadByRouteId } = useEcheckDashboard();
  await loadByRouteId();

  expect(pushSpy).toHaveBeenCalledTimes(1);
  expect(pushSpy).toHaveBeenCalledWith({
    name: 'common-error-visual',
    query: { code: '500' },
  });

  expect(readCount).toBe(3);
});

})

import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import type { FacilityImage, facilityType } from '@/pages/FacilityRegister/FacilityRegister'
import { vi } from 'vitest'

// -------------------- Mock control & logs (no 'any') --------------------
type HttpErrorShape = { statusCode: number | undefined; data?: { code: string; errors: unknown[] } }

let apiGetImpl: (url: string) => Promise<unknown> = async () => ({})
const apiGetLog: string[] = []

const routerReplaceLog: string[] = []

let nextHttpError: HttpErrorShape = { statusCode: 400 }
let nextNetworkMessage = '__NETWORK__'

type AppliedErrorsRecord = {
  data: { code: string; errors: unknown[] }
  opts: { topList: { value: string[] }; reset?: boolean }
}
const appliedErrors: AppliedErrorsRecord[] = []

const glActions: ('show' | 'hide')[] = []

// -------------------- Mocks (must be defined BEFORE importing SUT) --------------------

// Matches: import { apiGet } from '@/services/http'
vi.mock('@/services/http', () => ({
  apiGet: (url: string) => {
    apiGetLog.push(url)
    return apiGetImpl(url)
  },
}))

// Matches: import { useRouter } from 'vue-router'
vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: (path: string) => {
      routerReplaceLog.push(path)
      return Promise.resolve()
    },
  }),
}))

// Matches: import { useI18n } from 'vue-i18n'
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (k: string) => `__${k}__`,
  }),
}))

// Matches: import { toHttpError, toNetworkMessage } from '../composables/useFacilityRegister'
vi.mock('../composables/useFacilityRegister', () => ({
  toHttpError: () => nextHttpError,
  toNetworkMessage: (fallback: string) => `${fallback} ${nextNetworkMessage}`,
}))
// Also mock if SUT imports via alias:
vi.mock('@/pages/FacilityRegister/composables/useFacilityRegister', () => ({
  toHttpError: () => nextHttpError,
  toNetworkMessage: (fallback: string) => `${fallback} ${nextNetworkMessage}`,
}))

// Matches: import { applyErrorsToPage } from '../../Common/error/errorResolver'
vi.mock('../../Common/error/errorResolver', () => ({
  applyErrorsToPage: (
    data: { code: string; errors: unknown[] },
    opts: { topList: { value: string[] }; reset?: boolean },
  ) => {
    appliedErrors.push({ data, opts })
    const label = `applied:${data.code}`
    opts.topList.value = opts.reset ? [label] : [...opts.topList.value, label]
  },
}))
// Also mock if SUT imports via alias:
vi.mock('@/pages/Common/error/errorResolver', () => ({
  applyErrorsToPage: (
    data: { code: string; errors: unknown[] },
    opts: { topList: { value: string[] }; reset?: boolean },
  ) => {
    appliedErrors.push({ data, opts })
    const label = `applied:${data.code}`
    opts.topList.value = opts.reset ? [label] : [...opts.topList.value, label]
  },
}))

// Matches: import { useGlobalLoading } from '../../Common/composables/GlobalLoading'
// ⚠️ Inline the factory so hoisting doesn't break with "Cannot access ... before initialization"
vi.mock('../../Common/composables/GlobalLoading', () => ({
  useGlobalLoading: () => ({
    show: () => glActions.push('show'),
    hide: () => glActions.push('hide'),
  }),
}))
// Also mock if SUT imports via alias:
vi.mock('@/pages/Common/composables/GlobalLoading', () => ({
  useGlobalLoading: () => ({
    show: () => glActions.push('show'),
    hide: () => glActions.push('hide'),
  }),
}))

// -------------------- SUT dynamic import helper --------------------
const SUT_PATH = '@/pages/FacilityRegister/composables/usePhotoUpload' as const

// The SUT module's type (compile-time only)
type SUTModule = typeof import('@/pages/FacilityRegister/composables/usePhotoUpload')

// Dynamically import the SUT, but keep strong typing
const importSUT = async (): Promise<SUTModule> => {
  const mod = await import(SUT_PATH)
  return mod as SUTModule
}

// -------------------- Helpers --------------------
function flushPromises(): Promise<void> {
  return Promise.resolve().then(() => {})
}

function makeImg(name: string, presignedUrl: string): FacilityImage {
  return {
    displayName: name,
    relativePath: `/rel/${name}.jpg`,
    presignedUrl,
  }
}

const HOSPITAL: facilityType = 'HOSPITAL' as unknown as facilityType
const CLINIC: facilityType = 'CLINIC' as unknown as facilityType

// -------------------- Tests --------------------
describe('usePhotoUpload composable', () => {  
let usePhotoUpload: SUTModule['usePhotoUpload']
let getPhotoErrorList: SUTModule['getPhotoErrorList']
let topErrorList: SUTModule['topErrorList']

  beforeEach(async () => {
    // Ensure a fresh module instance for every test so state doesn’t leak
    vi.resetModules()

    // reset logs/state
    apiGetLog.length = 0
    routerReplaceLog.length = 0
    appliedErrors.length = 0
    glActions.length = 0
    // default http error behavior (overridden per-test)
    nextHttpError = { statusCode: 400 }
    nextNetworkMessage = '__NETWORK__'

    // default apiGet behavior (overridden per-test)
    apiGetImpl = async () => ({
      code: 'MSG0006',
      data: [makeImg('a', 'https://cdn/a.jpg')],
      meta: { requestId: 'r', serverTime: 't' },
    })

    // ⬇️ Import SUT AFTER mocks and after resetting modules
    const mod = await importSUT()
    usePhotoUpload = mod.usePhotoUpload
    getPhotoErrorList = mod.getPhotoErrorList
    topErrorList = mod.topErrorList

    // reset exported refs to a known clean state
    getPhotoErrorList.value = []
    topErrorList.value = []
  })
  it('on 503 with missing error payload uses fallback object and applies to TOP list (reset)', async () => {
  apiGetImpl = async () => {
    throw new Error('service unavailable')
  }
  // No data payload provided → triggers nullish coalescing fallback in applyErrorsToPage call
  nextHttpError = { statusCode: 503 }

  const up = usePhotoUpload()
  await up.open(HOSPITAL)

  // Our mock logs exactly what was passed
  expect(appliedErrors.length).toBe(1)
  expect(appliedErrors[0]).toMatchObject({
    data: { code: '', errors: [] },         // <-- fallback path covered
    opts: { reset: true }
  })
  // topErrorList gets "applied:" because code === '' in the mock
  expect(topErrorList.value).toEqual(['applied:'])
  expect(up.images.value).toEqual([])
})
it('on 404 with missing error payload uses fallback for getPhotoErrorList and returns early', async () => {
  apiGetImpl = async () => {
    throw new Error('not found')
  }
  // No data payload provided → triggers fallback in applyErrorsToPage call
  nextHttpError = { statusCode: 404 }

  const up = usePhotoUpload()
  up.images.value = [makeImg('seed', 'https://xx')] // ensure it gets cleared
  await up.open(HOSPITAL)

  expect(appliedErrors.length).toBe(1)
  expect(appliedErrors[0]).toMatchObject({
    data: { code: '', errors: [] },         // <-- fallback path covered
    opts: { reset: true }
  })
  expect(getPhotoErrorList.value).toEqual(['applied:'])
  expect(up.images.value).toEqual([])       // early return path honored
})

  it('early returns when category is undefined (no loading, no api call)', async () => {
    const up = usePhotoUpload()
    // Seed images to confirm they are cleared
    up.images.value = [makeImg('seed', 'https://x')]
    await up.reload()
    expect(up.images.value).toEqual([])
    expect(apiGetLog.length).toBe(0)
    expect(glActions).toEqual([])
    expect(up.loading.value).toBe(false)
    expect(up.dialogError.value).toBeNull()
  })

  it('open() loads images (flat body, non-proxy), passes https URLs, lastStatus defaults to 200', async () => {
    apiGetImpl = async () => ({
      code: 'MSG0006',
      data: [makeImg('x', 'https://cdn/x.jpg')],
      meta: { requestId: '1', serverTime: 'now' },
    })
    const up = usePhotoUpload()
    await up.open(HOSPITAL)
    expect(up.dialog.value).toBe(true)
    expect(apiGetLog.length).toBe(1)
    expect(up.images.value.length).toBe(1)
    expect(up.images.value[0]?.presignedUrl).toBe('https://cdn/x.jpg')
    expect(glActions).toEqual(['show', 'hide'])
    expect(up.lastStatus.value).toBe(200)
  })

  it('loads images (nested body via Lambda proxy envelope with string status), resolves relative/data/http URLs', async () => {
    const nested = {
      code: 'MSG0006',
      data: {
        photos: [
          makeImg('rel1', 'file1.jpg'), // -> '/file1.jpg'
          makeImg('http', 'http://example.com/d.jpg'), // pass-through
          makeImg('data', 'data:image/png;base64,xxx'), // pass-through
        ],
      },
      meta: { requestId: '2', serverTime: 'now' },
    }
    apiGetImpl = async () => ({
      statusCode: '200',
      body: JSON.stringify(nested),
    })
    const up = usePhotoUpload()
    await up.open(CLINIC)
    expect(up.images.value.map((i: FacilityImage) => i.presignedUrl)).toEqual([
      '/file1.jpg',
      'http://example.com/d.jpg',
      'data:image/png;base64,xxx',
    ])
    expect(up.lastStatus.value).toBe(200)
  })

  it('handles proxy envelope with OBJECT body (not string)', async () => {
    const nestedObj = {
      code: 'MSG0006',
      data: { photos: [makeImg('obj1', 'obj.jpg')] },
      meta: { requestId: 'obj', serverTime: 'now' },
    }
    apiGetImpl = async () => ({
      statusCode: 201,
      body: nestedObj,
    })
    const up = usePhotoUpload()
    await up.open(HOSPITAL)
    expect(up.lastStatus.value).toBe(201)
    expect(up.images.value.map((i: FacilityImage) => i.displayName)).toEqual(['obj1'])
    expect(up.images.value[0]?.presignedUrl).toBe('/obj.jpg')
  })

  it('handles empty string presignedUrl via resolveUrl', async () => {
    apiGetImpl = async () => ({
      code: 'MSG0006',
      data: [makeImg('empty', '')],
      meta: { requestId: '3', serverTime: 'now' },
    })
    const up = usePhotoUpload()
    await up.open(HOSPITAL)
    expect(up.images.value[0]?.presignedUrl).toBe('')
  })

  it('returns [] when body is error shape with code != MSG0006', async () => {
    apiGetImpl = async () => ({
      code: 'E9999',
      errors: [],
      meta: { requestId: '4', serverTime: 'now' },
    })
    const up = usePhotoUpload()
    await up.open(HOSPITAL)
    expect(up.images.value).toEqual([])
  })

  it('safeJson falls through on non-JSON raw string', async () => {
    apiGetImpl = async () => 'not-json' as unknown
    const up = usePhotoUpload()
    await up.open(HOSPITAL)
    expect(up.images.value).toEqual([])
  })

  it('safeJson handles empty string body ("") path', async () => {
    apiGetImpl = async () => ({
      statusCode: 200,
      body: '',
    })
    const up = usePhotoUpload()
    await up.open(HOSPITAL)
    expect(up.images.value).toEqual([])
    expect(up.lastStatus.value).toBe(200)
  })

  it('hasLambdaProxy becomes false when statusCode is non-integer string (toStatus returns null)', async () => {
    apiGetImpl = async () => ({
      statusCode: 'oops', // toStatus -> null, so treated as NON-proxy
      body: { any: 'thing' },
    })
    const up = usePhotoUpload()
    await up.open(HOSPITAL)
    expect(up.images.value).toEqual([])
    // lastStatus remains default 200 from unwrapLambda
    expect(up.lastStatus.value).toBe(200)
  })

  it('invalid FacilityImage array (type guard fails) results in []', async () => {
    apiGetImpl = async () => ({
      code: 'MSG0006',
      data: [{ displayName: 123, relativePath: true, presignedUrl: null }],
      meta: { requestId: 'bad', serverTime: 'now' },
    })
    const up = usePhotoUpload()
    await up.open(HOSPITAL)
    expect(up.images.value).toEqual([])
  })

  it('on 500 routes to /error and sets lastStatus to 500', async () => {
    apiGetImpl = async () => {
      throw new TypeError('boom')
    }
    nextHttpError = { statusCode: 500 }
    const up = usePhotoUpload()
    await up.open(HOSPITAL)
    expect(routerReplaceLog).toEqual(['/error'])
    expect(up.lastStatus.value).toBe(500)
    expect(up.images.value).toEqual([])
  })

  it('on 503 applies errors to TOP list (applyErrorsToPage) and keeps images empty', async () => {
    apiGetImpl = async () => {
      throw new Error('service unavailable')
    }
    nextHttpError = { statusCode: 503, data: { code: 'E503', errors: [] } }
    const up = usePhotoUpload()
    await up.open(HOSPITAL)
    expect(appliedErrors.length).toBe(1)
    expect(topErrorList.value).toEqual(['applied:E503'])
    expect(up.images.value).toEqual([])
  })

  it('on 404 applies errors to getPhotoErrorList and clears images, returns early', async () => {
    apiGetImpl = async () => {
      throw new Error('not found')
    }
    nextHttpError = { statusCode: 404, data: { code: 'E404', errors: [] } }
    const up = usePhotoUpload()
    up.images.value = [makeImg('seed', 'https://xx')]
    await up.open(HOSPITAL)
    expect(getPhotoErrorList.value).toEqual(['applied:E404'])
    expect(up.images.value).toEqual([])
  })

  it('network-like because statusCode === 0 (TypeError thrown) -> sets dialogError/topErrorList and clears images', async () => {
    apiGetImpl = async () => {
      throw new TypeError('network down')
    }
    nextHttpError = { statusCode: 0 } // network-like
    nextNetworkMessage = '(network)'
    const up = usePhotoUpload()
    await up.open(HOSPITAL)
    expect(up.dialogError.value).toContain('(network)')
    expect(topErrorList.value[0]).toContain('(network)')
    expect(up.images.value).toEqual([])
  })

  it('network-like because statusCode is undefined -> sets dialogError/topErrorList and clears images', async () => {
    apiGetImpl = async () => {
      throw new Error('unknown status')
    }
    nextHttpError = { statusCode: undefined } // considered network-like by isNetworkLike
    nextNetworkMessage = '(no-status)'
    const up = usePhotoUpload()
    await up.open(HOSPITAL)
    expect(up.dialogError.value).toContain('(no-status)')
    expect(topErrorList.value[0]).toContain('(no-status)')
    expect(up.images.value).toEqual([])
  })

  it('generic non-network error (e.g., 400) clears images without routing', async () => {
    apiGetImpl = async () => {
      throw new Error('bad request')
    }
    nextHttpError = { statusCode: 400, data: { code: 'E400', errors: [] } }
    const up = usePhotoUpload()
    await up.open(HOSPITAL)
    expect(routerReplaceLog).toEqual([])
    expect(up.images.value).toEqual([])
  })

  it('watch(category) reloads when dialog is open (api called again)', async () => {
    // first load returns one image
    apiGetImpl = async () => ({
      code: 'MSG0006',
      data: [makeImg('one', 'https://a')],
      meta: { requestId: '5', serverTime: 'now' },
    })
    const up = usePhotoUpload()
    await up.open(HOSPITAL)
    expect(up.images.value.map((i: FacilityImage) => i.displayName)).toEqual(['one'])
    const initialCalls = apiGetLog.length

    // Change impl and category to trigger watch reload
    apiGetImpl = async () => ({
      code: 'MSG0006',
      data: [makeImg('two', 'file2.jpg')],
      meta: { requestId: '6', serverTime: 'now' },
    })
    up.category.value = CLINIC
    await nextTick()
    await flushPromises()

    expect(apiGetLog.length).toBeGreaterThan(initialCalls)
    expect(up.images.value.map((i: FacilityImage) => i.displayName)).toEqual(['two'])
    expect(up.images.value[0]?.presignedUrl).toBe('/file2.jpg')
  })

  it('open() and close() toggle the dialog correctly', async () => {
    const up = usePhotoUpload()
    apiGetImpl = async () => ({
      code: 'MSG0006',
      data: [],
      meta: { requestId: '7', serverTime: 'now' },
    })
    await up.open(HOSPITAL)
    expect(up.dialog.value).toBe(true)
    up.close()
    expect(up.dialog.value).toBe(false)
  })

  it('sets lastStatus from proxy "statusCode" when provided as number', async () => {
    apiGetImpl = async () => ({
      statusCode: 207,
      body: JSON.stringify({
        code: 'MSG0006',
        data: [makeImg('z', 'https://z')],
        meta: { requestId: '8', serverTime: 'now' },
      }),
    })
    const up = usePhotoUpload()
    await up.open(HOSPITAL)
    expect(up.lastStatus.value).toBe(207)
  })
})

// for lumbra
describe('helper: hasLambdaProxy', () => {
  it('returns true for proxy envelope with numeric statusCode and string body', async () => {
    const { hasLambdaProxy } = await importSUT()
    const input = { statusCode: 200, body: '{"ok":true}' }
    expect(hasLambdaProxy(input)).toBe(true)
  })

  it('returns true for proxy envelope with string statusCode and object body', async () => {
    const { hasLambdaProxy } = await importSUT()
    const input = { statusCode: '200', body: { code: 'MSG0006' } }
    expect(hasLambdaProxy(input)).toBe(true)
  })

  it('returns false when body is missing', async () => {
    const { hasLambdaProxy } = await importSUT()
    const input = { statusCode: 200 } as unknown
    expect(hasLambdaProxy(input)).toBe(false)
  })

  it('returns false for non-record inputs', async () => {
    const { hasLambdaProxy } = await importSUT()
    expect(hasLambdaProxy(null)).toBe(false)
    expect(hasLambdaProxy('string')).toBe(false)
    expect(hasLambdaProxy(42)).toBe(false)
    expect(hasLambdaProxy([])).toBe(false)
  })
})

describe('helper: unwrapLambda', () => {
  it('unpacks proxy with numeric statusCode and JSON string body', async () => {
    const { unwrapLambda } = await importSUT()
    const raw = {
      statusCode: 201,
      body: JSON.stringify({ code: 'MSG0006', data: { photos: [] }, meta: { requestId: 'r', serverTime: 't' } }),
    }
    const { httpStatus, envelope } = unwrapLambda<typeof raw.body>(raw)
    expect(httpStatus).toBe(201)
    expect(envelope).toMatchObject({ code: 'MSG0006', data: { photos: [] } })
  })

  it('unpacks proxy with string statusCode and object body (no JSON parse needed)', async () => {
    const { unwrapLambda } = await importSUT()
    const raw = {
      statusCode: '200',
      body: { code: 'MSG0006', data: { photos: [] } },
    }
    const { httpStatus, envelope } = unwrapLambda<typeof raw.body>(raw)
    expect(httpStatus).toBe(200)
    expect(envelope).toMatchObject({ code: 'MSG0006', data: { photos: [] } })
  })

 it('keeps default 200 when statusCode is non-integer string (treated as non-proxy for status)', async () => {
  const { unwrapLambda } = await importSUT()
  const raw = { statusCode: 'oops', body: { any: 'thing' } }

  const { httpStatus, envelope } = unwrapLambda<typeof raw>(raw)

  expect(httpStatus).toBe(200)
  expect(envelope).toEqual(raw)              
})

  it('passes through plain (non-proxy) objects untouched, defaulting to 200', async () => {
    const { unwrapLambda } = await importSUT()
    const raw = { code: 'MSG0006', data: { photos: [] } }
    const { httpStatus, envelope } = unwrapLambda<typeof raw>(raw)
    expect(httpStatus).toBe(200)
    expect(envelope).toBe(raw)
  })

  it('parses stringified proxy envelope', async () => {
    const { unwrapLambda } = await importSUT()
    const stringified = JSON.stringify({
      statusCode: '200',
      body: JSON.stringify({ code: 'MSG0006', data: { photos: [{ displayName: 'x', relativePath: '/x', presignedUrl: 'u' }] } }),
    })
    const { httpStatus, envelope } = unwrapLambda<Record<string, unknown>>(stringified)
    expect(httpStatus).toBe(200)
    expect(envelope).toMatchObject({
      code: 'MSG0006',
      data: { photos: [{ displayName: 'x', relativePath: '/x', presignedUrl: 'u' }] },
    })
  })
})

describe('helper: isFacilityImageArray', () => {
  it('accepts a valid FacilityImage[]', async () => {
    const { isFacilityImageArray } = await importSUT()
    const ok: FacilityImage[] = [
      { displayName: 'a', relativePath: '/rel/a.jpg', presignedUrl: 'https://cdn/a.jpg' },
      { displayName: 'b', relativePath: '/rel/b.jpg', presignedUrl: '/b.jpg' },
    ]
    expect(isFacilityImageArray(ok)).toBe(true)
  })

  it('rejects when any element has wrong types', async () => {
    const { isFacilityImageArray } = await importSUT()
    const bad = [{ displayName: 123, relativePath: true, presignedUrl: null }] as unknown
    expect(isFacilityImageArray(bad)).toBe(false)
  })

  it('rejects non-arrays', async () => {
    const { isFacilityImageArray } = await importSUT()
    expect(isFacilityImageArray(null)).toBe(false)
    expect(isFacilityImageArray({})).toBe(false)
    expect(isFacilityImageArray('not-an-array')).toBe(false)
  })
})

describe('helper: isPhotosSuccessInnerFlat', () => {
  it('accepts shape: {code:"MSG0006", data: FacilityImage[]}', async () => {
    const { isPhotosSuccessInnerFlat } = await importSUT()
    const flatOk = {
      code: 'MSG0006',
      data: [{ displayName: 'a', relativePath: '/rel/a.jpg', presignedUrl: 'https://cdn/a.jpg' }],
    }
    expect(isPhotosSuccessInnerFlat(flatOk)).toBe(true)
  })

  it('rejects when code != MSG0006', async () => {
    const { isPhotosSuccessInnerFlat } = await importSUT()
    const flatBadCode = { code: 'E9999', data: [] }
    expect(isPhotosSuccessInnerFlat(flatBadCode)).toBe(false)
  })

  it('rejects when data is not FacilityImage[]', async () => {
    const { isPhotosSuccessInnerFlat } = await importSUT()
    const flatBadData = { code: 'MSG0006', data: [{ bad: true }] }
    expect(isPhotosSuccessInnerFlat(flatBadData)).toBe(false)
  })
})

describe('helper: isPhotosSuccessInnerNested', () => {
  it('accepts shape: {code:"MSG0006", data:{ photos: FacilityImage[] }}', async () => {
    const { isPhotosSuccessInnerNested } = await importSUT()
    const nestedOk = {
      code: 'MSG0006',
      data: { photos: [{ displayName: 'n', relativePath: '/rel/n.jpg', presignedUrl: 'data:image/png;base64,xx' }] },
    }
    expect(isPhotosSuccessInnerNested(nestedOk)).toBe(true)
  })

  it('rejects when code != MSG0006', async () => {
    const { isPhotosSuccessInnerNested } = await importSUT()
    const nestedBadCode = { code: 'E404', data: { photos: [] } }
    expect(isPhotosSuccessInnerNested(nestedBadCode)).toBe(false)
  })

  it('rejects when data.photos is not FacilityImage[]', async () => {
    const { isPhotosSuccessInnerNested } = await importSUT()
    const nestedBadPhotos = { code: 'MSG0006', data: { photos: [{ nope: 1 }] } }
    expect(isPhotosSuccessInnerNested(nestedBadPhotos)).toBe(false)
  })

  it('rejects non-record inputs', async () => {
    const { isPhotosSuccessInnerNested } = await importSUT()
    expect(isPhotosSuccessInnerNested(null)).toBe(false)
    expect(isPhotosSuccessInnerNested('x')).toBe(false)
  })
})
// 
describe('helper: isFacilityImageArray (extra edge cases)', () => {
 
  it('rejects when relativePath is missing', async () => {
    const { isFacilityImageArray } = await importSUT()
    const bad = [{ displayName: 'a', presignedUrl: '/a.jpg' }] as unknown
    expect(isFacilityImageArray(bad)).toBe(false)
  })

  it('rejects when presignedUrl is missing', async () => {
    const { isFacilityImageArray } = await importSUT()
    const bad = [{ displayName: 'a', relativePath: '/a.jpg' }] as unknown
    expect(isFacilityImageArray(bad)).toBe(false)
  })
})

describe('helper: isPhotosSuccessInnerNested – guards for non-record data', () => {
 
  it('returns false when data is a primitive string', async () => {
    const { isPhotosSuccessInnerNested } = await importSUT()
    const v = { code: 'MSG0006', data: 'oops', meta: { requestId: 'r', serverTime: 't' } }
    expect(isPhotosSuccessInnerNested(v)).toBe(false)
  })

  it('returns false when data is a record but `photos` is missing', async () => {
    const { isPhotosSuccessInnerNested } = await importSUT()
    const v = { code: 'MSG0006', data: {}, meta: { requestId: 'r', serverTime: 't' } }
    expect(isPhotosSuccessInnerNested(v)).toBe(false)
  })

  it('returns false when data is a record and photos is not an array', async () => {
    const { isPhotosSuccessInnerNested } = await importSUT()
    const v = { code: 'MSG0006', data: { photos: 'not-an-array' }, meta: { requestId: 'r', serverTime: 't' } }
    expect(isPhotosSuccessInnerNested(v)).toBe(false)
  })

  it('returns false when photos array contains a primitive (non-record)', async () => {
    const { isPhotosSuccessInnerNested } = await importSUT()
    const v = { code: 'MSG0006', data: { photos: [42] }, meta: { requestId: 'r', serverTime: 't' } }
    expect(isPhotosSuccessInnerNested(v)).toBe(false)
  })

})

describe('helper: safeJson – missing branches', () => {
  it('returns the input as-is when value is not a string', async () => {
    const { safeJson } = await importSUT()
    const obj = { a: 1 }
    expect(safeJson(obj)).toBe(obj) // non-string early return
  })

  it('returns empty string when input is whitespace-only (trim → empty)', async () => {
    const { safeJson } = await importSUT()
    expect(safeJson('   \n\t  ')).toBe('') // hits: trim + !s
  })

  it('returns the original string when JSON.parse throws (malformed JSON)', async () => {
    const { safeJson } = await importSUT()
    const raw = '{ bad json ]'
    expect(safeJson(raw)).toBe(raw) // hits: catch → return v
  })

  it('parses valid JSON string successfully', async () => {
    const { safeJson } = await importSUT()
    const out = safeJson('{"ok":true,"n":1}')
    expect(out).toEqual({ ok: true, n: 1 }) // happy-path
  })
})
describe('helper: toStatus – missing branches', () => {
  it('returns the same number when given an integer number', async () => {
    const { toStatus } = await importSUT()
    expect(toStatus(204)).toBe(204) // hits first if
  })

  it('returns parsed integer when given a numeric string', async () => {
    const { toStatus } = await importSUT()
    expect(toStatus('404')).toBe(404) // hits string → Number → isInteger
  })

  it('returns null for non-integer numeric string', async () => {
    const { toStatus } = await importSUT()
    expect(toStatus('200.5')).toBeNull() // Number is 200.5 → not integer → null
  })

  it('returns null for undefined / non-parsable inputs', async () => {
    const { toStatus } = await importSUT()
    expect(toStatus(undefined)).toBeNull()
    expect(toStatus('oops')).toBeNull()
    expect(toStatus(null as unknown)).toBeNull()
  })
})
describe('helper: resolveUrl', () => {
  it('returns empty string for undefined or empty input', async () => {
    const { resolveUrl } = await importSUT()
    // `u?: string` already allows undefined; no cast needed
    expect(resolveUrl(undefined)).toBe('')
    expect(resolveUrl('')).toBe('')
  })

  it('passes through http / https / data URLs', async () => {
    const { resolveUrl } = await importSUT()
    expect(resolveUrl('http://example.com/a.png')).toBe('http://example.com/a.png')
    expect(resolveUrl('https://cdn.example.com/b.png')).toBe('https://cdn.example.com/b.png')
    expect(resolveUrl('data:image/png;base64,xxx')).toBe('data:image/png;base64,xxx')
  })

  it('BASE_URL ends with "/" and u starts with "/" → no extra slash', async () => {
    vi.resetModules()
    vi.stubEnv('BASE_URL', '/app/')
    const { resolveUrl } = await importSUT()
    expect(resolveUrl('/img.png')).toBe('/app/img.png')

    vi.unstubAllEnvs()
  })
})




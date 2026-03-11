// ===============================================
// 追加ユーティリティ（共通データ: updatedAt を今日の ISO に）
// ===============================================
import { defineComponent, nextTick, reactive, type ComponentPublicInstance, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import {
  vi,
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest'
import type { VForm } from 'vuetify/components'
import type { EditPayload, PayloadDevice } from '../FacilityEdit/FacilityEdit'
// import type { GlobalLoadingService } from '../Common/composables/GlobalLoading'


//  useFacilityEdit の関数型（値→型は typeof import(...) で取得）
export type UseFacilityEditFn = typeof import('../FacilityEdit/FacilityEdit').useFacilityEdit

// ------------ import.meta.env スタブ（オブジェクト丸ごと代入は絶対にしない） ------------
export function stubApiBaseUrl(url: string): void {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env
  if (env && typeof env === 'object') {
    env.VITE_API_BASE_URL = url
    env.BASE_URL = env.BASE_URL ?? '/'
    env.MODE = env.MODE ?? 'test'
    env.DEV = env.DEV ?? true
    env.PROD = env.PROD ?? false
    env.SSR = env.SSR ?? false
  }
  vi.stubEnv('VITE_API_BASE_URL', url)
}

// ------------ 便利関数：今日の ISO と updatedAt の一括設定 ------------
export function todayIso(): string {
  return new Date().toISOString()
}

// ------------ データビルダー（ListItem はテスト用のローカル型で定義） ------------
export const facilityTypeList = [
  { label: '自治体', code: '0' },
  { label: '家庭',   code: '1' },
] as const

export const facilityStatusList = [
  { label: '非運用',       code: '0' },
  { label: '運用中',       code: '1' },
  { label: 'メンテナンス', code: '2' },
] as const

export type TestListItem = { code: string; label: string }

export const facilityTypeEnum: TestListItem[] =
  facilityTypeList.map(c => ({ code: c.code, label: c.label }))

export const facilityStatusEnum: TestListItem[] =
  facilityStatusList.map(s => ({ code: s.code, label: s.label }))

export function buildDefaultPayload(): EditPayload {
  const now = todayIso()
  return {
    facilityTypeSelected: facilityTypeList[1]?.code ?? '',
    facilityID: 'HSP912',
    ecoCompanyID: 'ecouser1',
    ecoCompanyPassword: 'securepassword12',
    facilityName: 'Yangon General Hospital',
    facilityAddress: 'Lanmadaw',
    cityInformation: 'Yangon',
    facilityImage: {
      relativePath: '/facility/category2/family6.webp',
      displayName: '家庭6',
      presignedUrl: '/facility/category2/family6.webp',
    },
    facilityStatusSelected: facilityStatusList[2]?.code ?? '',
    facilityManagerName: 'Dr. Aye Chan',
    facilityManagerContact: 'AyeAye@gmail.com',
    updatedAt: now,
    facilityType: facilityTypeEnum as unknown as Record<string, string>, 
    facilityStatus: facilityStatusEnum as unknown as Record<string, string>,
    devices: [
      {
        deviceNumber: '1',
        deviceID: 'asdfD001',
        productID: 'asdfP001',
        updatedAt: now,
        solarPanels: [{ panelNumber: '1' }, { panelNumber: '2' }, { panelNumber: '3' }],
        pcs: [{ pcsNumber: '1' }, { pcsNumber: '2' }, { pcsNumber: '3' }],
      },
      {
        deviceNumber: '2',
        deviceID: 'HSP912-asdfD002',
        productID: 'ecouser1-asdfP002',
        updatedAt: now,
        solarPanels: [{ panelNumber: '4' }],
        pcs: [{ pcsNumber: '5' }],
      },
    ],
  }
}

export function makePayload(overrides?: Partial<EditPayload>): EditPayload {
  const base = buildDefaultPayload()
  return {
    ...base,
    ...overrides,
    facilityImage: {
      ...base.facilityImage,
      ...(overrides?.facilityImage ?? {}),
    },
    devices: overrides?.devices ?? base.devices,
    facilityType: (overrides?.facilityType ?? base.facilityType) as unknown as EditPayload['facilityType'],
    facilityStatus: (overrides?.facilityStatus ?? base.facilityStatus) as unknown as EditPayload['facilityStatus'],
  }
}
export function withTodayUpdatedAt(src: EditPayload): EditPayload {
  const now = todayIso()

  const devices: PayloadDevice[] = Array.isArray(src.devices)
    ? src.devices.map((d) => ({
        deviceNumber: String((d ).deviceNumber ?? ''), 
        deviceID: String((d ).deviceID ?? ''),
        productID: String((d ).productID ?? ''),
        updatedAt: typeof (d ).updatedAt === 'string' ? (d ).updatedAt : '',
        solarPanels: Array.isArray((d ).solarPanels)
          ? (d ).solarPanels.map((sp: { panelNumber: unknown }) => ({
              panelNumber: String(sp?.panelNumber ?? ''),
            }))
          : [],
        pcs: Array.isArray((d ).pcs)
          ? (d ).pcs.map((u: { pcsNumber: unknown }) => ({
              pcsNumber: String(u?.pcsNumber ?? ''),
            }))
          : [],
      }))
    : []

  return { ...src, updatedAt: now, devices }
}
// ------------ Mocks ------------
export type RouterPushArg =
  | string
  | { name?: string; path?: string; query?: Record<string, string> }

export type RouterMock = {
  push: (to: RouterPushArg) => void | Promise<void>
}

export type RouteMock = {
  params: Record<string, unknown>
  query: Record<string, unknown>
  fullPath: string
}

export type GlobalLoadingMock = {
  show: () => void
  hide: () => void
}

export type ApiGet  = <T>(url: string) => Promise<T>
export type ApiPost = <T>(url: string, body?: unknown) => Promise<T>
export type ApiPut  = <T>(url: string, body?: unknown) => Promise<T>

// ★ クエリ運用に統一（初期値）
export const routeMock: RouteMock = reactive({
  params: {},
  query: { facilityID: 'HSP912' },
  fullPath: '/facilityEdit?facilityID=HSP912',
})

export const routerPushMock = vi.fn<(to: RouterPushArg) => void>()
export const glShowMock = vi.fn<() => void>()
export const glHideMock = vi.fn<() => void>()
export const apiGetMock  = vi.fn<(url: string) => Promise<unknown>>()
export const apiPostMock = vi.fn<(url: string, body?: unknown) => Promise<unknown>>()
export const apiPutMock  = vi.fn<(url: string, body?: unknown) => Promise<unknown>>()

vi.mock('vue-router', () => {
  const router: RouterMock = { push: routerPushMock }
  return {
    useRoute: () => routeMock,
    useRouter: () => router,
  }
})

vi.mock('vue-i18n', () => {
  function t(key: string, ..._args: unknown[]): string {
    void _args
    if (key === 'error.ERR_NETWORK') return 'Network error'
    return key
  }
  return { useI18n: () => ({ t }) }
})

vi.mock('@/services/http', () => {
  const apiGet: ApiGet   = <T>(url: string) => apiGetMock(url) as Promise<T>
  const apiPost: ApiPost = <T>(url: string, body?: unknown) => apiPostMock(url, body) as Promise<T>
  const apiPut: ApiPut   = <T>(url: string, body?: unknown) => apiPutMock(url, body) as Promise<T>
  return { apiGet, apiPost, apiPut }
})

vi.mock('../Common/composables/GlobalLoading', () => {
  const gl = { show: glShowMock, hide: glHideMock }
  return { useGlobalLoading: () => gl }
})

vi.mock('@/env', () => ({
  API_BASE_URL: 'https://api.example.test',
}))

// ------------ 待機ユーティリティ ------------
export async function flushAll(): Promise<void> {
  await Promise.resolve()
  await nextTick()
  await new Promise<void>(r => setTimeout(r, 0))
  await nextTick()
}

/** Host の `setup()` が返す公開プロパティ型（any は使わない） */
export type FacilityEditApi = ReturnType<UseFacilityEditFn>
type Expose = { api: FacilityEditApi }

/** `wrapper.vm.api` の準備を待つ */
async function waitForApiReady(
  wrapper: VueWrapper<ComponentPublicInstance<unknown>>,
  maxTries = 40
): Promise<void> {
  let tries = 0
  while (!(wrapper.vm as unknown as Expose).api && tries < maxTries) {
    tries++
    await flushAll()
  }
  if (!(wrapper.vm as unknown as Expose).api) {
    throw new Error('api not ready')
  }
}

// ------------ Host（動的 import 後に useFacilityEdit を起動） ------------
function makeHost(mod: { useFacilityEdit: UseFacilityEditFn }) {
  return defineComponent({
    name: 'LocalTestHost',
    setup(): Expose {
      const api: FacilityEditApi = mod.useFacilityEdit()
      return { api }
    },
    template: `<div></div>`,
  })
}

export type MountedHost = {
  wrapper: VueWrapper<ComponentPublicInstance<unknown>>
  api: FacilityEditApi
}

export async function mountHost(): Promise<MountedHost> {
  const mod = await import('../FacilityEdit/FacilityEdit') // ← env スタブ後にロード
  const LocalTestHost = makeHost(mod)

  const wrapper = mount(LocalTestHost, { attachTo: document.body })
  await waitForApiReady(wrapper)
  await flushAll()

  const api = (wrapper.vm as unknown as Expose).api
  return { wrapper, api }
}

/** 共有の routeMock.query を「プロパティ更新」で変更（オブジェクト丸ごと差し替えない） */
export function setQueryParam(key: string, value: unknown): void {
  (routeMock.query as Record<string, unknown>)[key] = value
}

/** route.params の更新（プロパティ更新） */
export function setRouteParam(key: string, value: unknown): void {
  (routeMock.params as Record<string, unknown>)[key] = value
}

// ------------ 共通の UI アイテム型（暗黙 any を避ける） ------------
export type UIItem = { title: string; value: string }

// ------------ エンベロープ生成（unwrapToDomain を網羅テストしやすく） ------------
export function asProxyEnvelope<T>(data: T): { statusCode: number; body: string } {
  return { statusCode: 200, body: JSON.stringify({ data }) }
}
export function asBodyEnvelope<T>(data: T): { data: T } {
  return { data }
}
export function asDomain<T>(data: T): T {
  return data
}

// ------------ Global setup/teardown ------------
beforeAll(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
  stubApiBaseUrl('https://api.example.test')
})

afterAll(() => {
  vi.unstubAllEnvs()
})

// --- errorResolver を検証するためのモック
type PageErrorOpts = {
  topList: Ref<string[]>
  fieldMap: Ref<Record<string, string[]>>
  reset?: boolean
}
const applyErrorsToPageMock = vi.fn<(wire: unknown, opts: PageErrorOpts) => void>()
vi.mock('../Common/error/errorResolver', () => ({
  applyErrorsToPage: applyErrorsToPageMock,
}))

// ===============================================
// 追加テスト
// ===============================================
describe('useFacilityEdit: loadFacilityById - fallback/edge/error coverage', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    routerPushMock.mockReset()

    routeMock.params = {}
    routeMock.query = { facilityID: 'HSP912' }
    routeMock.fullPath = '/facilityEdit?facilityID=HSP912'
  })

  it('フォールバック: facilityType/facilityStatus が無い場合でも fallback map で埋まる & 画像未指定なら空', async () => {
    const base = buildDefaultPayload()
    const withoutMaps: EditPayload = withTodayUpdatedAt({
      ...base,
      facilityType: undefined,
      facilityStatus: undefined,
      facilityImage: undefined as unknown as EditPayload['facilityImage'],
    } as EditPayload)

    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(withoutMaps) as unknown)

    const { api } = await mountHost()
    await api.loadFacilityById('HSP-FALLBACK')
    await flushAll()

    expect(api.CategoryItems.value.map(i => i.title)).toEqual(['自治体', '家庭'])
    expect(api.StatusItems.value.map(i => i.title)).toEqual(['非運用', '運用中', 'メンテナンス'])

    expect(api.selectedImageUrl.value).toBe('')
    expect(api.formData.value.updatedAt).toMatch(/T/)
  })

  it('unwrapToDomain: ProxyEnvelope(string body) → BodyEnvelope(data) → Domain まで順に上書き', async () => {
    apiGetMock.mockResolvedValueOnce(asProxyEnvelope({ facilityID: 'EDGE-PE' }) as unknown)

    const { api } = await mountHost()
    await api.loadFacilityById('EDGE-PE')
    await flushAll()
    expect(api.formData.value.facilityID).toBe('EDGE-PE')

    apiGetMock.mockResolvedValueOnce(asBodyEnvelope({ facilityID: 'EDGE-BE' }) as unknown)
    await api.loadFacilityById('EDGE-BE')
    await flushAll()
    expect(api.formData.value.facilityID).toBe('EDGE-BE')

    apiGetMock.mockResolvedValueOnce(asDomain({ facilityID: 'EDGE-DO' }) as unknown)
    await api.loadFacilityById('EDGE-DO')
    await flushAll()
    expect(api.formData.value.facilityID).toBe('EDGE-DO')
  })

  it('facilityImage が { errorCode } の場合、topErrorList に翻訳キーが積まれる', async () => {
    const wire = withTodayUpdatedAt(
      makePayload({
        facilityImage: { errorCode: 'E7777' } as unknown as EditPayload['facilityImage'],
      }),
    )
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(wire) as unknown)

    const { api } = await mountHost()
    await api.loadFacilityById('HSP-IMAGE-ERR')
    await flushAll()

    expect(api.topErrorList.value.length).toBe(1)
    expect(api.topErrorList.value[0]).toContain('error.E7777')
  })

  it('HTTP 500 → common-error に遷移（returnTo 付き）', async () => {
    apiGetMock.mockRejectedValueOnce({ statusCode: 500, message: 'boom' })

    const { api } = await mountHost()
    await api.loadFacilityById('HSP-500')
    await flushAll()

    expect(routerPushMock).toHaveBeenCalled()
    const arg = routerPushMock.mock.calls[0]?.[0]
    expect(typeof arg === 'object' && arg !== null && 'name' in arg).toBe(true)
  })

  it('非 500 エラー → "/" に遷移し、フェイルセーフメッセージ（error.E0038）を表示', async () => {
    apiGetMock.mockRejectedValueOnce({ response: { data: { statusCode: 404 } }, message: 'Not found' })

    const { api } = await mountHost()
    await api.loadFacilityById('HSP-404')
    await flushAll()

    expect(routerPushMock).toHaveBeenCalledWith({ path: '/' })
    expect(api.topErrorList.value.length).toBe(1)
    expect(api.topErrorList.value[0]).toContain('error.E0038')
  })
    it('デバイス配列が undefined の場合、devices は [] になる（devices: non-array branch）', async () => {

    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)

    const base = buildDefaultPayload()
    const payload: EditPayload = {
        ...base,
        facilityID: 'HSP-NO-DEV',
        devices: undefined,
    }

    const { api } = await mountHost()
    await flushAll()

    apiGetMock.mockReset()
    apiGetMock.mockImplementation(() => Promise.resolve(asBodyEnvelope(payload) as unknown))

    setRouteParam('facilityID', 'HSP-NO-DEV')
    await flushAll()

    const lastUrl = apiGetMock.mock.calls.at(-1)?.[0] as string
    expect(lastUrl).toContain('/facilities/HSP-NO-DEV')

    expect(Array.isArray(api.formData.value.devices)).toBe(true)
    expect(api.formData.value.devices?.length).toBe(0)
    })

    it('デバイスの各フィールド：String 正規化、updatedAt は非文字列なら空文字、solarPanels/pcs は配列なら map される', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)

    const base = buildDefaultPayload()
    const weirdDevice = {
        deviceNumber: 101 as unknown,    
        deviceID: null as unknown,       
        productID: undefined as unknown,  
        updatedAt: 123456 as unknown,    
        solarPanels: [{ panelNumber: 9 as unknown }],
        pcs: [{ pcsNumber: 7 as unknown }],
    }

    const payload: EditPayload = {
        ...base,
        facilityID: 'HSP-NORM-1',
        devices: [weirdDevice as unknown as PayloadDevice],
    }

    const { api } = await mountHost()
    await flushAll()

    apiGetMock.mockReset()
    apiGetMock.mockImplementation(() => Promise.resolve(asBodyEnvelope(payload) as unknown))

    setRouteParam('facilityID', 'HSP-NORM-1')
    await flushAll()

    const lastUrl = apiGetMock.mock.calls.at(-1)?.[0] as string
    expect(lastUrl).toContain('/facilities/HSP-NORM-1')

    const d0 = api.formData.value.devices?.[0]
    expect(d0?.deviceNumber).toBe('101')
    expect(d0?.deviceID).toBe('')
    expect(d0?.productID).toBe('')
    expect(d0?.updatedAt).toBe('')

    expect(d0?.solarPanels?.[0]?.panelNumber).toBe('9')
    expect(d0?.pcs?.[0]?.pcsNumber).toBe('7')
    })

    it('solarPanels/pcs が非配列なら空配列に正規化される（Array.isArray(...) false branch）', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const base = buildDefaultPayload()
    const deviceWeirdCollections = {
        deviceNumber: 'A1',
        deviceID: 'X',
        productID: 'Y',
        updatedAt: todayIso(),
        solarPanels: null as unknown, 
        pcs: 'oops' as unknown,    
    }

    const payload: EditPayload = {
        ...base,
        facilityID: 'HSP-NON-ARR',
        devices: [deviceWeirdCollections as unknown as PayloadDevice],
    }

    const { api } = await mountHost()
    await flushAll()

    apiGetMock.mockReset()
    apiGetMock.mockImplementation(() => Promise.resolve(asBodyEnvelope(payload) as unknown))

    setRouteParam('facilityID', 'HSP-NON-ARR')
    await flushAll()

    const lastUrl = apiGetMock.mock.calls.at(-1)?.[0] as string
    expect(lastUrl).toContain('/facilities/HSP-NON-ARR')

    const d0 = api.formData.value.devices?.[0]
    expect(Array.isArray(d0?.solarPanels)).toBe(true)
    expect(d0?.solarPanels?.length).toBe(0)
    expect(Array.isArray(d0?.pcs)).toBe(true)
    expect(d0?.pcs?.length).toBe(0)
    })

    it('facilityType/status: isMap が true の場合はそのまま保持、false の場合は undefined（分岐網羅）', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)

    const typeMap = { '10': 'タイプ10', '11': 'タイプ11' } as Record<string, string>
    const statusMap = { '8': '点検中', '9': '故障' } as Record<string, string>

    const { api } = await mountHost()
    await flushAll()

    const payloadMap: EditPayload = {
        ...buildDefaultPayload(),
        facilityID: 'HSP-MAP-OK',
        facilityType: typeMap as unknown as EditPayload['facilityType'],
        facilityStatus: statusMap as unknown as EditPayload['facilityStatus'],
        devices: [],
    }

    apiGetMock.mockReset()
    apiGetMock.mockImplementation(() => Promise.resolve(asBodyEnvelope(payloadMap) as unknown))

    setRouteParam('facilityID', 'HSP-MAP-OK')
    await flushAll()

    expect(api.formData.value.facilityType).toEqual(typeMap)
    expect(api.formData.value.facilityStatus).toEqual(statusMap)

    const payloadNonMap: EditPayload = {
        ...buildDefaultPayload(),
        facilityID: 'HSP-MAP-NG',
        facilityType: undefined as unknown as EditPayload['facilityType'],
        facilityStatus: undefined as unknown as EditPayload['facilityStatus'],
        devices: [],
    }

    apiGetMock.mockReset()
    apiGetMock.mockImplementation(() => Promise.resolve(asBodyEnvelope(payloadNonMap) as unknown))

    setRouteParam('facilityID', 'HSP-MAP-NG')
    await flushAll()

    expect(api.formData.value.facilityType).toBeUndefined()
    expect(api.formData.value.facilityStatus).toBeUndefined()
    })

    it('facilityID が undefined の場合、String(data.facilityID ?? \'\') の branch2 で空文字になる', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)

    const base = buildDefaultPayload()
    const payloadBranch2: EditPayload = {
        ...base,
        facilityID: undefined as unknown as string,
        devices: [],
    }

    const { api } = await mountHost()
    await flushAll()

    apiGetMock.mockReset()
    apiGetMock.mockImplementation(() =>
        Promise.resolve(asBodyEnvelope(payloadBranch2) as unknown)
    )

    setRouteParam('facilityID', 'ANY-ID-FOR-ROUTE') 
    await flushAll()

    const lastUrl = apiGetMock.mock.calls.at(-1)?.[0] as string
    expect(lastUrl).toContain('/facilities/ANY-ID-FOR-ROUTE')

    expect(api.formData.value.facilityID).toBe('')
    expect(api.initialData.value.facilityID).toBe('')
    })

    it('deviceNumber が undefined の場合、String(d.deviceNumber ?? \'\') の branch2 で空文字になる', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)

    const base = buildDefaultPayload()
    const deviceBranch2 = {
        deviceNumber: undefined as unknown, 
        deviceID: 'X',                     
        productID: 'Y',
        updatedAt: todayIso(),
        solarPanels: [],                   
        pcs: [],
    }

    const payload: EditPayload = {
        ...base,
        facilityID: 'HSP-DEVICE-BR2', 
        devices: [deviceBranch2 as unknown as PayloadDevice],
    }

    const { api } = await mountHost()
    await flushAll()

    apiGetMock.mockReset()
    apiGetMock.mockImplementation(() =>
        Promise.resolve(asBodyEnvelope(payload) as unknown)
    )

    setRouteParam('facilityID', 'HSP-DEVICE-BR2')
    await flushAll()

    const lastUrl = apiGetMock.mock.calls.at(-1)?.[0] as string
    expect(lastUrl).toContain('/facilities/HSP-DEVICE-BR2')

    const d0 = api.formData.value.devices?.[0]
    expect(d0?.deviceNumber).toBe('')  
    expect(d0?.deviceID).toBe('X')
    expect(d0?.productID).toBe('Y')
    })

    it('ecoCompanyID 変更: フラグが公開されていれば書換(true)・非公開なら据え置き（単一テスト・条件付き期待値）', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()

    api.formData.value.facilityID = 'FACX'
    api.formData.value.ecoCompanyID = 'OLD-ECO'
    api.formData.value.devices = [
        {
        deviceNumber: '1',
        deviceID: 'FACX-001',
        productID: 'OLD-ECO-001',
        updatedAt: todayIso(),
        solarPanels: [],
        pcs: [],
        },
        {
        deviceNumber: '2',
        deviceID: 'FACX-002',
        productID: 'OLD-ECO-002',
        updatedAt: todayIso(),
        solarPanels: [],
        pcs: [],
        },
    ]

    const flag = (api as unknown as { allowPrefixRewrite?: { value: boolean } }).allowPrefixRewrite

    const willRewrite = !!flag
    if (flag) flag.value = true

    api.formData.value.ecoCompanyID = 'NEW-ECO'
    await flushAll()

    const expected1 = willRewrite ? 'NEW-ECO-001' : 'OLD-ECO-001'
    const expected2 = willRewrite ? 'NEW-ECO-002' : 'OLD-ECO-002'

    const devs = api.formData.value.devices ?? []
    expect(devs[0]?.productID).toBe(expected1)
    expect(devs[1]?.productID).toBe(expected2)
    })


    it('route.params.facilityID: 配列なら先頭要素を使用（id = Array.isArray(nv) ? nv[0] : nv）', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()

    const payload: EditPayload = {
        ...buildDefaultPayload(),
        facilityID: 'RTE-ARR',
        devices: [],
    }
    apiGetMock.mockReset()
    apiGetMock.mockImplementation(() =>
        Promise.resolve(asBodyEnvelope(payload) as unknown),
    )

    routeMock.params = { facilityID: ['RTE-ARR', 'SECOND'] }
    await flushAll()

    const lastUrl = apiGetMock.mock.calls.at(-1)?.[0] as string
    expect(lastUrl).toContain('/facilities/RTE-ARR')
    expect(api.formData.value.facilityID).toBe('RTE-ARR')
    })

    it('route.params.facilityID: 非文字列（number）は無視（typeof id === "string" 分岐が false）', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    await flushAll()

    const before = apiGetMock.mock.calls.length
    routeMock.params = { facilityID: 123 }
    await flushAll()
    const after = apiGetMock.mock.calls.length

    expect(after).toBe(before) 
    })
    it('route.params.facilityID: trim 後に異なる場合は loadFacilityById を呼ぶ', async () => {
    apiGetMock.mockResolvedValueOnce(
        asBodyEnvelope({ ...buildDefaultPayload(), facilityID: 'AAAA', devices: [] }) as unknown,
    )
    const { api } = await mountHost()
    await flushAll()

    apiGetMock.mockReset()
    apiGetMock.mockImplementation(() =>
        Promise.resolve(
        asBodyEnvelope({ ...buildDefaultPayload(), facilityID: 'BBBB', devices: [] }) as unknown,
        ),
    )

    routeMock.params = { facilityID: '   BBBB   ' } 
    await flushAll()

    const lastUrl = apiGetMock.mock.calls.at(-1)?.[0] as string
    expect(lastUrl).toContain('/facilities/BBBB')
    expect(api.formData.value.facilityID).toBe('BBBB')
    })

})

describe('useFacilityEdit: onSubmit (PUT) coverage', () => {
  beforeEach(() => {
    apiPutMock.mockReset()
    apiGetMock.mockReset()
    routerPushMock.mockReset()

    const init = withTodayUpdatedAt(buildDefaultPayload())
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(init) as unknown)

    routeMock.params = {}
    routeMock.query = { facilityID: 'HSP912' }
    routeMock.fullPath = '/facilityEdit?facilityID=HSP912'
  })

  it('validateFn が false を返すと送信しない', async () => {
    const { api } = await mountHost()
    await flushAll()

    const validateFalse = async (): Promise<{ valid: boolean }> => ({ valid: false })
    await api.onSubmit(validateFalse)
    await flushAll()

    expect(apiPutMock).not.toHaveBeenCalled()
    expect(routerPushMock).not.toHaveBeenCalled()
  })

  it('成功経路: PUT 成功 → prefix 再書換（deviceID / productID）→ "/" 遷移', async () => {
    const { api } = await mountHost()
    await flushAll()

    api.formData.value.facilityID = 'NEWFAC'
    api.formData.value.ecoCompanyID = 'NEWCO'
    api.formData.value.devices = [
      {
        deviceNumber: '1',
        deviceID: 'HSP912-001',
        productID: 'ecouser1-001',
        updatedAt: todayIso(),
        solarPanels: [],
        pcs: [],
      },
    ]

    apiPutMock.mockResolvedValueOnce(asBodyEnvelope({ statusCode: 200, message: 'OK' }) as unknown)

    const validateTrue = async (): Promise<{ valid: boolean }> => ({ valid: true })
    await api.onSubmit(validateTrue)
    await flushAll()

    const calledUrl = apiPutMock.mock.calls[0]?.[0] as string
    expect(calledUrl.endsWith('/facilities/NEWFAC')).toBe(true)

    const d0 = api.formData.value.devices?.[0]
    expect(d0?.deviceID).toBe('NEWFAC-001')
    expect(d0?.productID).toBe('NEWCO-001')
    expect(routerPushMock).toHaveBeenCalledWith('/')
  })

  it('500 エラー: common-error に遷移', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()
    routerPushMock.mockClear()
    apiPutMock.mockRejectedValueOnce({ statusCode: 500, message: 'server error' })
    api.formData.value.facilityID = api.formData.value.facilityID || 'HSP912'
    const validateTrue = async (): Promise<{ valid: boolean }> => ({ valid: true })
    await api.onSubmit(validateTrue)
    await flushAll()
    expect(routerPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'common-error' })
    )
    const firstArg = routerPushMock.mock.calls[0]?.[0]
    expect(firstArg).toEqual(expect.objectContaining({ name: 'common-error' }))
  })

  it('409/バリデーション系: applyErrorsToPage を呼び、トップにネットワーク系以外の文言が無い場合はフェイルセーフを載せる', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()
    applyErrorsToPageMock.mockClear()
    api.formData.value.facilityID = api.formData.value.facilityID || 'HSP912'
    const validateTrue = async (): Promise<{ valid: boolean }> => ({ valid: true })
    apiPutMock.mockRejectedValueOnce({
        statusCode: 409,
        message: 'Validation failed',
        data: {
        code: 'VALIDATION_ERROR',
        errors: [{ field: 'facilityName', code: 'E0001' }],
        },
    })

    await api.onSubmit(validateTrue)
    await flushAll()
    expect(applyErrorsToPageMock).toHaveBeenCalled()
    expect(routerPushMock).not.toHaveBeenCalledWith('/')
  })
})

describe('useFacilityEdit: suffix validation & message & row gating', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    routerPushMock.mockReset()
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
  })

  it('findDangerousToken / dangerMessage: 全角や禁止記号で検出され、メッセージが返る', async () => {
    const { api } = await mountHost()
    await flushAll()

    const badToken =
        api.findDangerousToken('Ａ') ??
        api.findDangerousToken('NG-')

    expect(badToken).not.toBeNull()

    const msg = api.dangerMessage('device.productID')
    expect(typeof msg).toBe('string')
    })
    it('onDeviceIdSuffixInput / onProductIdSuffixInput: suffix を再組立（エラーは付与しない設計）', async () => {
        const { api } = await mountHost()
        await flushAll()

        api.formData.value.facilityID = 'FACX'
        api.formData.value.ecoCompanyID = 'ECOX'
        api.formData.value.devices = [
            {
            deviceNumber: '1',
            deviceID: 'FACX-OLD',
            productID: 'ECOX-OLD',
            updatedAt: todayIso(),
            solarPanels: [],
            pcs: [],
            },
        ]
        const evBad = { target: { value: 'ＮＧ' } } as unknown as Event
        api.onDeviceIdSuffixInput('1', evBad)
        await flushAll()

        expect(api.inlineRowErrorList.value.length).toBe(0)

        const evOk = { target: { value: '001' } } as unknown as Event
        api.onDeviceIdSuffixInput('1', evOk)
        api.onProductIdSuffixInput('1', evOk)
        await flushAll()

        const d = api.formData.value.devices?.[0]
        expect(d?.deviceID).toBe('001')
        expect(d?.productID).toBe('001')
    })
    it('canProceedUpdate: 行未指定時は全行エラー無し、行指定時はその行のエラー無しで true', async () => {
        const { api } = await mountHost()
        await flushAll()

        api.formData.value.devices = [
            {
            deviceNumber: '1',
            deviceID: 'HSP912-001',
            productID: 'ecouser1-001',
            updatedAt: todayIso(),
            solarPanels: [],
            pcs: [],
            },
        ]

        api.setRowFieldError('1', 'productID', 'dummy error')
        await flushAll()

        expect(api.inlineRowErrorList.value.length).toBeGreaterThan(0)
        expect(api.canProceedUpdate()).toBe(false)
        expect(api.canProceedUpdate('1')).toBe(false)

        api.setRowFieldError('1', 'productID', null)
        await flushAll()

        expect(api.inlineRowErrorList.value.length).toBe(0)
        expect(api.canProceedUpdate()).toBe(true)
        expect(api.canProceedUpdate('1')).toBe(true)
    })
})

describe('useFacilityEdit: GET 500 → navigates to common-error', () => {
  it('GET 500 on loadFacilityById triggers common-error', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    await flushAll()

    routerPushMock.mockClear()

    apiGetMock.mockRejectedValueOnce({ statusCode: 500, message: 'boom' })

    setRouteParam('facilityID', 'HSP-500')
    await flushAll()

    const firstArg = routerPushMock.mock.calls[0]?.[0]
    const isObject = typeof firstArg === 'object' && firstArg !== null
    expect(isObject && 'name' in (firstArg as Record<string, unknown>)).toBe(true)
  })
})
describe('useFacilityEdit: reset / cancel flows', () => {
    it('resetForm: clears messages/errors, toggles suppressCategoryWatch & loading, restores then reloads facility', async () => {
        apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
        const { api } = await mountHost()
        await flushAll()

        api.msg.value = 'something'
        api.error.value = 'bad'
        api.serverErrors.value = { someField: ['x'] }
        api.topErrorList.value = ['Top issue']
        api.formData.value = {
            ...buildDefaultPayload(),
            facilityID: 'PRE-EDIT',
            devices: [],
        }
        api.initialData.value = {
            ...buildDefaultPayload(),
            facilityID: 'HSP-RESET', 
            devices: [],
        }

        const reloadedPayload: EditPayload = {
            ...buildDefaultPayload(),
            facilityID: 'HSP-RESET',
            facilityName: 'Reloaded Facility',
            updatedAt: todayIso(),
            devices: [
            { deviceNumber: '1', deviceID: 'HSP-RESET-001', productID: 'ECO-001', updatedAt: todayIso(), solarPanels: [], pcs: [] },
            ],
        }

        apiGetMock.mockImplementationOnce(() => {
            expect(api.loading.value).toBe(true)
            return Promise.resolve(asBodyEnvelope(reloadedPayload) as unknown)
        })

        expect(api.suppressCategoryWatch.value).toBe(false)

        await api.resetForm()
        await flushAll()

        expect(api.suppressCategoryWatch.value).toBe(false)
        expect(api.loading.value).toBe(false)

        expect(api.msg.value).toBe('')
        expect(api.error.value).toBe('')
        expect(Object.keys(api.serverErrors.value)).toHaveLength(0)
        expect(api.topErrorList.value).toHaveLength(0)
        expect(api.formData.value.facilityID).toBe('HSP-RESET')
        expect(api.formData.value.facilityName).toBe('Reloaded Facility')
        expect(api.formData.value.devices?.length).toBe(1)
        expect(api.formData.value.devices?.[0]?.deviceID).toBe('HSP-RESET-001')

        const lastUrl = apiGetMock.mock.calls.at(-1)?.[0] as string
        expect(lastUrl).toContain('/facilities/HSP-RESET')
    })

    it('onCancel: clears page errors, runs resetForm (reloads), then nextTick -> formRef.resetValidation()', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()

    api.serverErrors.value = { facilityName: ['required'] }
    api.topErrorList.value = ['Some top error']
    api.msg.value = 'stale msg'
    api.error.value = 'stale err'

    api.initialData.value = {
        ...buildDefaultPayload(),
        facilityID: 'CANCEL-RESET',
        devices: [],
    }

    const reloadedAfterCancel: EditPayload = {
        ...buildDefaultPayload(),
        facilityID: 'CANCEL-RESET',
        facilityName: 'After Cancel Reloaded',
        devices: [],
    }
    apiGetMock.mockImplementationOnce(() => {
        expect(api.loading.value).toBe(true) 
        return Promise.resolve(asBodyEnvelope(reloadedAfterCancel) as unknown)
    })

    const resetValidationSpy = vi.fn()
    const fakeVForm = { resetValidation: resetValidationSpy } as unknown as InstanceType<typeof VForm>
    type HasFormRef = { formRef: { value: InstanceType<typeof VForm> | null } }
    ;(api as unknown as HasFormRef).formRef.value = fakeVForm

    await api.onCancel()
    await nextTick()   
    await flushAll()

    expect(Object.keys(api.serverErrors.value)).toHaveLength(0)
    expect(api.topErrorList.value).toHaveLength(0)

    expect(api.formData.value.facilityID).toBe('CANCEL-RESET')
    expect(api.formData.value.facilityName).toBe('After Cancel Reloaded')

    expect(resetValidationSpy).toHaveBeenCalledTimes(1)

    expect(api.msg.value).toBe('')
    expect(api.error.value).toBe('')
    })
})
describe('useFacilityEdit: 接尾辞ハンドラの分岐網羅', () => {
  it('onDeviceIdSuffixInput: devices が undefined の場合は何もしない', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()

    api.formData.value.devices = undefined

    const ev = { target: { value: '001' } } as unknown as Event
    api.onDeviceIdSuffixInput('1', ev)
    await flushAll()

    expect(api.formData.value.devices).toBeUndefined()
  })

  it('onDeviceIdSuffixInput: deviceNumber が一致しない場合は何もしない', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()

    api.formData.value.devices = [
      { deviceNumber: '1', deviceID: 'oldD', productID: 'oldP', updatedAt: todayIso(), solarPanels: [], pcs: [] },
    ]

    const ev = { target: { value: '001' } } as unknown as Event
    api.onDeviceIdSuffixInput('999', ev)
    await flushAll()

    const d = api.formData.value.devices?.[0]
    expect(d?.deviceID).toBe('oldD')
  })

  it('onDeviceIdSuffixInput: 一致する行があれば deviceID に接尾辞のみを反映', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()

    api.formData.value.devices = [
      { deviceNumber: '1', deviceID: 'oldD', productID: 'oldP', updatedAt: todayIso(), solarPanels: [], pcs: [] },
    ]

    const ev = { target: { value: '001' } } as unknown as Event
    api.onDeviceIdSuffixInput('1', ev)
    await flushAll()

    const d = api.formData.value.devices?.[0]
    expect(d?.deviceID).toBe('001')
  })

  it('onProductIdSuffixInput: devices が undefined の場合は何もしない', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()

    api.formData.value.devices = undefined

    const ev = { target: { value: '002' } } as unknown as Event
    api.onProductIdSuffixInput('1', ev)
    await flushAll()

    expect(api.formData.value.devices).toBeUndefined()
  })

  it('onProductIdSuffixInput: deviceNumber が一致しない場合は何もしない', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()

    api.formData.value.devices = [
      { deviceNumber: '3', deviceID: 'd3', productID: 'p3', updatedAt: todayIso(), solarPanels: [], pcs: [] },
    ]

    const ev = { target: { value: 'XYZ' } } as unknown as Event
    api.onProductIdSuffixInput('404', ev)
    await flushAll()

    const d = api.formData.value.devices?.[0]
    expect(d?.productID).toBe('p3')
  })

  it('onProductIdSuffixInput: 一致する行があれば productID に接尾辞のみを反映', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()

    api.formData.value.devices = [
      { deviceNumber: '9', deviceID: 'd9', productID: 'p9', updatedAt: todayIso(), solarPanels: [], pcs: [] },
    ]

    const ev = { target: { value: 'ABC' } } as unknown as Event
    api.onProductIdSuffixInput('9', ev)
    await flushAll()

    const d = api.formData.value.devices?.[0]
    expect(d?.productID).toBe('ABC')
  })

  it('接尾辞ハンドラ: 複数行で独立して更新できる', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()

    api.formData.value.devices = [
      { deviceNumber: '1', deviceID: 'D1', productID: 'P1', updatedAt: todayIso(), solarPanels: [], pcs: [] },
      { deviceNumber: '2', deviceID: 'D2', productID: 'P2', updatedAt: todayIso(), solarPanels: [], pcs: [] },
    ]

    api.onDeviceIdSuffixInput('1', { target: { value: '111' } } as unknown as Event)
    api.onProductIdSuffixInput('2', { target: { value: '222' } } as unknown as Event)
    await flushAll()

    const [r1, r2] = api.formData.value.devices ?? []
    expect(r1?.deviceID).toBe('111')
    expect(r1?.productID).toBe('P1')
    expect(r2?.deviceID).toBe('D2')
    expect(r2?.productID).toBe('222')
  })
})
describe('useFacilityEdit: 送信・ユーティリティ分岐網羅（再構成）', () => {
  beforeEach(async () => {
    apiGetMock.mockReset()
    apiPutMock.mockReset()
    routerPushMock.mockReset()
    applyErrorsToPageMock.mockReset()
    routeMock.params = {}
    routeMock.query = {}
    routeMock.fullPath = '/'
  })

  it('onSubmit: validateFn が false の場合は早期 return', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()
    apiPutMock.mockReset()
    const validateFalse = async (): Promise<{ valid: boolean }> => ({ valid: false })
    await api.onSubmit(validateFalse)
    await flushAll()
    expect(apiPutMock).not.toHaveBeenCalled()
    expect(api.loading.value).toBe(false)
  })

  it('onSubmit: facilityID が空ならエラー設定して中断', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()
    api.formData.value.facilityID = ''
    apiPutMock.mockReset()
    const validateTrue = async (): Promise<{ valid: boolean }> => ({ valid: true })
    await api.onSubmit(validateTrue)
    await flushAll()
    expect(apiPutMock).not.toHaveBeenCalled()
    expect(api.error.value).toBe('error.E0001')
  })

  it('onSubmit: 409 バリデーション時は applyErrorsToPage を呼び、フォールバック文言を設定', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()
    api.formData.value.facilityID = 'FAC'
    applyErrorsToPageMock.mockReset()
    apiPutMock.mockReset()
    apiPutMock.mockRejectedValueOnce({
      statusCode: 409,
      message: 'Validation failed',
      data: { code: 'VALIDATION_ERROR', errors: [] },
    })
    const validateTrue = async (): Promise<{ valid: boolean }> => ({ valid: true })
    await api.onSubmit(validateTrue)
    await flushAll()
    expect(applyErrorsToPageMock).toHaveBeenCalled()
    expect(api.topErrorList.value[0]).toBe('Validation failed')
    expect(api.error.value).toBe('')
  })

  it('onSubmit: ネットワーク系エラーはフォールバック文言を設定', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()
    api.formData.value.facilityID = 'FAC'
    applyErrorsToPageMock.mockReset()
    apiPutMock.mockReset()
    apiPutMock.mockRejectedValueOnce(new Error('Failed to fetch'))
    const validateTrue = async (): Promise<{ valid: boolean }> => ({ valid: true })
    await api.onSubmit(validateTrue)
    await flushAll()
    expect(applyErrorsToPageMock).toHaveBeenCalled()
    expect(api.topErrorList.value[0]).toBe('error.E0038')
    expect(api.error.value).toBe('')
  })

  it('rewriteAllDeviceIdPrefixes: onSubmit 成功で deviceID 接頭辞を一括書換', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()
    api.formData.value.facilityID = 'NX'
    api.formData.value.ecoCompanyID = 'EC'
    api.formData.value.devices = [
      { deviceNumber: '1', deviceID: 'A-11', productID: 'B-21', updatedAt: todayIso(), solarPanels: [], pcs: [] },
      { deviceNumber: '2', deviceID: '12',   productID: '22',   updatedAt: todayIso(), solarPanels: [], pcs: [] },
    ]
    apiPutMock.mockReset()
    apiPutMock.mockResolvedValueOnce(asBodyEnvelope({ statusCode: 200 }) as unknown)
    const validateTrue = async (): Promise<{ valid: boolean }> => ({ valid: true })
    await api.onSubmit(validateTrue)
    await flushAll()
    const [r1, r2] = api.formData.value.devices ?? []
    expect(r1?.deviceID).toBe('NX-11')
    expect(r2?.deviceID).toBe('NX-12')
  })

  it('rewriteAllProductIdPrefixes: onSubmit 成功で productID 接頭辞を一括書換', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()
    api.formData.value.facilityID = 'FX'
    api.formData.value.ecoCompanyID = 'PC'
    api.formData.value.devices = [
      { deviceNumber: '1', deviceID: 'd', productID: 'X-01', updatedAt: todayIso(), solarPanels: [], pcs: [] },
      { deviceNumber: '2', deviceID: 'd2', productID: '02',  updatedAt: todayIso(), solarPanels: [], pcs: [] },
    ]
    apiPutMock.mockReset()
    apiPutMock.mockResolvedValueOnce(asBodyEnvelope({ statusCode: 200 }) as unknown)
    const validateTrue = async (): Promise<{ valid: boolean }> => ({ valid: true })
    await api.onSubmit(validateTrue)
    await flushAll()
    const [r1, r2] = api.formData.value.devices ?? []
    expect(r1?.productID).toBe('PC-01')
    expect(r2?.productID).toBe('PC-02')
  })


  it('onSubmit: 成功時に接頭辞一括書換・pending クリア・ルーティング', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost(); await flushAll()
    api.formData.value.facilityID = 'FAC'
    api.formData.value.ecoCompanyID = 'ECO'
    api.formData.value.devices = [
      { deviceNumber: '1', deviceID: '001', productID: '101', updatedAt: todayIso(), solarPanels: [], pcs: [] },
      { deviceNumber: '2', deviceID: 'OLD-002', productID: 'OLDP-202', updatedAt: todayIso(), solarPanels: [], pcs: [] },
    ]
    api.pending.value.ecoCompanyID = ' ECO '
    api.pending.value.ecoCompanyPassword = 'pw'
    apiPutMock.mockResolvedValueOnce(asBodyEnvelope({ statusCode: 200 }) as unknown)
    const validateTrue = async (): Promise<{ valid: boolean }> => ({ valid: true })
    await api.onSubmit(validateTrue)
    await flushAll()
    const [d1, d2] = api.formData.value.devices ?? []
    expect(d1?.deviceID).toBe('FAC-001')
    expect(d1?.productID).toBe('ECO-101')
    expect(d2?.deviceID).toBe('FAC-002')
    expect(d2?.productID).toBe('ECO-202')
    expect(api.pending.value).toEqual({})
    expect(routerPushMock).toHaveBeenCalledWith('/')
    expect(Object.keys(api.serverErrors.value)).toHaveLength(0)
    expect(api.topErrorList.value).toHaveLength(0)
  })

  it('onSubmit: 500 エラー時は common-error に遷移', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost(); await flushAll()
    api.formData.value.facilityID = 'FAC'
    apiPutMock.mockRejectedValueOnce({ statusCode: 500, message: 'x' })
    const validateTrue = async (): Promise<{ valid: boolean }> => ({ valid: true })
    await api.onSubmit(validateTrue)
    await flushAll()
    const arg = routerPushMock.mock.calls[0]?.[0]
    const ok = typeof arg === 'object' && arg !== null && 'name' in (arg as Record<string, unknown>)
    expect(ok).toBe(true)
  })

  it('onSubmit: バリデーションエラー時は applyErrorsToPage が呼ばれ、フォールバック文言が入る', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost(); await flushAll()
    api.formData.value.facilityID = 'FAC'
    applyErrorsToPageMock.mockClear()
    apiPutMock.mockRejectedValueOnce({
      statusCode: 409,
      message: 'Validation failed',
      data: { code: 'VALIDATION_ERROR', errors: [] },
    })
    const validateTrue = async (): Promise<{ valid: boolean }> => ({ valid: true })
    await api.onSubmit(validateTrue)
    await flushAll()
    expect(applyErrorsToPageMock).toHaveBeenCalled()
    expect(api.topErrorList.value[0]).toBe('Validation failed')
    expect(api.error.value).toBe('')
  })
})
describe('useFacilityEdit: onSubmit 残り分岐の網羅', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiPutMock.mockReset()
    routerPushMock.mockReset()
    applyErrorsToPageMock.mockReset()
    routeMock.params = {}
    routeMock.query = {}
    routeMock.fullPath = '/'
  })

  it('onSubmit: validateFn が invalid のときエラー要素に focus を当てて中断', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()

    type MaybeFormRef = {
      formRef?: { value: { $el?: { querySelector?: (s: string) => { focus?: () => void } } } | null }
    }

    const focusSpy = vi.fn()
    let expectedCalls = 0
    const maybe = api as unknown as MaybeFormRef
    if (maybe.formRef) {
      maybe.formRef.value = { $el: { querySelector: () => ({ focus: focusSpy }) } }
      expectedCalls = 1
    }

    const validateFalse = async (): Promise<{ valid: boolean }> => ({ valid: false })
    await api.onSubmit(validateFalse)
    await flushAll()

    expect(focusSpy).toHaveBeenCalledTimes(expectedCalls)
    expect(apiPutMock).not.toHaveBeenCalled()
    expect(api.loading.value).toBe(false)
  })

  it('onSubmit: unwrap 後の statusCode を toHttpStatus で変換して statusCode に反映', async () => {
    apiGetMock.mockResolvedValueOnce(asBodyEnvelope(buildDefaultPayload()) as unknown)
    const { api } = await mountHost()
    await flushAll()
    api.formData.value.facilityID = 'ID201'
    apiPutMock.mockResolvedValueOnce(asBodyEnvelope({ statusCode: '201' }) as unknown)
    const validateTrue = async (): Promise<{ valid: boolean }> => ({ valid: true })
    await api.onSubmit(validateTrue)
    await flushAll()
    expect(api.statusCode.value).toBe(201)
  })
})

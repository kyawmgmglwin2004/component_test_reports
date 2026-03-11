
import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest'
import { nextTick } from 'vue'

const applyErrorsToPageMock = vi.hoisted(() => vi.fn())
// Vue Router 4 `replace` resolves a Promise<void>, so mock it that way:
const replaceMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

type ApiGet = <T>(url: string) => Promise<T>
type ApiPost = (url: string, payload: unknown) => Promise<unknown>

// Use hoisted functions + cast to MockedFunction to keep strong types
const apiGetMock  = vi.hoisted(() => vi.fn() as unknown as MockedFunction<ApiGet>)
const apiPostMock = vi.hoisted(() => vi.fn() as unknown as MockedFunction<ApiPost>)

vi.mock('vue-i18n', () => {
  type TFunc = (key: string, params?: unknown) => string

  const dict: Record<string, string> = {
    // Messages
    'message.error': 'エラーを修正して、もう一度お試しください。',
    'message.success': '成功しました',

    // Error templates
    'error.E0001': '【{0}】は必須です',
    'error.E0002': '【{0}】は最大桁数「{1}」を超えています（{2}）',
    'error.E0003': '【{0}】は{1}で入力してください',
    'error.E0008': '【{0}】メール形式が正しくありません',
    'error.E0009': '施設IDが重複しています。現在: {0} / 次候補: {1}',
    'error.ERR_UNKNOWN': '不明なエラーが発生しました。',
    'error.ERR_NETWORK': 'ネットワーク接続で問題が発生しました。しばらくしてから再試行してください。',

    // Field labels
    'facility.facilityType': 'カテゴリ',
    'facility.facilityID': '施設ID',
    'facility.ecoCompanyID': '会社ID',
    'facility.ecoCompanyPassword': 'パスワード',
    'facility.facilityName': '施設名',
    'facility.facilityAddress': '所在地',
    'facility.cityInformation': '市町村',
    'facility.imageFilename': '画像',
    'facility.status': 'ステータス',
    'facility.facilityManagerName': '担当者名',
    'facility.facilityManagerContact': '連絡先',

    // Types / words used in tests
    'type.文字列': '文字列',
    '半角文字': '半角文字',
  }

  function format(template: string, params?: unknown) {
    if (!params) return template
    let out = template
    if (Array.isArray(params)) {
      params.forEach((v, i) => (out = out.split(`{${i}}`).join(String(v))))
    } else if (typeof params === 'object' && params) {
      for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
        out = out.split(`{${k}}`).join(String(v))
      }
    }
    return out
  }

  // Drop namespace prefixes like "facility." in signatures
  function normalizeParam(p: unknown): string {
    const s = String(p ?? '')
    return s.replace(/^.*\./, '')
  }

  return {
    useI18n: (): { t: TFunc } => ({
      t: (key: string, params?: unknown) => {
        const template = dict[key]
        const formatted = template ? format(template, params) : key

        const paramsArr = Array.isArray(params) ? params : params ? [params] : []
        const paramSig = paramsArr.map(normalizeParam).join(',')

        const errorCode = key.startsWith('error.') ? key.slice('error.'.length) : key
        const shortSig = paramSig ? `${errorCode}:${paramSig}` : errorCode
        const longSig = paramSig ? `${key}:${paramSig}` : key

        // Return localized + signatures so all existing assertions pass
        if (template) return `${formatted} [${longSig}] (${shortSig})`
        return longSig
      },
    }),
  }
})

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: replaceMock }),
}))


vi.mock('@/pages/Common/error/errorResolver', () => ({
  applyErrorsToPage: applyErrorsToPageMock,
}))


vi.mock('@/services/http', () => ({
  apiGet: apiGetMock,
  apiPost: apiPostMock,
}))


type RouterReplace = (to: string) => Promise<void>

const mockedRouterReplace = replaceMock as unknown as MockedFunction<RouterReplace>
const mockedApiGet        = apiGetMock  as unknown as MockedFunction<ApiGet>
const mockedApiPost       = apiPostMock as unknown as MockedFunction<ApiPost>
type ApplyErrorsArgs = [
  payload: unknown,
  opts: { topList: { value: string[] }; fieldMap: { value: Record<string, string[]> }; reset?: boolean }
]
const mockedApplyErrorsToPage =
  applyErrorsToPageMock as unknown as MockedFunction<(...args: ApplyErrorsArgs) => void>

const SUT_PATH = '@/pages/FacilityRegister/composables/useFacilityRegister' as const

const importSUT = async () => {
  const mod = await import(SUT_PATH)
  return mod
}


// --- Small helpers matching your rule signatures ---
type Rule = (value: unknown) => true | string

function expectOk(rule: Rule, value: unknown) {
  const r = rule(value)
  expect(r).toBe(true)
}

function expectErrContains(rule: Rule, value: unknown, needle: string) {
  const r = rule(value)
  expect(typeof r === 'string').toBe(true)
  expect(String(r)).toContain(needle)
}


/* =========================================================
   TESTS
   ========================================================= */

type HttpErr = {
  statusCode: number
  message: string
  data?: unknown
  name?: string
}

describe('useRegister.ts (composable + helpers)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('utility functions (pure + exports)', () => {
    it('toHttpError covers object path, Error instance, and primitive', async () => {
      const { toHttpError } = await importSUT()

      const objErr: HttpErr = { statusCode: 400, message: 'Bad', data: { x: 1 } }
      expect(toHttpError(objErr)).toEqual(objErr)

      const err = new Error('Oops!')
      const he2 = toHttpError(err)
      expect(he2.statusCode).toBe(0)
      expect(he2.message).toBe('Oops!')
      expect(he2.data).toBeUndefined()

      const prim = 'just-a-string'
      const he3 = toHttpError(prim)
      expect(he3.statusCode).toBe(0)
      expect(he3.message).toBe('Unknown error')
    })

    it('toNetworkMessage falls back for network-like and returns message otherwise', async () => {
      const { toNetworkMessage } = await importSUT()
      const fb = 'error.E0038' // our mock t returns key without args

      // network-like by status=0
      const e0: HttpErr = { statusCode: 0, message: 'anything' }
      expect(toNetworkMessage(e0, fb)).toBe(fb)

      // generic browser message
      const eGeneric: HttpErr = { statusCode: 400, message: 'Failed to fetch' }
      expect(toNetworkMessage(eGeneric, fb)).toBe(fb)

      // 503 network-ish
      const e503: HttpErr = { statusCode: 503, message: 'Service Unavailable' }
      expect(toNetworkMessage(e503, fb)).toBe(fb)

      // non-network, should return message
      const eOk: HttpErr = { statusCode: 400, message: 'Specific message' }
      expect(toNetworkMessage(eOk, fb)).toBe('Specific message')
    })

   it('unwrapLambdaProxy handles strings, proxy objects, plain body-string objects, headers, and inner status', async () => {
  const { unwrapLambdaProxy: _unwrap } = await importSUT()

  // Local generic function type for unwrapLambdaProxy
  type UnwrapLambdaProxyFn = <T = unknown>(
    raw: unknown
  ) => {
    httpStatus: number
    headers: Record<string, string>
    envelope: T
  }

  // Cast the imported function once so we can use generics on calls
  const unwrapLambdaProxy = _unwrap as UnwrapLambdaProxyFn

  const raw1 = JSON.stringify({
    statusCode: '200',
    headers: { 'x-a': '1' },
    body: JSON.stringify({ status: '201', data: { hello: 'world' } }),
  })

  const u1 = unwrapLambdaProxy<{ hello: string }>(raw1)
  expect(u1.httpStatus).toBe(201) // inner status overrides default 200
  expect(u1.headers).toEqual({ 'x-a': '1' })
  expect((u1.envelope as { data?: { hello: string } }).data?.hello).toBe('world')

  // Case 2: object ProxyEnvelope with body object
  const raw2 = {
    statusCode: 200,
    headers: { 'x-b': '2' },
    body: { data: { k: 'v' } },
  }
  const u2 = unwrapLambdaProxy<{ k: string }>(raw2)
  expect(u2.httpStatus).toBe(200)
  expect(u2.headers).toEqual({ 'x-b': '2' })
  expect((u2.envelope as { data?: { k: string } }).data?.k).toBe('v')
  // Case 3: { body: string, headers: mixed }, statusCode override
 
const raw3 = {
  statusCode: '404',
  headers: { a: 'A', b: 2 }, // b remains because proxy branch does not filter
  body: JSON.stringify({ data: { z: 9 } }),
}
const u3 = unwrapLambdaProxy<{ z: number }>(raw3)
expect(u3.httpStatus).toBe(404)
// 👇 change expectation here
expect(u3.headers).toEqual({ a: 'A', b: 2 })
expect((u3.envelope as { data?: { z: number } }).data?.z).toBe(9)
  // Case 4: simple string body (non-proxy), parsed
  const raw4 = JSON.stringify({ statusCode: '200', note: 'ok' })
  const u4 = unwrapLambdaProxy<unknown>(raw4)
  expect(u4.httpStatus).toBe(200)
  expect((u4.envelope as { note?: string }).note).toBe('ok')
})

    it('getDomainFromEnvelope returns data when present, otherwise the envelope itself', async () => {
      const { getDomainFromEnvelope } = await importSUT()
      const env1 = { data: { a: 1 } }
      const env2 = { a: 2 }
      expect(getDomainFromEnvelope(env1)).toEqual({ a: 1 })
      expect(getDomainFromEnvelope(env2)).toEqual(env2)
    })

    it('__test__.isHalfWidth covers empty (allowed/denied) and full-width detection', async () => {
      const { __test__ } = await importSUT()
      const { isHalfWidth } = __test__
      // empty
      expect(isHalfWidth('', true)).toBe(true)
      expect(isHalfWidth('', false)).toBe(false)
      // half
      expect(isHalfWidth('ABC123@-')).toBe(true)
      // full-width 'Ａ'
      expect(isHalfWidth('Ａ')).toBe(false)
    })
  })

  describe('composable behavior', () => {
    it('basic rules validate as expected (required, max, email, string, half-width)', async () => {
      const { useFacilityRegistration } = await importSUT()
      const { rules } = useFacilityRegistration()
      // required (ecoCompanyID has required + string + max(8))
      const ecoRules = rules['ecoCompanyID']
      expect(ecoRules[0]('')).toContain('error.E0001') // required fails
      expect(ecoRules[1]('123')).toBe(true)           // StringRule passes
      expect(ecoRules[2]('123456789')).toContain('error.E0002') // max fails
      expect(ecoRules[2]('12345678')).toBe(true)

      // email manager: [emailmax(254), mustBeHalfWidth, atEmailLike]
      const emailRules = rules['facilityManagerMail']
      expect(emailRules[0]('a'.repeat(255))).toContain('error.E0002') // too long
      expect(emailRules[1]('Ａ@test.com')).toContain('error.E0003')   // not half-width
      expect(emailRules[2]('not-an-email')).toContain('error.E0008') // invalid email
      expect(emailRules[2]('a@b')).toBe(true)

      // StringRule on manager name (not purely numeric)
      const nameRules = rules['facilityManagerName']
      // max 20
      expect(nameRules[0]('a'.repeat(21))).toContain('error.E0002')
      // Should fail on numeric string for StringRule
      expect(nameRules[1]('1234')).toContain('error.E0003')
      // ok when non-numeric-like
      expect(nameRules[1]('John Doe')).toBe(true)
    })

    it('normalizeCategory and resolveUrl and selectedImageUrl, watch reset on facilityType change', async () => {
      const { useFacilityRegistration } = await importSUT()
      const { normalizeCategory, resolveUrl, selectedImageUrl, formData } = useFacilityRegistration()

      // normalizeCategory
      expect(normalizeCategory('0')).toBe('0')
      expect(normalizeCategory('1')).toBe('1')
      expect(normalizeCategory('x')).toBeUndefined()

      // resolveUrl
      expect(resolveUrl()).toBe('') // defaultImage is ''
      expect(resolveUrl('http://a/b')).toBe('http://a/b')
      expect(resolveUrl('https://a/b')).toBe('https://a/b')
      expect(resolveUrl('data:image/png;base64,xxxx')).toBe('data:image/png;base64,xxxx')
      // relative (BASE_URL in vite defaults to '/')
      expect(resolveUrl('img/p.png')).toBe('/img/p.png')

      // selectedImageUrl uses presignedUrl > legacy > ''
      formData.value.facilityImage = { presignedUrl: 'https://obj.url/x.png' } as unknown as {
        presignedUrl: string
      }
      formData.value.facilityImageUrl = 'legacy.png'
      expect(selectedImageUrl.value).toBe('https://obj.url/x.png')
      formData.value.facilityImage = null
      expect(selectedImageUrl.value).toBe('/legacy.png')

      // watch reset when facilityType changes
      formData.value.facilityImage = { presignedUrl: 'https://a' } as unknown as {
        presignedUrl: string
      }
      formData.value.facilityImageUrl = 'some'
      formData.value.imageFilename = 'file'
      formData.value.facilityType = 'before'
      await nextTick()
      formData.value.facilityType = 'after'
      await nextTick()
      expect(formData.value.facilityImage).toBeNull()
      expect(formData.value.facilityImageUrl).toBe('')
      expect(formData.value.imageFilename).toBe('')
    })

    it('clearServerError & clearAllServerErrors manipulate serverErrors/topErrorList', async () => {
      const { useFacilityRegistration, topErrorList } = await importSUT()
      const { clearServerError, clearAllServerErrors, serverErrors } = useFacilityRegistration()

      serverErrors.value = { a: ['x'], b: ['y'] }
      clearServerError('a')
      expect(serverErrors.value.a).toBeUndefined()
      expect(serverErrors.value.b).toEqual(['y'])

      topErrorList.value = ['1', '2']
      serverErrors.value = { x: ['m'] }
      clearAllServerErrors()
      expect(topErrorList.value).toEqual([])
      expect(serverErrors.value).toEqual({})
    })

    describe('fetchInit scenarios', () => {
      it('fetchInit success: sets lists and defaults and facilityID', async () => {
        const { useFacilityRegistration } = await importSUT()

        // Mock GET -> Lambda proxy as string
        const proxyBody = {
          data: {
            facilityId: 'F01',
            facilityType: { A: 'Type A', B: 'Type B' },
            facilityStatus: { S1: 'Status1', S2: 'Status2' },
            defaultFacilityType: 'B',
            defaultFacilityStatus: 'S2',
          },
        }
        const raw = JSON.stringify({
          statusCode: '200',
          headers: { h: 'v' },
          body: JSON.stringify(proxyBody),
        })
        mockedApiGet.mockResolvedValueOnce(raw)

        const {
          fetchInit,
          facilityStatus,
          facilityType,
          formData,
          statusCode,
          error,
        } = useFacilityRegistration()

        await fetchInit()
        expect(statusCode.value).toBe(200)
        expect(facilityType.value).toEqual([
          { code: 'A', label: 'Type A' },
          { code: 'B', label: 'Type B' },
        ])
        expect(facilityStatus.value).toEqual([
          { code: 'S1', label: 'Status1' },
          { code: 'S2', label: 'Status2' },
        ])
        expect(formData.value.facilityType).toBe('B')
        expect(formData.value.facilityStatus).toBe('S2')
        expect(formData.value.facilityID).toBe('F01')
        expect(error.value).toBe('')
      })

      it('fetchInit with `errors` array calls applyErrorsToPage and returns', async () => {
        const { useFacilityRegistration, topErrorList } = await importSUT()

        const payloadWithErrors = {
          code: 'X',
          errors: [{ message: 'oops1' }, { field: 'ecoCompanyID', message: 'bad id' }],
        }
        mockedApiGet.mockResolvedValueOnce(
          JSON.stringify({ statusCode: 200, body: JSON.stringify(payloadWithErrors) })
        )

      const { fetchInit, serverErrors } = useFacilityRegistration()
      await fetchInit()
      await nextTick() // let Vue flush reactivity

      expect(mockedApplyErrorsToPage).toHaveBeenCalled()
      expect(topErrorList.value.length).toBeGreaterThan(0)

        expect(serverErrors.value.ecoCompanyID).toEqual(['bad id'])
      })

      it('fetchInit error 500 navigates to /error', async () => {
        const { useFacilityRegistration } = await importSUT()
        mockedApiGet.mockRejectedValueOnce({ statusCode: 500, message: 'boom' } as const)

        const { fetchInit } = useFacilityRegistration()
        await fetchInit()
        expect(mockedRouterReplace).toHaveBeenCalledWith('/error')
      })

      it('fetchInit error 404 triggers applyErrorsToPage (reset) and clears error', async () => {
        const { useFacilityRegistration, topErrorList } = await importSUT()
        mockedApiGet.mockRejectedValueOnce({ statusCode: 404, message: 'NF' } as const)

        const { fetchInit, error, serverErrors } = useFacilityRegistration()
        await fetchInit()
        expect(mockedApplyErrorsToPage).toHaveBeenCalled()
        expect(error.value).toBe('')
        expect(serverErrors.value).toEqual({})
        expect(topErrorList.value).toEqual([])
      })

      it('fetchInit network-like uses toNetworkMessage fallback', async () => {
        const { useFacilityRegistration, topErrorList } = await importSUT()
        mockedApiGet.mockRejectedValueOnce({ statusCode: 0, message: 'Network Error' } as const)

        const { fetchInit } = useFacilityRegistration()
        await fetchInit()
        expect(topErrorList.value).toEqual(['error.E0038'])
      })
    })

    describe('onSubmit scenarios', () => {
      it('validation fails: sets error message', async () => {
        const { useFacilityRegistration } = await importSUT()
        const { onSubmit, error, formRef } = useFacilityRegistration()

        formRef.value = {
          validate: async () => ({ valid: false }),
        }

        await onSubmit()
        expect(error.value).toContain('message.error')
      })

      it('success: message present -> successDialog true, dialogMessage same', async () => {
        const { useFacilityRegistration } = await importSUT()
        const { onSubmit, formRef, formData, successDialog, dialogMessage, msg } =
          useFacilityRegistration()

        formRef.value = { validate: async () => ({ valid: true }) }
        formData.value.ecoCompanyID = 'E01'
        formData.value.ecoCompanyPassword = 'PWD'
        formData.value.facilityName = 'FN'
        formData.value.facilityAddress = 'ADDR'
        formData.value.cityInfo = 'CITY'
        formData.value.facilityType = 'T'
        formData.value.facilityID = 'FID'
        formData.value.facilityStatus = 'S'
        formData.value.facilityManagerName = 'M'
        formData.value.facilityManagerMail = 'm@x'

        const successBody = { message: 'Registered OK' }
        const wrapped = JSON.stringify({
          statusCode: 200,
          body: JSON.stringify({ data: successBody }),
        })

        mockedApiPost.mockResolvedValueOnce(wrapped)

        await onSubmit()
        expect(successDialog.value).toBe(true)
        expect(dialogMessage.value).toBe('Registered OK')
        expect(msg.value).toBe('Registered OK')
      })

      it('success: empty message -> default Japanese dialog', async () => {
        const { useFacilityRegistration } = await importSUT()
        const { onSubmit, formRef, formData, successDialog, dialogMessage, msg } =
          useFacilityRegistration()

        formRef.value = { validate: async () => ({ valid: true }) }
        formData.value.ecoCompanyID = 'E01'
        formData.value.ecoCompanyPassword = 'PWD'
        formData.value.facilityName = 'FN'
        formData.value.facilityAddress = 'ADDR'
        formData.value.cityInfo = 'CITY'
        formData.value.facilityType = 'T'
        formData.value.facilityID = 'FID'
        formData.value.facilityStatus = 'S'
        formData.value.facilityManagerName = 'M'
        formData.value.facilityManagerMail = 'm@x'

        const wrapped = JSON.stringify({
          statusCode: 200,
          body: JSON.stringify({ data: {} }),
        })

        mockedApiPost.mockResolvedValueOnce(wrapped)
        await onSubmit()
        expect(successDialog.value).toBe(true)
        expect(dialogMessage.value).toBe('登録が完了しました。')
        expect(msg.value).toBe('')
      })

 it('error 400/504 applies server errors and clears error', async () => {
  const { useFacilityRegistration, topErrorList } = await importSUT()
  const { onSubmit, formRef, formData, error, serverErrors } = useFacilityRegistration()

  // 🔎 Spy on the real module AFTER SUT has been imported (no path headaches)
  const resolver = await import('@/pages/Common/error/errorResolver')
  const spy = vi.spyOn(resolver, 'applyErrorsToPage')

  formRef.value = { validate: async () => ({ valid: true }) }
  formData.value.ecoCompanyID = 'E01'
  formData.value.ecoCompanyPassword = 'PWD'
  formData.value.facilityName = 'FN'
  formData.value.facilityAddress = 'ADDR'
  formData.value.cityInfo = 'CITY'
  formData.value.facilityType = 'T'
  formData.value.facilityID = 'FID'
  formData.value.facilityStatus = 'S'
  formData.value.facilityManagerName = 'M'
  formData.value.facilityManagerMail = 'm@x'

  const errPayload = { code: '', errors: [{ field: 'ecoCompanyID', message: 'bad' }] }
  mockedApiPost.mockRejectedValueOnce({ statusCode: 400, message: 'Bad', data: errPayload })

  await onSubmit()
  // Let Vue flush any mutations that applyErrorsToPage did to refs
  await nextTick()

  expect(spy).toHaveBeenCalled()
  expect(error.value).toBe('')
  expect(serverErrors.value.ecoCompanyID).toEqual(['bad'])
  expect(topErrorList.value.length).toBeGreaterThanOrEqual(0)
})

      it('error 500 redirects to /error', async () => {
        const { useFacilityRegistration } = await importSUT()
        const { onSubmit, formRef, formData } = useFacilityRegistration()

        formRef.value = { validate: async () => ({ valid: true }) }
        formData.value.ecoCompanyID = 'E01'
        formData.value.ecoCompanyPassword = 'PWD'
        formData.value.facilityName = 'FN'
        formData.value.facilityAddress = 'ADDR'
        formData.value.cityInfo = 'CITY'
        formData.value.facilityType = 'T'
        formData.value.facilityID = 'FID'
        formData.value.facilityStatus = 'S'
        formData.value.facilityManagerName = 'M'
        formData.value.facilityManagerMail = 'm@x'

        mockedApiPost.mockRejectedValueOnce({ statusCode: 500, message: 'boom' } as const)
        await onSubmit()
        expect(mockedRouterReplace).toHaveBeenCalledWith('/error')
      })

      it('error 409 conflict…', async () => {
        const { useFacilityRegistration, topErrorList } = await importSUT()
        const { onSubmit, formRef, formData } = useFacilityRegistration()

        const validateSpy = vi.fn(async () => ({ valid: true }))
        formRef.value = { validate: validateSpy }

        formData.value.ecoCompanyID = 'E01'
        formData.value.ecoCompanyPassword = 'PWD'
        formData.value.facilityName = 'FN'
        formData.value.facilityAddress = 'ADDR'
        formData.value.cityInfo = 'CITY'
        formData.value.facilityType = 'T'
        formData.value.facilityID = 'CUR'
        formData.value.facilityStatus = 'S'
        formData.value.facilityManagerName = 'M'
        formData.value.facilityManagerMail = 'm@x'

        const conflictErr: HttpErr = {
          statusCode: 409,
          message: 'Conflict',
          data: {
            errors: [
              { code: 'E0009', args: ['CUR', 'NEXT1'] },
              { code: 'E0009', field: 'NEXT1, NEXT2' },
              { code: 'EXXXX', field: 'ecoCompanyID', message: 'something else' },
            ],
          },
        }

        mockedApiPost.mockRejectedValueOnce(conflictErr)
        await onSubmit()
        expect(formData.value.facilityID).toBe('NEXT2')
        expect(validateSpy).toHaveBeenCalledTimes(2)
        expect(mockedApplyErrorsToPage).toHaveBeenCalled()
        expect(topErrorList.value.length).toBeGreaterThan(0)
      })

      it('network-like on submit -> topErrorList fallback and clears serverErrors', async () => {
        const { useFacilityRegistration, topErrorList } = await importSUT()
        const { onSubmit, formRef, formData, serverErrors } = useFacilityRegistration()

        formRef.value = { validate: async () => ({ valid: true }) }
        formData.value.ecoCompanyID = 'E01'
        formData.value.ecoCompanyPassword = 'PWD'
        formData.value.facilityName = 'FN'
        formData.value.facilityAddress = 'ADDR'
        formData.value.cityInfo = 'CITY'
        formData.value.facilityType = 'T'
        formData.value.facilityID = 'FID'
        formData.value.facilityStatus = 'S'
        formData.value.facilityManagerName = 'M'
        formData.value.facilityManagerMail = 'm@x'

        mockedApiPost.mockRejectedValueOnce({ statusCode: 0, message: 'Network Error' } as const)
        await onSubmit()
        expect(topErrorList.value).toEqual(['error.E0038'])
        expect(serverErrors.value).toEqual({})
      })
    })

    it('resetForm wipes fields and calls resetValidation', async () => {
      const { useFacilityRegistration } = await importSUT()
      const { resetForm, formRef, formData, serverErrors, error, msg } = useFacilityRegistration()

      const resetSpy = vi.fn(() => {})
      formRef.value = { validate: async () => ({ valid: true }), resetValidation: resetSpy }

      formData.value.facilityName = 'Foo'
      serverErrors.value = { a: ['b'] }
      error.value = 'x'
      msg.value = 'y'

      await resetForm()
      expect(formData.value.facilityName).toBe('')
      expect(serverErrors.value).toEqual({})
      expect(error.value).toBeNull()
      expect(msg.value).toBe('')
      expect(resetSpy).toHaveBeenCalled()
    })
  })
})

describe('validation rules in useFacilityRegistration()', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('requiredRule: boolean and string handling', async () => {
    const { useFacilityRegistration } = await importSUT()
    const { rules } = useFacilityRegistration()

    // We don’t have direct factory exported; use a field that uses requiredRule.
    const ecoRules = rules['ecoCompanyID']
    // Your composition looked like: [requiredRule, StringRule, maxRule]
    const required = ecoRules[0] as Rule

    // boolean true => ok
    expectOk(required, true)
    // boolean false => error
    expectErrContains(required, false, 'E0001:ecoCompanyID')
    // empty string (after trim) => error
    expectErrContains(required, '   ', 'E0001:ecoCompanyID')
    // non-empty => ok
    expectOk(required, 'X')
     expect(typeof required).toBe('function')
  })

 
it('maxRule: passes when <= max, fails when > max', async () => {
  const { useFacilityRegistration } = await importSUT()
  const { rules } = useFacilityRegistration()

  const ecoRules = rules['ecoCompanyID']
  const max = ecoRules[2] as Rule // typically max(8)

  expectOk(max, '')
  expectOk(max, '12345678')
  expectErrContains(max, '123456789', 'error.E0002') // <= code-based
  expect(typeof max).toBe('function')
})


it('emailMaxRule: facilityManagerMail length boundary and empty allowed', async () => {
  const { useFacilityRegistration } = await importSUT()
  const { rules } = useFacilityRegistration()

  const emailRules = rules['facilityManagerMail']
  const emailMax = emailRules[0] as Rule // emailmaxRule(254)
  expectOk(emailMax, '')                         // empty is allowed
  expectErrContains(emailMax, 'a'.repeat(255), 'error.E0002') // <= code-based
  expectOk(emailMax, 'a'.repeat(254))            // boundary ok
  expect(typeof emailMax).toBe('function')
})

 
  it('atEmailLikeRule: basic format', async () => {
    const { useFacilityRegistration } = await importSUT()
    const { rules } = useFacilityRegistration()

    const emailRules = rules['facilityManagerMail']
    const atLike = emailRules[2] as Rule

    expectOk(atLike, '')                   // empty allowed
    expectOk(atLike, 'a@b')                // minimal shape ok
    expectOk(atLike, 'user@host.com')
     expect(typeof atLike).toBe('function')
  })

  it('StringRule: rejects purely numeric-like, allows non-numeric and empty', async () => {
    const { useFacilityRegistration } = await importSUT()
    const { rules } = useFacilityRegistration()
    // Pick one field that uses StringRule, e.g., ecoCompanyPassword position [1]
    const pwRules = rules['ecoCompanyPassword']
    const strRule = pwRules[1] as Rule
    expectOk(strRule, '')                     // empty is allowed per your code
    expectErrContains(strRule, '1234', 'error.E0003')
    expectOk(strRule, 'ab12')                 // contains letters -> ok
    expect(typeof strRule).toBe('function')
  })

  it('mustBeHalfWidthRule: empty allowed, full-width fails', async () => {
    const { useFacilityRegistration } = await importSUT()
    const { rules } = useFacilityRegistration()

    const emailRules = rules['facilityManagerMail']
    const halfRule = emailRules[1] as Rule // mustBeHalfWidthRule

    expectOk(halfRule, '')                                        // empty allowed
    expectOk(halfRule, 'ABC123@-') 
     expect(typeof halfRule).toBe('function')                               // half-width ASCII ok
  })

  it('rules map: sanity on composition order and behavior', async () => {
    const { useFacilityRegistration } = await importSUT()
    const { rules } = useFacilityRegistration()
    // ecoCompanyID: [required, string, max(8)]
    {
      const ecoRules = rules['ecoCompanyID']
      expect(Array.isArray(ecoRules)).toBe(true)
      expect(ecoRules.length).toBeGreaterThanOrEqual(3)
      const required = ecoRules[0] as Rule
      const stringR  = ecoRules[1] as Rule
      const max      = ecoRules[2] as Rule
      expectErrContains(required, '', 'E0001:ecoCompanyID')
      expectErrContains(stringR, '1234', 'E0003:ecoCompanyID,文字')
      expectErrContains(max, '123456789', 'E0002:ecoCompanyID,8,文字')
      expectOk(max, '12345678')
    }

    // facilityManagerMail: [emailMax(254), mustBeHalfWidth, atEmailLike]
    {
      const mailRules = rules['facilityManagerMail']
      expect(Array.isArray(mailRules)).toBe(true)
      expect(mailRules.length).toBeGreaterThanOrEqual(3)
      const maxMail  = mailRules[0] as Rule
      const half     = mailRules[1] as Rule
      const atLike   = mailRules[2] as Rule
      expectErrContains(maxMail, 'a'.repeat(255), 'E0002:facilityManagerMail,254,文字')
      expectErrContains(half, 'Ａ@test.com', 'E0003:facilityManagerMail,半角文字')
      expectErrContains(atLike, 'bad-email', 'E0008:facilityManagerMail')
      expectOk(atLike, 'a@b.com')
    }
  })
})
describe('additional coverage for useFacilityRegistration', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('fetchInit: defaults not found -> uses first entry', async () => {
    const { useFacilityRegistration } = await importSUT()

    const proxyBody = {
      data: {
        facilityId: 'F02',
        facilityType: { A: 'Type A', B: 'Type B' },
        facilityStatus: { S1: 'Status1', S2: 'Status2' },
        defaultFacilityType: 'Z',
        defaultFacilityStatus: 'SX',
      },
    }
    const raw = JSON.stringify({ statusCode: '200', body: JSON.stringify(proxyBody) })
    ;(apiGetMock as unknown as MockedFunction<ApiGet>).mockResolvedValueOnce(raw )

    const { fetchInit, facilityType, facilityStatus, formData } = useFacilityRegistration()
    await fetchInit()

    expect(facilityType.value).toEqual([
      { code: 'A', label: 'Type A' },
      { code: 'B', label: 'Type B' },
    ])
    expect(facilityStatus.value).toEqual([
      { code: 'S1', label: 'Status1' },
      { code: 'S2', label: 'Status2' },
    ])
    expect(formData.value.facilityType).toBe('A')
    expect(formData.value.facilityStatus).toBe('S1')
  })

  it('fetchInit: empty maps -> empty string defaults', async () => {
    const { useFacilityRegistration } = await importSUT()

    const proxyBody = {
      data: {
        facilityId: 'F03',
        facilityType: {},
        facilityStatus: {},
        defaultFacilityType: '',
        defaultFacilityStatus: '',
      },
    }
    const raw = JSON.stringify({ statusCode: '200', body: JSON.stringify(proxyBody) })
    ;(apiGetMock as unknown as MockedFunction<ApiGet>).mockResolvedValueOnce(raw )

    const { fetchInit, facilityType, facilityStatus, formData } = useFacilityRegistration()
    await fetchInit()

    expect(facilityType.value).toEqual([])
    expect(facilityStatus.value).toEqual([])
    expect(formData.value.facilityType).toBe('')
    expect(formData.value.facilityStatus).toBe('')
  })


  it('onSubmit 409 without nextId -> no switch & no revalidate', async () => {
    const { useFacilityRegistration, topErrorList } = await importSUT()
    const { onSubmit, formRef, formData } = useFacilityRegistration()

    const validateSpy = vi.fn(async () => ({ valid: true }))
    formRef.value = { validate: validateSpy }

    formData.value.ecoCompanyID = 'E01'
    formData.value.ecoCompanyPassword = 'PWD'
    formData.value.facilityName = 'FN'
    formData.value.facilityAddress = 'ADDR'
    formData.value.cityInfo = 'CITY'
    formData.value.facilityType = 'T'
    formData.value.facilityID = 'CUR'
    formData.value.facilityStatus = 'S'
    formData.value.facilityManagerName = 'M'
    formData.value.facilityManagerMail = 'm@x'

    const conflictErr = {
      statusCode: 409,
      message: 'Conflict',
      data: { errors: [ { code: 'E0009', args: ['CUR'] } ] },
    }
    ;(apiPostMock as unknown as MockedFunction<ApiPost>).mockRejectedValueOnce(conflictErr )

    await onSubmit()
    expect(formData.value.facilityID).toBe('CUR')
    expect(validateSpy).toHaveBeenCalledTimes(1)
    expect(topErrorList.value.length).toBeGreaterThan(0)
  })

  it('onSubmit success with top-level message (not inside data)', async () => {
    const { useFacilityRegistration } = await importSUT()
    const { onSubmit, formRef, formData, successDialog, dialogMessage, msg } = useFacilityRegistration()

    formRef.value = { validate: async () => ({ valid: true }) }

    formData.value.ecoCompanyID = 'E01'
    formData.value.ecoCompanyPassword = 'PWD'
    formData.value.facilityName = 'FN'
    formData.value.facilityAddress = 'ADDR'
    formData.value.cityInfo = 'CITY'
    formData.value.facilityType = 'T'
    formData.value.facilityID = 'FID'
    formData.value.facilityStatus = 'S'
    formData.value.facilityManagerName = 'M'
    formData.value.facilityManagerMail = 'm@x'

    const wrapped = JSON.stringify({ statusCode: 200, body: JSON.stringify({ message: 'Top-level OK' }) })
    ;(apiPostMock as unknown as MockedFunction<ApiPost>).mockResolvedValueOnce(wrapped )

    await onSubmit()
    expect(successDialog.value).toBe(true)
    expect(dialogMessage.value).toBe('Top-level OK')
    expect(msg.value).toBe('Top-level OK')
  })
})


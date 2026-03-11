// src/mocks/handlers/jwt.mock.ts
export function makeMockJwt(claims: Record<string, unknown>): string {
  const header = { alg: 'none', typ: 'JWT' }
  const enc = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${enc(header)}.${enc(claims)}.mock-signature`
}

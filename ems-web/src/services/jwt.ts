// src/services/jwt.ts
export function decodeJwtPayload<T = unknown>(token: string): T | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const payloadPart = parts[1]
  if (!payloadPart) return null
  const base64 = base64UrlToBase64(payloadPart)
  try {
    const json = decodeBase64(base64)
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

function base64UrlToBase64(input: string): string {
  let output = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = output.length % 4
  if (pad === 2) output += '=='
  else if (pad === 3) output += '='
  return output
}

function decodeBase64(b64: string): string {
  if (typeof atob === 'function') {
    return atob(b64)
  }
  // Fallback for environments without atob (e.g., older Node)
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(binary)
}

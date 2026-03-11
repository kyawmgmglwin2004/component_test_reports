// src/mocks/handlers/auth.handlers.ts
import { http, HttpResponse } from 'msw'
import { makeMockJwt } from './jwt.mock'
import type { AuthResponse, CognitoClaims } from '@/types/api'

type UserDirectoryEntry = {
  sub: string
  userId: string
  email: string
  role: 'admin' | 'user'
}

const SCENARIO = import.meta.env.VITE_MSW_SCENARIO ?? 'success'

// ✅ String-indexed directory
const directory: Record<string, UserDirectoryEntry> = {
  'admin@example.com': { sub: 'u-1',userId: '1234@ntt.co.jp', email: 'admin@example.com', role: 'admin' },
  'user@example.com': { sub: 'u-2',userId: '5678@ntt.co.jp', email: 'user@example.com', role: 'user' },
}


let lastLoginAtISO: string | null = null
let lastLoginUserId: string | null = null


function issueTokens(email: string): AuthResponse {
  const user = directory[email]
  if (!user) {
    // Defensive: should not happen if you check before calling
    throw new Error('Unknown user in directory')
  }
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 3600
  const iss = 'https://cognito-idp.your-region.amazonaws.com/your_user_pool_id'
  const aud = 'your-client-id'

  const idClaims: CognitoClaims = {
    sub: user.sub,
    email: user.email,
    'custom:role': user.role,
    token_use: 'id',
    exp,
    iat: now,
    iss,
    aud,
  }

  const accessClaims: CognitoClaims = {
    sub: user.sub,
    email: user.email,
    'custom:role': user.role,
    token_use: 'access',
    exp,
    iat: now,
    iss,
    aud,
  }

  return {
    idToken: makeMockJwt(idClaims),
    accessToken: makeMockJwt(accessClaims),
    refreshToken: `mock-refresh-${user.sub}`,
    expiresIn: 3600,
    tokenType: 'Bearer',
    user,
  }
}

export const authHandlers = [
  // Login
  http.post('/api/auth/login', async ({ request }) => {
    const raw = await request.json()
    const body = raw as { username?: unknown; password?: unknown }

    if (SCENARIO === 'error') {
      return HttpResponse.json({ message: 'Service unavailable' }, { status: 503 })
    }

    if (typeof body.username !== 'string' || typeof body.password !== 'string') {
      return HttpResponse.json({ message: 'Invalid payload' }, { status: 400 })
    }

    const ok =
      (body.username === 'admin@example.com' && body.password === 'Admin#123') ||
      (body.username === 'user@example.com' && body.password === 'User#123')

    // ✅ Narrow: ensure the username exists in the directory (no implicit any index)
    const userExists = Object.prototype.hasOwnProperty.call(directory, body.username)

    if (!ok || !userExists) {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 })
    }

    
    const entry = directory[body.username]
    if (!entry) {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 })
    }

    lastLoginUserId = entry.userId
    lastLoginAtISO = new Date().toISOString()


    const tokens = issueTokens(body.username)
    return HttpResponse.json(tokens, { status: 200 })
  }),

  // Refresh
  http.post('/api/auth/refresh', async ({ request }) => {
    const raw = await request.json()
    const body = raw as { refreshToken?: unknown }
    if (typeof body.refreshToken !== 'string' || !body.refreshToken.startsWith('mock-refresh-')) {
      return HttpResponse.json({ message: 'Invalid refresh token' }, { status: 401 })
    }
    const userId = body.refreshToken.replace('mock-refresh-', '')
    const email = Object.values(directory).find((u) => u.sub === userId)?.email
    if (!email) {
      return HttpResponse.json({ message: 'Unknown user' }, { status: 401 })
    }
    return HttpResponse.json(issueTokens(email))
  }),

  // Logout (noop)
  http.post('/api/auth/logout', () => HttpResponse.json({ ok: true })),
  
  http.get('/api/user/session', async () => {
    
const raw = localStorage.getItem('auth:lastLogin')
  if (raw) return HttpResponse.json(JSON.parse(raw))

      // If nobody has logged in yet, return a sensible default
      const payload = {
        loginUserId: lastLoginUserId ?? '0001@ntt.co.jp',
        lastLoginAt: lastLoginAtISO ?? '2025-01-14T08:22:33+06:30', // default example
      }
      return HttpResponse.json(payload, { status: 200 })
    }),

]

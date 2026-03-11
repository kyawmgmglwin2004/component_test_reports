// src/types/api.ts

// src/types/api.ts
export type User = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'user' | 'admin'
  // Optional extras for registration profile
  phone?: string
  company?: string
  country?: string
  city?: string
  dateOfBirth?: string // ISO YYYY-MM-DD
  address?: string
}

export type AuthRequest = {
  username: string
  password: string
}

export type CognitoClaims = {
  sub: string
  email?: string
  'cognito:groups'?: string[] // optional Cognito groups
  'custom:role'?: 'user' | 'admin' // custom attribute for role
  token_use: 'id' | 'access'
  exp: number // UNIX epoch seconds
  iat: number
  iss?: string // issuer
  aud?: string // audience
}

export type AuthResponse = {
  idToken: string
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
  user: { sub: string; email: string; role: 'user' | 'admin' }
}

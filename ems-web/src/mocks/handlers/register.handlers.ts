// src/mocks/handlers/register.handlers.ts
import { http, HttpResponse } from 'msw'
import type { User } from '@/types/api'

type RegisterPayload = {
  firstName?: string
  lastName?: string
  email?: string
  password?: string
  confirmPassword?: string
  phone?: string
  role?: 'user' | 'admin'
  company?: string
  country?: string
  city?: string
  dateOfBirth?: string
  address?: string
  termsAccepted?: boolean
}

const existingEmails = new Set(['admin@example.com', 'user@example.com'])

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
function isValidPhone(phone?: string) {
  if (!phone) return true
  return /^[\d+\-\s()]{6,}$/.test(phone)
}

export const registerHandlers = [
  http.post('/api/register', async ({ request }) => {
    const raw = await request.json()
    const body = raw as RegisterPayload

    // Required fields
    if (!body.firstName || !body.lastName || !body.email || !body.password) {
      return HttpResponse.json({ message: 'Missing required fields' }, { status: 400 })
    }

    // Email format
    if (!isValidEmail(body.email)) {
      return HttpResponse.json({ message: 'Invalid email format' }, { status: 400 })
    }

    // Existing email conflict
    if (existingEmails.has(body.email)) {
      return HttpResponse.json({ message: 'Email already exists' }, { status: 409 })
    }

    // Password rules
    if (body.password.length < 8) {
      return HttpResponse.json(
        { message: 'Password must be at least 8 characters' },
        { status: 400 },
      )
    }
    if (body.confirmPassword !== undefined && body.confirmPassword !== body.password) {
      return HttpResponse.json({ message: 'Passwords do not match' }, { status: 400 })
    }

    // Terms
    if (body.termsAccepted !== true) {
      return HttpResponse.json({ message: 'You must accept the terms' }, { status: 400 })
    }

    // Optional phone format
    if (!isValidPhone(body.phone)) {
      return HttpResponse.json({ message: 'Invalid phone number' }, { status: 400 })
    }

    // Normalize role: you can force 'user' if needed
    const role: User['role'] = body.role === 'admin' ? 'admin' : 'user'

    const id = String(Date.now())
    const created: User = {
      id,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      role,
      // Optional fields (add to type accordingly)
      phone: body.phone ?? '',
      company: body.company ?? '',
      country: body.country ?? '',
      city: body.city ?? '',
      dateOfBirth: body.dateOfBirth ?? '',
      address: body.address ?? '',
    }

    return HttpResponse.json({ message: 'Registered', user: created }, { status: 201 })
  }),
]

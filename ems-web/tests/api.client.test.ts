import { describe, it, expect } from 'vitest'
import { apiGet } from '@/services/api'
import type { User } from '@/types/api'

describe('apiGet', () => {
  it('returns mocked users from MSW', async () => {
    const data = await apiGet<User[]>('/users')
    expect(Array.isArray(data)).toBe(true)
    expect(data[0]).toHaveProperty('firstName')
  })

  it('returns a single user', async () => {
    const user = await apiGet<User>('/users/1')
    expect(user.id).toBe('1')
  })
})

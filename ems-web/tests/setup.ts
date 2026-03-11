
// tests/setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from '../src/mocks/handlers'

// ✅ auto-add jest-dom matchers for Vitest
import '@testing-library/jest-dom/vitest'

// MSW Node server
const server = setupServer(...handlers)

if (!(globalThis as unknown).fetch)
  (globalThis as unknown).fetch = crossFetch

  // Ensure API base during tests (if you’re not using .env.test)
;(import.meta as unknown).env = {
  ...import.meta.env,
  VITE_API_BASE_URL: '/api',
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
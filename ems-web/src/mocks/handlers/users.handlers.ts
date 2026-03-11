// src/mocks/handlers/users.handlers.ts
import { http, HttpResponse } from 'msw'

const allUsers = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: i % 2 === 0 ? 'admin' : 'user',
}))

export const usersHandlers = [
  http.get('/users', ({ request }) => {
    const url = new URL(request.url)
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1)
    const limit = Math.max(parseInt(url.searchParams.get('limit') || '10', 10), 1)

    const total = allUsers.length
    const totalPages = Math.ceil(total / limit)

    // Ensure page doesn't exceed totalPages
    const currentPage = Math.min(page, totalPages)

    const start = (currentPage - 1) * limit
    const end = start + limit
    const paginatedUsers = allUsers.slice(start, end)

    return HttpResponse.json({
      data: paginatedUsers,
      pagination: {
        page: currentPage,
        limit,
        total,
        totalPages,
      },
    })
  }),
]

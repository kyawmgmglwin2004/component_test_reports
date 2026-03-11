// src/mocks/handlers/updates.handlers.ts
import { http, HttpResponse } from 'msw'

export const updatesHandlers = [
  http.put('/api/users/:id', async ({ request, params }) => {
    const auth = request.headers.get('Authorization') || ''
    if (!auth.startsWith('Bearer ')) return new HttpResponse('Unauthorized', { status: 401 })

    const raw = await request.json()
    const body = raw as { firstName?: unknown; lastName?: unknown }
    const hasFirst = typeof body.firstName === 'string'
    const hasLast = typeof body.lastName === 'string'
    if (!hasFirst && !hasLast) {
      return HttpResponse.json({ message: 'Nothing to update' }, { status: 400 })
    }

    // Simulate success (no actual mutation)
    return HttpResponse.json(
      {
        message: `User ${params.id} updated`,
        applied: {
          ...(hasFirst ? { firstName: body.firstName } : {}),
          ...(hasLast ? { lastName: body.lastName } : {}),
        },
      },
      { status: 200 },
    )
  }),
]

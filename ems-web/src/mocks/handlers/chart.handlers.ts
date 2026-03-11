// src/mocks/handlers/chart.handlers.ts
import { http, HttpResponse } from 'msw'

export const chartHandlers = [
  http.get('/mock-data.json', () => {
    return HttpResponse.json({
      categories: Array.from({ length: 24 }, (_, i) => (i + 1).toString()),
      series: [
        {
          name: 'Net Profit',
          data: [
            44, 55, 57, 56, 61, 58, 63, 60, 66, 70, 72, 75, 78, 80, 82, 85, 87, 90, 92, 95, 97, 100,
            102, 105,
          ],
        },
        {
          name: 'Revenue',
          data: [
            76, 85, 101, 98, 87, 105, 91, 114, 94, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155,
            160, 165, 170, 175, 180,
          ],
        },
        {
          name: 'Free Cash Flow',
          data: [
            35, 41, 36, 26, 45, 48, 52, 53, 41, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68,
            70, 72,
          ],
        },
      ],
    })
  }),

  // ✅ Detail chart handler
  http.get('/mock-detail.json', ({ request }) => {
    const url = new URL(request.url)
    const category = url.searchParams.get('category') || '1'
    const seriesName = url.searchParams.get('series') || 'Net Profit'

    // Generate mock detail data
    const detailSeries = [
      {
        name: `${seriesName} - Segment A`,
        data: [Math.random() * 50, Math.random() * 50, Math.random() * 50],
      },
      {
        name: `${seriesName} - Segment B`,
        data: [Math.random() * 50, Math.random() * 50, Math.random() * 50],
      },
      {
        name: `${seriesName} - Segment C`,
        data: [Math.random() * 50, Math.random() * 50, Math.random() * 50],
      },
    ]

    return HttpResponse.json({
      category,
      series: detailSeries,
    })
  }),
]

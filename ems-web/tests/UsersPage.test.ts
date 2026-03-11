import { render, screen } from '@testing-library/vue'
import UsersPage from '@/pages/UsersPage.vue'
import { createTestRouter } from '@/router/test-utils/router'

test('renders users from mocked API', async () => {
  const router = createTestRouter()
  render(UsersPage, { global: { plugins: [router] } })

  const item = await screen.findByText(/Aye Chan/i)
  expect(item).toBeInTheDocument()
})

import { createRouter, createWebHistory } from 'vue-router'

export function createTestRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/users', component: { template: '<div />' } },
      { path: '/users/:id', component: { template: '<div />' } },
    ],
  })
}

import { inject, provide, ref, type Ref } from 'vue'

const GLOBAL_LOADING_KEY = Symbol('GLOBAL_LOADING')

export type GlobalLoadingService = {
  open: Ref<boolean>
  message: Ref<string | null>
  show: (msg?: string) => void
  hide: () => void
}

/** Call this ONCE near the app root (e.g., App.vue or MainLayout) */
export function provideGlobalLoading(): GlobalLoadingService {
  const open = ref(false)
  const message = ref<string | null>(null)

  function show(msg?: string) {
    message.value = msg ?? null
    open.value = true
  }
  function hide() {
    open.value = false
    // Keep last message or clear it; both are fine. Here we clear:
    message.value = null
  }

  const service: GlobalLoadingService = { open, message, show, hide }
  provide(GLOBAL_LOADING_KEY, service)
  return service
}

/** Use this anywhere AFTER a provider has been set */
export function useGlobalLoading(): GlobalLoadingService {
  const svc = inject<GlobalLoadingService>(GLOBAL_LOADING_KEY)
  if (!svc) {
    // In dev, this helps you find if provider wasn't mounted.
    throw new Error(
      '[globalLoading] No provider found. Call provideGlobalLoading() in App.vue or a top-level layout.'
    )
  }
  return svc
}
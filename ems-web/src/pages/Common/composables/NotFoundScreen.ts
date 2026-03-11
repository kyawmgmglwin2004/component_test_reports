import { ref, onMounted, onUnmounted } from 'vue'

const isOpen    = ref(false)
const code      = ref<number | undefined>(undefined)
const errorCode = ref<string | undefined>(undefined)
const payload   = ref<{ title?: string; subtitle?: string } | undefined>(undefined)

type Overrides = { title?: string; errorCode?: string }

function normalizeStatus(maybeCode: unknown): number {
  const n = typeof maybeCode === 'number' ? maybeCode : NaN
  if (!Number.isFinite(n) || n <= 0) return 503
  if (n === 0 || n === 503) return 503
  return n
}

function open() {
  isOpen.value = true
}

function openWith(statusCode: number | undefined, overrides?: Overrides) {
  const normalized = normalizeStatus(statusCode)
  code.value = normalized
  errorCode.value = overrides?.errorCode
  payload.value = overrides
  isOpen.value = true
}

function close() {
  isOpen.value = false
}
function useNetworkAwareness() {
  const onOffline = () => {
    openWith(503)
  }
  const onOnline = () => {
  }

  onMounted(() => {
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)

    if (typeof navigator !== 'undefined' && navigator && 'onLine' in navigator) {
      if (navigator.onLine === false) {
        onOffline()
      }
    }
  })

  onUnmounted(() => {
    window.removeEventListener('offline', onOffline)
    window.removeEventListener('online', onOnline)
  })
}

export function useNotFoundScreenProps() {
  useNetworkAwareness()

  return {
    isOpen,
    open,
    openWith,
    close,
    code,
    errorCode,
    payload,
  }
}
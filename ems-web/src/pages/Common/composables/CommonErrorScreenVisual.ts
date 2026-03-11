import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

export function useCommonErrorScreenProps() {

const { t } = useI18n()
const route = useRoute()

const statusCode = computed<number>(() => {
  const codeRaw = route.query.code ?? route.params.code
  const n = Number(codeRaw)
  return Number.isFinite(n) ? n : 404
})

const ui = computed(() => {
  const code = statusCode.value
  const map: Record<number, { title: string; subtitle?: string; icon: string; color: string }> = {
    500: { title: t('popUp.somethingWentWrong'),     subtitle: t('popUp.tryAgain'),     icon: 'mdi-alert-circle-outline', color: '#e53935' },
    404: { title: t('error.E0046'),  icon: 'mdi-alert-circle-outline',            color: '#e53935' },
  }

  return map[code] ?? {
    title: t('error.E0046'),
    subtitle: undefined,
    icon: 'mdi-alert-circle-outline',
    color: '#e53935',
  }
})

  return {ui}
}
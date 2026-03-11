import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

export type CommonErrorScreenProps = {
  returnTo?: string
}

export function useCommonErrorScreen(props: CommonErrorScreenProps) {
  const router = useRouter()
  const { t } = useI18n()

  const onReturn = () => {
    router.push({ path: props.returnTo ?? '/' })
  }

  return { onReturn, t }
}
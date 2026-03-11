import { createI18n } from 'vue-i18n'
import ja from './locales/message_properties.json'

export const i18n = createI18n({
  legacy: false,
  locale: 'ja', // Default Japanese
  fallbackLocale: 'ja',
  messages: { ja }
})
import en from './dictionaries/en.json'

export const LOCALES = ['en', 'ru', 'zh', 'th']
export const DEFAULT_LOCALE = 'en'

const loaders = {
  en: () => Promise.resolve(en),
  ru: () => import('./dictionaries/ru.json').then(m => m.default).catch(() => en),
  zh: () => import('./dictionaries/zh.json').then(m => m.default).catch(() => en),
  th: () => import('./dictionaries/th.json').then(m => m.default).catch(() => en),
}

export async function getDictionary(lang) {
  const loader = loaders[lang] ?? loaders[DEFAULT_LOCALE]
  return loader()
}

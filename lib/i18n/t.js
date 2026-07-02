import en from './dictionaries/en.json'

// Dot-path lookup with an always-available English fallback, so a missing
// or partially-translated dictionary key never renders blank text.
export function t(dict, path) {
  const get = (obj, p) => p.split('.').reduce((o, k) => o?.[k], obj)
  return get(dict, path) ?? get(en, path) ?? path
}

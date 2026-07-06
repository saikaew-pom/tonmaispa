// Resolves the project's `@/` import alias for one-off Node scripts.
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const mapped = new URL('../' + specifier.slice(2) + (specifier.endsWith('.js') ? '' : '.js'), import.meta.url).href
    return next(mapped, context)
  }
  return next(specifier, context)
}

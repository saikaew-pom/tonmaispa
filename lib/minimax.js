// MiniMax-M3 via Anthropic-compatible API
// Swap provider by changing baseURL + apiKey — the SDK stays identical.
import Anthropic from '@anthropic-ai/sdk'

export const MINIMAX_MODEL = 'MiniMax-M3'

export const getMiniMax = () => {
  if (!process.env.MINIMAX_API_KEY) {
    console.warn('[minimax] MINIMAX_API_KEY not set')
    return null
  }
  return new Anthropic({
    apiKey:  process.env.MINIMAX_API_KEY,
    baseURL: 'https://api.minimax.io/anthropic',
  })
}

const MODEL_MESSAGE_LIMIT = 14
const MODEL_CHARACTER_LIMIT = 12000
const STORED_MESSAGE_LIMIT = 30
const STORED_CHARACTER_LIMIT = 30000

function normaliseMessages(messages) {
  const clean = (Array.isArray(messages) ? messages : [])
    .filter(message => message && ['user', 'assistant'].includes(message.role))
    .map(message => ({
      role: message.role,
      content: String(message.content ?? '').slice(0, 4000),
    }))
    .filter(message => message.content.trim())

  // Consecutive messages with the same role can appear after a restored
  // welcome or an error. Merge them into a valid conversational turn.
  return clean.reduce((merged, message) => {
    const previous = merged[merged.length - 1]
    if (previous?.role === message.role) {
      previous.content = `${previous.content}\n\n${message.content}`.slice(-4000)
    } else {
      merged.push({ ...message })
    }
    return merged
  }, [])
}

function takeRecentWithinBudget(messages, maxMessages, maxCharacters) {
  const selected = []
  let usedCharacters = 0

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (selected.length >= maxMessages) break

    const remaining = maxCharacters - usedCharacters
    if (remaining <= 0) break

    // Always keep the newest message. Older oversized messages are omitted
    // rather than allowed to exhaust the model context.
    if (message.content.length > remaining && selected.length > 0) continue

    const content = message.content.length > remaining
      ? message.content.slice(-remaining)
      : message.content

    selected.unshift({ ...message, content })
    usedCharacters += content.length
  }

  // Anthropic-compatible chat requests are most reliable when the retained
  // context begins with a user turn.
  while (selected.length > 1 && selected[0].role !== 'user') selected.shift()
  return selected
}

export function prepareModelMessages(messages) {
  return takeRecentWithinBudget(
    normaliseMessages(messages),
    MODEL_MESSAGE_LIMIT,
    MODEL_CHARACTER_LIMIT
  )
}

export function prepareStoredMessages(messages, assistantText) {
  const withReply = [
    ...(Array.isArray(messages) ? messages : []),
    { role: 'assistant', content: assistantText, timestamp: new Date().toISOString() },
  ]

  const recent = takeRecentWithinBudget(
    normaliseMessages(withReply),
    STORED_MESSAGE_LIMIT,
    STORED_CHARACTER_LIMIT
  )

  return recent.map(message => ({
    ...message,
    timestamp: new Date().toISOString(),
  }))
}

/**
 * Extract a user-facing message from an Axios (or similar) API error.
 * Prefers plain-text / structured backend messages over Axios status fallbacks.
 *
 * @param {unknown} error
 * @param {string} [fallback='Request failed']
 * @returns {string}
 */
export function getApiErrorMessage(error, fallback = 'Request failed') {
  const data = error?.response?.data

  if (typeof data === 'string' && data.trim()) {
    const trimmed = data.trim()
    if (trimmed.startsWith('<')) {
      const match = trimmed.match(/<message>([\s\S]*?)<\/message>/i)
      if (match?.[1]?.trim()) {
        return decodeXmlEntities(match[1].trim())
      }
    } else {
      return trimmed
    }
  }

  if (data && typeof data === 'object') {
    const message = pickUsefulMessage(data.message)
    if (message) {
      return message
    }
    const causeMessage = pickUsefulMessage(data.cause?.message)
    if (causeMessage) {
      return causeMessage
    }
  }

  const axiosMessage = error?.message
  if (typeof axiosMessage === 'string' && axiosMessage.trim()
      && !/^Request failed with status code \d+$/i.test(axiosMessage)) {
    return axiosMessage.trim()
  }

  const status = error?.response?.status
  if (status === 504) {
    return 'The remote server timed out. Try again later.'
  }
  if (status === 502) {
    return 'Could not reach the remote host. Check the URL and try again.'
  }
  if (status === 400) {
    return 'Invalid request. Check that the URL is a valid HTTPS address.'
  }

  return fallback
}

function pickUsefulMessage(value) {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'Request failed.') {
    return null
  }
  return trimmed
}

function decodeXmlEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

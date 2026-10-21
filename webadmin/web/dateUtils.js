/**
 * Format a date to a readable string
 * @param {Date|string} date - Date object or date string
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  if (!date) return 'Unknown'
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  if (isNaN(dateObj.getTime())) return 'Invalid Date'
  
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Check if a date is within a certain number of days from now
 * @param {Date|string} date - Date to check
 * @param {number} days - Number of days
 * @returns {boolean} True if within the specified days
 */
export function isWithinDays(date, days) {
  if (!date) return false
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffTime = dateObj.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays <= days && diffDays >= 0
}

/**
 * Check if a date has passed
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if the date has passed
 */
export function isExpired(date) {
  if (!date) return false
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  
  return dateObj.getTime() < now.getTime()
}

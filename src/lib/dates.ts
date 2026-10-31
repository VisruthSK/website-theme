const monthNames = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'long',
})

const monthName = (month: number) =>
  monthNames.format(new Date(Date.UTC(2000, month - 1, 1)))

const dayMonthYear = (year: number, month: number, day: number) =>
  `${day} ${monthName(month)} ${year}`

export const formatDate = (date: Date) =>
  dayMonthYear(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())

export function formatLooseDate(value: Date | string | number) {
  if (value instanceof Date) return formatDate(value)

  const text = String(value).trim()
  const numeric = text.match(/^(\d{4})(?:-?(\d{2})(?:-?(\d{2}))?)?$/)
  if (numeric) {
    const [, year, month, day] = numeric
    if (day) return dayMonthYear(+year, +month, +day)
    return month ? `${monthName(+month)} ${year}` : year
  }

  const named = text.match(/^([A-Za-z]{3,})\.? (\d{4})$/)
  const parsed = named && new Date(`${named[1]} 1, ${named[2]} UTC`)
  if (named && parsed && !Number.isNaN(parsed.valueOf())) {
    return `${monthName(parsed.getUTCMonth() + 1)} ${named[2]}`
  }

  return text
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function formatTitleAsHtml(input: string) {
  return escapeHtml(input).replace(/`([^`]+)`/g, "<code>$1</code>")
}

const countFormatter = new Intl.NumberFormat("en-US")

export function formatCount(value: number) {
  return countFormatter.format(value)
}

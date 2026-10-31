export const EXTERNAL_LINK_ICON_SYMBOL_ID = "external-link-icon-symbol"
export const NEW_TAB_DESCRIPTION_ID = "external-link-new-tab-description"
export const NEW_TAB_LABEL = "Opens in new tab"

export const EXTERNAL_LINK_ICON_HTML = `<span class="external-link-icon-wrap">⁠<svg class="external-link-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#${EXTERNAL_LINK_ICON_SYMBOL_ID}"></use></svg></span>`

export const newTabProps = (external: boolean) =>
  external
    ? {
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-describedby": NEW_TAB_DESCRIPTION_ID,
      }
    : {}

const withoutWww = (hostname: string) => hostname.replace(/^www\./, "")

export function externalTo(site: string) {
  const siteHostname = withoutWww(new URL(site).hostname.toLowerCase())
  return (href: unknown): boolean => {
    if (typeof href !== "string") return false
    try {
      const url = new URL(href, site)
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        withoutWww(url.hostname.toLowerCase()) !== siteHostname
      )
    } catch {
      return false
    }
  }
}

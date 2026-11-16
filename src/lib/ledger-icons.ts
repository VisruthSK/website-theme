import CranIcon from "@/icons/cran.svg"
import GlobeIcon from "@/icons/globe.svg"
import GithubIcon from "@/icons/github.svg"

export const LEDGER_LINK_ICON_NAMES = ["github", "globe", "cran"] as const

export type LedgerLinkIcon = (typeof LEDGER_LINK_ICON_NAMES)[number]

export const LEDGER_LINK_ICONS: Record<LedgerLinkIcon, typeof GithubIcon> = {
  github: GithubIcon,
  globe: GlobeIcon,
  cran: CranIcon,
}

export const LEDGER_LINK_LABELS: Record<LedgerLinkIcon, string> = {
  github: "Repository",
  globe: "Website",
  cran: "CRAN",
}

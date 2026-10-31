const root = document.documentElement
const flip = document.querySelector(".theme-flip")
const system = matchMedia("(prefers-color-scheme: dark)")
const systemTheme = () => (system.matches ? "dark" : "light")

const stored = () => {
  try {
    const value = localStorage.getItem("theme")
    return value === "dark" || value === "light" ? value : null
  } catch {
    return null
  }
}

const sync = () => {
  if (flip) flip.checked = (stored() ?? systemTheme()) !== systemTheme()
}

sync()
system.addEventListener("change", sync)

flip?.addEventListener("change", () => {
  const opposite = systemTheme() === "dark" ? "light" : "dark"
  const theme = flip.checked ? opposite : systemTheme()
  root.dataset.theme = theme
  try {
    localStorage.setItem("theme", theme)
  } catch {}
})

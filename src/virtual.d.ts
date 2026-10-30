declare module 'virtual:erudite/config' {
  const theme: import('../config/theme').Theme
  export const paths: { bibliographies: string; public: string }
  export default theme
}

declare module 'virtual:erudite/assets' {
  export const fonts: {
    body: string
    bodyItalic?: string
    heading: string
    mono?: string
    dropCap?: string
  }
  export const icons: Record<string, import('astro/types').SvgComponent>
  export const typesetScript: string | undefined
}

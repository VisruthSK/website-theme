import expressiveCode from 'satteri-expressive-code'
import { ecRenderer } from './astro-erudite'

export const codeAssets = ecRenderer

export const code = expressiveCode({
  customCreateRenderer: async () => ({
    ...(await ecRenderer),
    baseStyles: '',
    themeStyles: '',
    jsModules: [],
  }),
})

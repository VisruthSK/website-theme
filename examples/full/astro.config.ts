import { defineConfig } from "astro/config"

import { themeConfig } from "../../src/integrations/theme"

export default defineConfig(await themeConfig(new URL("./", import.meta.url)))

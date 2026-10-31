import type { AstroIntegration } from "astro"
import { cp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import * as pagefind from "pagefind"

const PAGEFIND_WASM_INIT = "this.wasm=await this.backend(final_wasm);"
const PAGEFIND_WASM_INIT_FIXED =
  "this.wasm=await this.backend({module_or_path:final_wasm});"

const UNUSED_PAGEFIND_UI = /^pagefind-(component-ui|modular-ui|ui|highlight)\./

async function removeUnusedUi(pagefindDir: string) {
  const files = await readdir(pagefindDir)
  await Promise.all(
    files
      .filter((file) => UNUSED_PAGEFIND_UI.test(file))
      .map((file) => rm(join(pagefindDir, file))),
  )
}

function assertPagefindSuccess(step: string, errors: string[]) {
  if (errors.length > 0) {
    throw new Error(`${step} failed:\n${errors.join("\n")}`)
  }
}

async function patchPagefindRuntime(pagefindDir: string) {
  await Promise.all(
    ["pagefind.js", "pagefind-worker.js"].map(async (filename) => {
      const filePath = join(pagefindDir, filename)
      const source = await readFile(filePath, "utf8")
      const patched = source.replaceAll(
        PAGEFIND_WASM_INIT,
        PAGEFIND_WASM_INIT_FIXED,
      )

      if (patched !== source) {
        await writeFile(filePath, patched)
      }
    }),
  )
}

export function pagefindSearch(): AstroIntegration {
  let publicDir: URL
  return {
    name: "pagefind-search",
    hooks: {
      "astro:config:done": ({ config }) => {
        publicDir = config.publicDir
      },
      "astro:build:done": async ({ dir, logger }) => {
        const outputPath = fileURLToPath(dir)
        const pagefindPath = fileURLToPath(new URL("./pagefind/", dir))
        const pagefindPublicPath = fileURLToPath(
          new URL("pagefind/", publicDir),
        )

        try {
          const { errors, index } = await pagefind.createIndex()
          assertPagefindSuccess("Pagefind initialization", errors)

          if (!index) {
            throw new Error("Pagefind did not return an index instance.")
          }

          const indexing = await index.addDirectory({ path: outputPath })
          assertPagefindSuccess("Pagefind indexing", indexing.errors)

          await rm(pagefindPublicPath, { recursive: true, force: true })

          const distWrite = await index.writeFiles({ outputPath: pagefindPath })
          assertPagefindSuccess("Pagefind dist write", distWrite.errors)
          await removeUnusedUi(pagefindPath)
          await patchPagefindRuntime(pagefindPath)

          await cp(pagefindPath, pagefindPublicPath, { recursive: true })

          logger.info(`Pagefind indexed ${indexing.page_count} pages.`)
        } finally {
          await pagefind.close()
        }
      },
    },
  }
}

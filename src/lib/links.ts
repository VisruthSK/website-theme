type Finding = { url: string; reason: string }

export function assertNoBrokenLinks(
  id: string,
  frontmatter: { brokenLinks?: Finding[] },
) {
  const broken = frontmatter.brokenLinks ?? []
  if (broken.length === 0) return

  const message = `Broken links in ${id}:\n${broken
    .map(({ url, reason }) => `  ${url}: ${reason}`)
    .join('\n')}`
  if (import.meta.env.PROD) throw new Error(message)
  console.warn(message)
}

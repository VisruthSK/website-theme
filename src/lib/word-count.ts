/**
 * Word count of a markdown body: fenced code blocks and inline code are
 * not prose, so they do not count towards reading time or drop caps.
 */
export function calculateWordCount(text: string | null | undefined): number {
  if (!text) return 0
  const kept: string[] = []
  let fence: "```" | "~~~" | null = null
  for (const line of text.split("\n")) {
    const marker = line.match(/^\s*(```|~~~)/)
    if (marker) {
      fence = fence ? null : (marker[1] as "```" | "~~~")
      continue
    }
    if (!fence) kept.push(line)
  }
  return kept
    .join(" ")
    .replace(/<[^>]+>/g, "")
    .replace(/`[^`\n]*`/g, " ")
    .split(/\s+/)
    .filter(Boolean).length
}

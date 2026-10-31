export interface YearGroup<T> {
  heading: string
  entries: T[]
}

export function groupByYear<T>(
  items: T[],
  dateOf: (item: T) => Date | undefined,
  compare?: (a: T, b: T) => number,
): YearGroup<T>[] {
  const years = new Map<number, T[]>()
  const undated: T[] = []
  for (const item of items) {
    const date = dateOf(item)
    if (!date) undated.push(item)
    else {
      const year = date.getUTCFullYear()
      years.set(year, [...(years.get(year) ?? []), item])
    }
  }
  const groups = [...years]
    .sort(([a], [b]) => b - a)
    .map(([year, entries]) => ({
      heading: String(year),
      entries: compare ? entries.toSorted(compare) : entries,
    }))
  return undated.length
    ? [...groups, { heading: "Undated", entries: undated }]
    : groups
}

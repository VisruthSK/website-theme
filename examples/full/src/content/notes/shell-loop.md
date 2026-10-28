---
title: 'Code Blocks'
date: 2024-12-05
description: 'A fenced code block and inline code, with lorem ipsum filler.'
tags: ['code']
---

THIS CONTENT IS ENTIRELY LLM WRITTEN

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. A fenced block gets syntax highlighting, and `inline code` stays in the line:

```bash
for file in lorem*.txt; do
  number=${file//[^0-9]/}
  mv "$file" "$(printf 'ipsum-%03d.txt' "$number")"
done
```

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

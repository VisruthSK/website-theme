---
title: 'Renaming Files in a Loop'
date: 2024-12-05
description: 'A small shell loop that saved an afternoon.'
tags: ['code']
---

I had a folder of scanned pages named `scan 1.png`, `scan 2.png` and so on, and wanted them numbered with leading zeros so that they would sort properly. A short loop did it:

```bash
for file in scan*.png; do
  number=${file//[^0-9]/}
  mv "$file" "$(printf 'page-%03d.png' "$number")"
done
```

The `${file//[^0-9]/}` expansion strips everything that is not a digit, and `printf` pads the result. Run it once with `echo` in front of `mv` to check the names before committing to them.

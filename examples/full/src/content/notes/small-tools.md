---
title: 'Small Tools'
date: 2025-04-02
description: 'A function short enough to remember.'
tags: ['code']
---

Some of the most useful code is too small to publish. This function clamps a number to a range and has appeared, in one form or another, in almost every project I have worked on:

```js
const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
```

It is not clever, and that is the point. A small tool that is easy to read gets used; a clever one gets rewritten.

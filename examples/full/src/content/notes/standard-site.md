---
title: "Publishing to Standard.site"
date: 2026-11-03
description: "Publish the master RSS feed to the AT Protocol."
tags: ["features"]
---

The theme can publish its master RSS feed to [Standard.site](https://standard.site/), making the site's posts available on the AT Protocol. All sections share one publication. The records include each post's canonical URL, date, tags, description and rendered content, along with plain text for readers that need it.

The RSS feed decides what gets published. Drafts and future posts stay out until they appear in the feed. Set `rss: false` in a post's frontmatter to leave it out of Standard.site as well as the RSS feeds; it remains on the website. Removing a post from the feed does not delete an existing record from your account.

To enable publishing, set `STANDARD_SITE_PUBLICATION` to the AT URI of your publication, such as `at://did:plc:.../site.standard.publication/<tid>`. Use an unused [TID](https://atproto.com/specs/tid) and keep the URI stable. Set this variable when building the site so the build can add the verification links.

After the build, run `node theme/scripts/sync-standard-site.mjs` with the same publication URI and these variables:

- `STANDARD_SITE_URL`: the site's `site.href` from `theme.json`.
- `STANDARD_SITE_DIST`: the build output directory, usually `dist`.
- `ATPROTO_IDENTIFIER`: the account's handle.
- `ATPROTO_PASSWORD`: an app password for that account.

Keep the app password in your build provider's secrets, and run the sync only for production builds. The first run creates the publication and its documents. Later runs update records when their content changes and leave unchanged records alone. The website remains the canonical home for each post.

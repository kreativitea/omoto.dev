# omoto.dev

Personal site and writing. Eleventy → static HTML → GitHub Pages.

## Requirements

**Node is not currently installed on this machine.** You'll need it to build or preview locally:

```bash
brew install node
```

CI installs its own Node, so deploys work regardless.

## Local

```bash
npm install
npm run dev
```

Serves at <http://localhost:8080>. Posts with `draft: true` are visible locally and excluded from
production builds.

## Deploy

Push to `main`. `.github/workflows/deploy.yml` builds and publishes to GitHub Pages.

One-time setup on the repo: **Settings → Pages → Source: GitHub Actions**.

### Custom domain

`src/CNAME` contains `omoto.dev` and is copied into the build output. The workflow fails the build
if it goes missing, because a missing CNAME silently resets the custom domain on deploy.

DNS at the registrar:

| Type  | Name | Value |
|-------|------|-------|
| A     | @    | 185.199.108.153 |
| A     | @    | 185.199.109.153 |
| A     | @    | 185.199.110.153 |
| A     | @    | 185.199.111.153 |
| AAAA  | @    | 2606:50c0:8000::153 |
| AAAA  | @    | 2606:50c0:8001::153 |
| AAAA  | @    | 2606:50c0:8002::153 |
| AAAA  | @    | 2606:50c0:8003::153 |
| CNAME | www  | `<username>.github.io.` |

Then enable **Enforce HTTPS** in Settings → Pages once the certificate issues (can take an hour).

Verify:

```bash
dig omoto.dev +short && curl -sSI https://omoto.dev | head -1
```

## Writing

Posts live in `src/writing/*.md`.

```yaml
---
title: A system that can’t be subpoenaed
date: 2026-07-30
summary: One line for the index page and the feed.
drafts: 6          # optional — renders as "sixth draft" in the byline
touched: 2 Aug     # optional — "last touched 2 Aug"
draft: true        # optional — local only, never deploys
wash:
  seed: subpoena-2026    # any string; the same seed always paints the same figure
  palette: sumi          # indigo | sakura | matcha | ochre | sumi
  caption: Chiba, 2012   # optional
---
```

## Design

Sumi and washi, pulled toward a practice sheet — 稽古, not a gallery print. The governing idea:
every page should look like the third attempt at something, with the first two still visible.

The reference comp is `design-demos/05-sumi-practice.html`, a single self-contained file. The four
original explorations are alongside it.

Illustrations are generated, not drawn: `lib/wash.js` turns a seed string into an SVG watercolour.
Read the header comment there before changing the filters — two specific things (a separate
granulation layer, and high-frequency turbulence over a large filter region) will break it in ways
that are hard to diagnose.

## Structure

```
lib/wash.js              seeded procedural watercolour
src/_includes/defs.njk   shared SVG filters — one copy per page
src/_includes/seal.njk   敏
src/_includes/layouts/   base, post, page
src/assets/css/site.css  tokens + the whole design system
src/writing/             posts
```

## Known TODO

- The 敏 glyph is system-font `<text>`; trace it to a `<path>` (ideally 篆書 seal script) so it
  doesn't depend on Hiragino Mincho being installed.
- Self-host subset `woff2` fonts; the CSS currently uses macOS system stacks.
- All four seed posts are placeholder prose, not Mike's words. Rewrite before publishing.

# Stroke tools

The generator behind the masthead stroke, kept because the shipped mark came
out of it and any revision to that mark should come out of it too.

A stroke here is not a hand-fitted outline. It is a centreline, a pressure
profile along that centreline, and lengthwise kasure (掠れ) — which is what a
brush stroke actually is, and why the marks these produce read as brushed
rather than drawn. `strokes.mjs` holds the eleven studies and the machinery;
each option is a handful of parameters.

```bash
node design-demos/tools/build-strokes.mjs   # → 10-stroke-studies.html, eleven options
node design-demos/tools/build-length.mjs    # → 11-stroke-length.html, one option at five lengths
node design-demos/tools/bake.mjs tucked 1440 120   # → static markup for base.njk
```

The two HTML pages inline `site.css` at generation time, so they are snapshots:
they will keep looking the way the site looked on the day they were built, which
is the point of keeping them.

## The shipped mark

Option `tucked` — "Tucked entry, lifted exit" — baked at 1440 units, 120
samples, then trimmed to a 1356-wide viewBox so the ink spans edge to edge.
It lives in `src/_includes/layouts/base.njk` as a static path. **Regenerate,
don't hand-edit**: the coordinates are sampled output, and there is nothing in
them a person can meaningfully adjust by hand.

Two things in there are load-bearing and easy to undo by accident:

- The SVG carries `preserveAspectRatio="none"` against a fixed height in CSS.
  The default (`meet`) scales uniformly, so a full-bleed stroke would get
  *fatter* on a wider window. Stretching x alone lengthens the travel and
  leaves the weight alone, which is what a longer stroke of the same brush
  looks like.
- Kasure dash lengths are absolute and must stay that way. The gaps come from
  how far apart the bristles are — a property of the brush, not of how far it
  travelled — so a longer stroke shows *more* gaps of the same size. Scaling
  them with length makes a long stroke read as a wetter, coarser brush instead
  of a faster one.

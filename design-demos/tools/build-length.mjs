import { readFileSync, writeFileSync } from 'node:fs';
import { render, OPTIONS } from './strokes.mjs';

// Resolved from this file, not the cwd, so the script runs from anywhere.
const ROOT = new URL('../../', import.meta.url);
const css = readFileSync(new URL('src/assets/css/site.css', ROOT), 'utf8');

/* The site sets .brush to min(28rem, 100%) — 448px — against a wordmark that
 * is about 340px wide at 2.1rem. The masthead's text column runs to roughly
 * 55rem at the page's max width, so that is the far end of what is available
 * without touching the layout. */
const LENGTHS = [
  { rem: 28, px: 448, label: 'Current — 28rem', note: 'Ends about 100px past the name.' },
  { rem: 34, px: 544, label: '34rem',           note: 'Clears the ruby reading beneath the name.' },
  { rem: 40, px: 640, label: '40rem',           note: 'Past the reading measure; reads as a rule under the whole block.' },
  { rem: 46, px: 736, label: '46rem',           note: 'Well past the name — the mark becomes the horizontal of the page.' },
  { rem: 55, px: 880, label: '55rem — full column', note: 'The whole text column, stopping at the seal.' },
];

// Two options, not three: fifteen rungs at real masthead type overflows the
// viewport, and this page has to be readable in one screen — heavy SVG filters
// on this site fail to rasterise at scroll offsets.
const PICKS = ['tucked', 'doubled'];

const sections = PICKS.map((id) => {
  const o = OPTIONS.find((x) => x.id === id);
  const rendered = LENGTHS.map((L, i) => render(o, L.px, `-${i}`));
  return {
    o,
    rendered,
    html: `
  <section class="study">
    <h2>${o.name}</h2>
    ${rendered.map((r, i) => `
    <div class="rung">
      <span class="len">${LENGTHS[i].label}</span>
      <div class="mark">
        <h3 class="wordmark">Michael <span class="mid">Toshiro</span> Omoto</h3>
        <span class="reading" lang="ja">大本　マイケル　敏郎</span>
        ${r.svg}
      </div>
      <span class="note">${LENGTHS[i].note}</span>
    </div>`).join('')}
  </section>`,
  };
});

const filters = sections.flatMap((s) => s.rendered.map((r) => r.filterDef)).join('\n');

writeFileSync(new URL('design-demos/11-stroke-length.html', ROOT), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>masthead stroke — length</title>
<style>
${css}
body{padding:0}
.sheet{max-width:66rem;margin:0 auto;padding:1.6rem 2rem 2.5rem}
.sheet > h1{font-family:var(--sans);font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;
  color:var(--faint);font-weight:400;margin:0 0 .4rem}
.sheet > .intro{color:var(--ink-soft);font-size:.84rem;max-width:40rem;margin:0 0 1.6rem;line-height:1.6}
.study{margin:0 0 1.2rem}
.study > h2{font-family:var(--sans);font-size:.66rem;letter-spacing:.2em;text-transform:uppercase;
  color:var(--vermilion);font-weight:400;margin:0 0 .2rem}
.rung{padding:.55rem 0;border-top:1px solid var(--hairline);
  display:grid;grid-template-columns:9.5rem 1fr;gap:.2rem 1.5rem;align-items:start}
.rung .len{font-family:var(--sans);font-size:.66rem;letter-spacing:.1em;color:var(--faint);padding-top:.5rem}
.rung .note{grid-column:2;font-family:var(--sans);font-size:.66rem;color:var(--faint);letter-spacing:.02em}
.rung .mark{min-width:0}
/* True masthead type: the earlier study shrank the wordmark for compactness,
   which quietly flattered every stroke's length against the name it underlines
   — the exact relationship being judged here. */
.rung .wordmark{font-size:2.1rem;margin:0;font-weight:400;letter-spacing:.06em;line-height:1.2}
.rung .reading{display:block;font-family:var(--jp);font-size:.86rem;letter-spacing:.1em;
  color:var(--ink-soft);margin-top:.25rem}
/* width:auto is load-bearing. site.css sets .brush{width:min(28rem,100%)}, and
   without overriding it every length below renders at 28rem — the SVGs differ,
   the rendered marks do not, and the whole ladder silently shows one length
   five times. auto on a replaced element resolves to its intrinsic width, which
   is the width attribute each stroke was generated at. */
.rung .brush{display:block;width:auto;height:auto;max-width:100%;margin:.4rem 0 0 -.75rem}
</style>
</head><body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
${filters}
</defs></svg>
<div class="sheet">
  <h1>Masthead stroke — how long?</h1>
  <p class="intro">Two of the stronger options at five lengths, with the wordmark and its reading
  at real masthead size so the stroke-to-name relationship is honest. Length stretches the travel
  of the brush, not the brush: the mark gets finer as it gets longer, the way it would on paper.
  All start 11px left of the M.</p>
${sections.map((s) => s.html).join('\n')}
</div>
</body></html>`);

console.log(`wrote design-demos/11-stroke-length.html — ${PICKS.length} options × ${LENGTHS.length} lengths`);

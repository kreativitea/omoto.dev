import { DateTime } from 'luxon';
import rssPlugin from '@11ty/eleventy-plugin-rss';
import { washFigure, washDab } from './lib/wash.js';
import { timeline, keyOf } from './lib/timeline.js';

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(rssPlugin);

  eleventyConfig.addPassthroughCopy({ 'src/assets': 'assets' });
  eleventyConfig.addPassthroughCopy({ 'src/CNAME': 'CNAME' });
  eleventyConfig.addWatchTarget('./lib/');

  /* ------------------------------------------------------------ dates --- */

  const TZ = 'Asia/Tokyo';

  eleventyConfig.addFilter('readable', (d) =>
    DateTime.fromJSDate(d, { zone: TZ }).toFormat('d LLLL yyyy'));

  eleventyConfig.addFilter('monthYear', (d) =>
    DateTime.fromJSDate(d, { zone: TZ }).toFormat('LLLL yyyy'));

  eleventyConfig.addFilter('isoDate', (d) =>
    DateTime.fromJSDate(d, { zone: TZ }).toFormat('yyyy-LL-dd'));

  /* --------------------------------------------------- practice-sheet --- */

  /**
   * Post metadata admits its own process: "fourth draft · last touched 12 Aug"
   * rather than a single authoritative date. `drafts` is optional in front
   * matter; without it this degrades to just the date.
   */
  const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
    'seventh', 'eighth', 'ninth', 'tenth'];

  eleventyConfig.addFilter('draftCount', (n) =>
    !n ? '' : (ORDINALS[n] ? `${ORDINALS[n]} draft` : `draft ${n}`));

  /* -------------------------------------------------------- mount path --- */

  /**
   * Rewrite a site-absolute path to one relative to the current page, so the
   * built site works at any mount point — the apex domain, a project page under
   * /omoto.dev/, a preview directory, even file://.
   *
   * Absolute paths like /assets/css/site.css only resolve when the site sits at
   * the domain root. Served one level down they point above the site and 404,
   * which is exactly what happens on a GitHub project page.
   *
   *   page /                 →  assets/css/site.css
   *   page /about/           →  ../assets/css/site.css
   *   page /writing/slug/    →  ../../assets/css/site.css
   */
  eleventyConfig.addFilter('rel', function (target, absolute) {
    // A 404 is served at whatever URL failed rather than at its own permalink,
    // so its depth is unknowable and relative paths cannot be computed. Those
    // pages pass `absoluteAssets` and get site-absolute paths, which are
    // correct at the apex domain.
    if (absolute) return String(target);

    const here = (this.page && this.page.url) || '/';
    const segs = here.split('/').filter(Boolean);
    // a trailing slash means we're in a directory; otherwise the last segment
    // is a filename and doesn't count toward depth (e.g. /404.html)
    const depth = here.endsWith('/') ? segs.length : segs.length - 1;
    const up = '../'.repeat(Math.max(0, depth));
    const clean = String(target).replace(/^\//, '');
    return up + clean || './';
  });

  /* ------------------------------------------------------ watercolour --- */

  // Seeded, deterministic. Same seed always paints the same figure, so a post
  // keeps its illustration across rebuilds.
  eleventyConfig.addShortcode('wash', (seed, palette, w, h) =>
    washFigure(seed, palette, w, h));

  eleventyConfig.addShortcode('dab', (seed, palette, size) =>
    washDab(seed, palette, size));

  /* -------------------------------------------------------- timeline --- */

  // Shared id between a rail bar and its detail entry.
  // Takes the whole entry, not just the org — entries may carry an explicit
  // `key`, which is what keeps two Code Chrysalis roles distinct.
  eleventyConfig.addFilter('key', (entry) => keyOf(entry));

  // "now" is resolved at build time, so ongoing roles keep extending.
  eleventyConfig.addShortcode('timeline', (cv) => {
    const d = new Date();
    return timeline(cv, d.getFullYear() + d.getMonth() / 12);
  });

  /* ----------------------------------------------------------- drafts --- */

  /**
   * `draft: true` keeps a piece visible locally and out of the built site.
   *
   * This has to be a preprocessor, not a collection filter. Filtering the
   * collection only controls what the index and feed *list* — Eleventy still
   * renders each draft to its own permalink, so the pages ship and are
   * reachable by anyone with the URL. Returning false here drops the file from
   * the build entirely.
   *
   * Eleventy sets ELEVENTY_RUN_MODE itself: build | watch | serve.
   */
  eleventyConfig.addPreprocessor('drafts', '*', (data) => {
    if (data.draft && process.env.ELEVENTY_RUN_MODE === 'build') return false;
  });

  /* ------------------------------------------------------ collections --- */

  eleventyConfig.addCollection('writing', (api) =>
    api.getFilteredByGlob('src/writing/*.md').sort((a, b) => b.date - a.date));

  return {
    dir: {
      input: 'src',
      output: '_site',
      includes: '_includes',
      data: '_data',
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
  };
}

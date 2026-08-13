import { DateTime } from 'luxon';
import rssPlugin from '@11ty/eleventy-plugin-rss';
import { washFigure, washDab } from './lib/wash.js';

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

  /* ------------------------------------------------------ watercolour --- */

  // Seeded, deterministic. Same seed always paints the same figure, so a post
  // keeps its illustration across rebuilds.
  eleventyConfig.addShortcode('wash', (seed, palette, w, h) =>
    washFigure(seed, palette, w, h));

  eleventyConfig.addShortcode('dab', (seed, palette, size) =>
    washDab(seed, palette, size));

  /* ------------------------------------------------------ collections --- */

  eleventyConfig.addCollection('writing', (api) =>
    api.getFilteredByGlob('src/writing/*.md')
      // `draft: true` keeps a piece out of the built site but visible locally.
      .filter((p) => !p.data.draft || process.env.ELEVENTY_RUN_MODE !== 'build')
      .sort((a, b) => b.date - a.date));

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
